var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var config = require('./config');
var strftime = require('strftime');
var validator = require('validator');

var version = '0.23a';

// DB Connection
var sql = mysql.createConnection(config.db);
sql.connect(function(err) {
	if (err) {
		console.error('error connecting: ' + err.stack);
		return;
	}
	log('Connected to MySQL on '+config.db.host+' as id ' + sql.threadId);
});
sql.query('USE xmm');

// Resetting online count
sql.query('UPDATE `monkeys` SET `monkey_online` = 0');

// Assets
app.use(express.static(__dirname+'/client/assets/css'));
app.use(express.static(__dirname+'/client/assets/images'));
app.use(express.static(__dirname+'/client/assets/js'));
app.use(express.static(__dirname+'/client/assets/sounds'));

// Other pages
app.get('/:num', function(req, res){
  	res.sendFile(__dirname+'/client/index.html');
});

// Home page
app.get('/', function(req, res){
  	res.sendFile(__dirname+'/client/index.html');
});

// Socket connect
io.on('connection', function(socket) {
	log('New user from: '+socket.handshake.address);
	
	// Check version
	socket.on('version', function(local_version) {
		
		if (local_version == version)
		{
			socket.emit('uptodate');
		}
		else
		{
			socket.emit('alert', 'Your client (v'+local_version+') is obsolete, a new version of this app (v'+version+') is available. Please refresh the page.');
		}
		
	});
	
	// Handshake
	socket.on('handshake', function(token) {
		
		log('Handshake with token: '+token);
		
		// Look for monkey with this token
		sql.query('SELECT * FROM `monkeys` WHERE `monkey_token` = ?', [token], function(err, rows, fields) {
			if (err) throw err;
			
			// No monkey, create it
			if (rows.length == 0)
			{
				
				var monkey = {
					'token':  token,
					'ip': socket.handshake.address,
					'page_id': 0,
					'online': 1,
					'seen': new Date(),
					'insert': new Date(),
					'update': null,
				}
			
				sql.query("INSERT INTO `monkeys`(`monkey_token`, `monkey_ip`, `page_id`, `monkey_online`, `monkey_seen`, `monkey_insert`) VALUES(?, ?, ?, ?, NOW(), NOW())", [monkey.token, monkey.ip, monkey.page_id, monkey.online], function(err, info) {
					if (err) throw err;
					
					monkey.id = info.insertId;
					log('Created new monkey (#'+monkey.id+') for token: '+token);
					connected(socket, monkey);
					
				});
			}
			else
			{
				var m = rows[0];
				var monkey = {
					'id': m.monkey_id,
					'token':  m.monkey_token,
					'ip': m.monkey_ip,
					'page_id': m.page_id,
					'online': m.monkey_online,
					'seen': m.monkey_seen,
					'insert': m.monkey_insert,
					'update': m.monkey_update,
				}
				
				sql.query('UPDATE `monkeys` SET `monkey_online` = 1, monkey_seen = NOW() WHERE `monkey_id` = ?', [monkey.id], function(err, info) {
					if (err) throw err;
					
					log('Retrieved a monkey with token: '+token);
					
					connected(socket, monkey);
				});
			}
			
		});
		
	});
	
});


function connected(socket, monkey) {
	
	socket.emit('connected');
	
	socket.on('disconnect', function() {
		log("Monkey #"+monkey.id+" disconnected.");
		sql.query('UPDATE `monkeys` SET `monkey_online` = 0 WHERE `monkey_id` = ?', [monkey.id], function(err, info) {
			if (err) throw err;
			updateCount(socket);
		});

	});
	
	// Get pages
	socket.on('getPages', function(date) {
		
		log("Monkey #"+monkey.id+" asked for pages updated after "+date);
		sql.query('SELECT * FROM `pages`', [date], function(err, rows, fields) {
			if (err) throw err;
			socket.emit('pages', rows);
		});
		
	});
	
	
	// Monkey changing page
	socket.on('move', function(move) {
		
		sql.query('UPDATE `monkeys` SET `page_id` = ? WHERE `monkey_id` = ?', [move.to, monkey.id], function(err, info) {
			if (err) throw err;
			updateCount(socket);
			
			sql.query('SELECT `page_id`, `page_theme`, `page_theme_words` FROM `pages` WHERE `page_id` = ? LIMIT 1', [move.to], function(err, rows, fields) {
				if (err) throw err;
				
				var p = rows[0];
				var page = {
					'id': p.page_id,
					'theme': p.page_theme,
					'theme_words': p.page_theme_words,
				}
					
				sql.query('SELECT MIN(`page_id`) AS `next` FROM `pages` WHERE `page_id` > ? LIMIT 1', [move.to], function(err, rows, fields) {
					if (err) throw err;
					if (rows.length) page.next = rows[0].next;
					
					sql.query('SELECT MAX(`page_id`) AS `prev` FROM `pages` WHERE `page_id` < ? LIMIT 1', [move.to], function(err, rows, fields) {
						if (err) throw err;
						if (rows.length) page.prev = rows[0].prev;
						
						socket.emit('page', page);
						log("Monkey #"+monkey.id+" moved from "+move.from+" to "+move.to+".");
					});
				});
			});
			
		});
	});
	
	// Monkey saying
	socket.on('say', function(data) {
		
		input = formatInput(data.input);
		
/* 		log("Monkey saying '"+data.input+"'"); */
		
		var response = { page: data.page_id, monkey: monkey.token, input: input }
		
		socket.broadcast.emit('say', response);
		socket.emit('say', response);
		
	});
	
	// Monkey writing
	socket.on('write', function(data) {
		
		var input = formatInput(data.input);
		
		sql.query('SELECT `page_id`, `page_version`, `page_content`, `page_last_player`, `page_theme`, `page_theme_words` FROM `pages` WHERE `page_id` = ? LIMIT 1', [data.page], function(err, rows, fields) {
			if (err) throw err;
			if (rows.length) p = rows[0];
			
			var page = {
				'id': p.page_id,
				'version': p.page_version,
				'content': p.page_content,
				'last_player': p.page_last_player,
				'theme': p.page_theme,
				'theme_words': p.page_theme_words,
			}
			
			// Check input
			if (input.length > 30)
			{
				socket.emit('alert', 'You may not enter a word longer than 30 characters.');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"'s input ("+input+") is longer than 30 chars.");
			}
			else if (m = /\/|\\|\||@|#|\[|]|{|}|\^|http|www|\.com|\.fr|\.net/.exec(input))
			{
				socket.emit('alert', 'Your input contains forbidden characters ('+m[0]+').');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"'s input ("+input+") contains forbidden chars:"+m[0]);
			}
			else if (page.version != data.version)
			{
				socket.emit('alert', 'Too slow ! Someone has sent something since you start typing. You should check it and try again.');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"' was too slow.");
			}
			else if (page.last_player == monkey.token)
			{
				socket.emit('alert', 'Too quick ! You wrote the last word of this page. You have to wait until someone else enters something.');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"' was too quick.");
			}
			else
			{
				// Increment page version
				page.version++;
				
				// Update theme word count
				page.theme_words -= input.split(' ').length - 1;
		
				// Changing theme if no more word
				if (page.theme_words < 1)
				{
					page.theme_words = 30; // Get the counter back to 30;
					var words = page.content.split(' '); // Get an array with words from page content
					
					var themes = [];
					for (w in words)
					{
						words[w] = validator.blacklist(words[w], '.!?,;::*"'); // Delete punctuation signs
						if (words[w].length >= 5) themes.push(words[w]); // Keep only words with 5 letters or more
					}
					
					page.theme = themes[Math.floor(Math.random() * themes.length)] // Choose a random word from array
					
					log('Changing theme to "'+page.theme+'" on page '+page.id+'.');
				}
				delete page.content;
		
				// Create new input
				sql.query('INSERT INTO `inputs`(`monkey_token`, `page_id`, `page_version`, `input_content`, `input_status`, `input_insert`) VALUES(?, ?, ?, ?, 1, NOW())', 
					[monkey.token, page.id, page.version, input], function(err, rows, fields) {
					if (err) throw err;
					
					// Update page content
					sql.query('UPDATE `pages` SET `page_content` = CONCAT(`page_content`, ?), `page_last_player` = ?, `page_version` = ?, `page_theme` = ?, `page_theme_words` = ?, `page_update` = NOW() WHERE `page_id` = ? LIMIT 1', [input, monkey.token, page.version, page.theme, page.theme_words, page.id], function(err, rows, fields) {
						if (err) throw err;
						
						var response = { page: page, monkey: monkey.token, input: input }
						
						socket.broadcast.emit('write', response);
						socket.emit('write', response);
						
						log("Monkey #"+monkey.id+" wrote '"+input+"' on page "+page.id+".");
					
					});
					
				});
			}
					
		});
		
	});
	
}



// Broadcast monkey count to all monkeys
function updateCount(socket) {
	sql.query('SELECT `page_id`, COUNT(`monkey_id`) AS `count` FROM `pages` JOIN `monkeys` USING(`page_id`) WHERE `monkey_online` = 1 GROUP BY `page_id`', function(err, rows, fields) {
		if (err) throw err;
		socket.emit('monkeys', rows);
		socket.broadcast.emit('monkeys', rows);
	});
}

// Input format
function formatInput(input) {
	
	// Trim input
	input = input.trim();
	
	// Escape HTML characters
	input = validator.escape(input);
	
	// Add space unless 1st character is . , - or _
	if (!/^\.|^,|^-|^_/.test(input))
	{
		input = ' '+input;
	}
	
	// Remove 1st character if _
	if (/^_/.test(input))
	{
		input = input.substr(1);
	}
	
	return input;
}

function log(log) {
	console.log(strftime('%d %b %H:%M:%S')+' - '+log)
}




// Web server
http.listen(config.server.port, function(){
  log('Web server listening on port '+config.server.port);
});










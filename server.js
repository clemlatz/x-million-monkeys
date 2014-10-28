var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var config = require('./config');

var version = '0.23a';

// DB Connection
var sql = mysql.createConnection(config.db);
sql.connect(function(err) {
	if (err) {
		console.error('error connecting: ' + err.stack);
		return;
	}
	console.log('Connected to MySQL on '+config.db.host+' as id ' + sql.threadId);
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
	console.log('New user from: '+socket.handshake.address);
	
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
		
		console.log('Handshake with token: '+token);
		
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
					console.log('Created new monkey (#'+monkey.id+') for token: '+token);
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
					
					console.log('Retrieved a monkey with token: '+token);
					
					connected(socket, monkey);
				});
			}
			
		});
		
	});
	
});


function connected(socket, monkey) {
	
	socket.emit('connected');
	
	socket.on('disconnect', function() {
		console.log("Monkey #"+monkey.id+" disconnected.");
		sql.query('UPDATE `monkeys` SET `monkey_online` = 0 WHERE `monkey_id` = ?', [monkey.id], function(err, info) {
			if (err) throw err;
			updateCount(socket);
		});

	});
	
	// Get pages
	socket.on('getPages', function(date) {
		
		console.log("Monkey #"+monkey.id+" asked for pages updated after "+date);
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
						console.log("Monkey #"+monkey.id+" moved from "+move.from+" to "+move.to+".");
					});
				});
			});
			
		});
	});
	
	// Monkey saying
	socket.on('say', function(data) {
		
		var response = { page: data.page_id, monkey: monkey.token, input: data.input }
		
		socket.broadcast.emit('say', response);
		socket.emit('say', response);
		
	});
	
	// Monkey writing
	socket.on('write', function(data) {
		
		console.log(data);
		
		if (checkInput(data))
		{
		
			var input = ' '+data.input;
		
			sql.query('SELECT * FROM `pages` WHERE `page_id` = ? LIMIT 1', [data.page], function(err, rows, fields) {
				if (err) throw err;
				if (rows.length) p = rows[0];
				
				var page = {
					'id': p.page_id,
					'version': p.page_version+1,
					'content': p.page_content,
				}
			
				// Create new input
				sql.query('INSERT INTO `inputs`(`monkey_token`, `page_id`, `page_version`, `input_content`, `input_status`, `input_insert`) VALUES(?, ?, ?, ?, 1, NOW())', 
					[monkey.token, page.id, page.version, input], function(err, rows, fields) {
					if (err) throw err;
					
					// Update page content
					sql.query('UPDATE `pages` SET `page_content` = ?, `page_last_player` = ?, `page_version` = ?, `page_update` = NOW() WHERE `page_id` = ? LIMIT 1', 
						[page.content+input, monkey.token, page.version, page.id], function(err, rows, fields) {
						if (err) throw err;
						
						var response = { page: { id: page.id, version: page.version }, monkey: monkey.token, input: input }
						
						socket.broadcast.emit('write', response);
						socket.emit('write', response);
						
						console.log("Monkey #"+monkey.id+" wrote '"+input+"' on page "+page.id+".");
					
					});
					
				});
						
			});
		}
		
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

// Input check
function checkInput(data) {
	return true;
}




// Web server
http.listen(config.server.port, function(){
  console.log('listening on port '+config.server.port);
});
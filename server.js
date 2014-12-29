require('newrelic');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var strftime = require('strftime');
var validator = require('validator');
var Sequelize = require('sequelize');

var version = '0.23.2';

// Connect to database with ENV
if (process.env.DATABASE_URL) {

	var match = process.env.DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
	
	var config = {
		server: {
			port: process.env.PORT
		},
		db: {
			user: match[1],
			pass: match[2],
			base: match[5],
			options: {
				dialect: 'postgres',
				protocol: 'postgres',
				host: match[3],
				logging: false,
				port: match[4],
				dialectOptions: {
					ssl: true
				}
			}
		}
	};

}

// Connect to database with config.js
else 
{
	var config = require('./config');
}

sequelize = new Sequelize(config.db.base, config.db.user, config.db.pass, config.db.options);

sequelize
.authenticate()
.success( function() {
	log('Sequelize: Connected to '+config.db.dialect+' server at '+config.db.host+' as '+config.db.user+'.');
	
	// Start web server
	http.listen(config.server.port, function(){
		log('Web server listening on port '+config.server.port);
	});
}).error( function(err) {
	log('DB Error: '+err);
});

// Page entity schema
var Pages = sequelize.define('Page', {
	content: Sequelize.TEXT,
	last_player: Sequelize.STRING,
	version: Sequelize.INTEGER,
	timestamp: Sequelize.BIGINT,
	theme: Sequelize.STRING,
	theme_words: Sequelize.INTEGER,
});

// Monkey entity schema
var Monkeys = sequelize.define('Monkey', {
	online: Sequelize.BOOLEAN,
	token: Sequelize.STRING,
	ip: Sequelize.STRING,
	seen: Sequelize.DATE,
});

// Input entity schema
var Inputs = sequelize.define('Input', {
	monkey_token: Sequelize.STRING,
	page_version: Sequelize.INTEGER,
	content: Sequelize.STRING,
	status: Sequelize.BOOLEAN,
});

// Relations
Pages.hasMany(Monkeys);
Monkeys.belongsTo(Pages);

Pages.hasMany(Inputs);
Inputs.belongsTo(Pages);

Monkeys.hasMany(Inputs);
Inputs.belongsTo(Monkeys);

// Sync schemas
sequelize
.sync()
.complete(function(err) {
	if (!!err) {
		log('Sequelize: An error occurred while creating the table:', err);
	} else {
		log('Sequelize: Database schema synced !');
		
		// // Resetting online count
		Monkeys.findAll().success( function(res) {
			var key;
			for (key in res)
			{
				monkey = res[key];
				monkey.online = false;
				monkey.setPage(null);
				monkey.save();
			}
		});
		log('Resetting monkey count to 0');
		
	}
});


// Assets
app.use(express.static(__dirname+'/client/assets'));
app.use(express.static(__dirname+'/client/libs'));

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
			socket.emit('_error', 'Your client (v'+local_version+') is obsolete, a new version of this app (v'+version+') is available. Please refresh the page.');
		}
		
	});
	
	// Handshake
	socket.on('handshake', function(token) {
		
		log('Handshake with token: '+token);
		
		// Look for  monkey with this token
		Monkeys.find({ where: { token: token } }).success(function(monkey) {
				
				// No monkey, create one
				if (!monkey) 
				{
					// Insert new monkey with this token
					monkey = Monkeys.build({
						token: token,
						ip: socket.handshake.address,
						online: false,
						seen: new Date(),
					});
				
					monkey
					.save()
					.complete(function(err) {
						if (!!err) throw err;
						else 
						{
							log('Created new monkey (#'+monkey.id+') with token: '+token);
							connected(socket, monkey);
						}
					});
				}
				
				// Else update monkey seen
				else 
				{
					log('Retrieved a monkey with token: '+token);
					
					monkey.online = true;
					monkey.seen = new Date();
					monkey.save();
					
					connected(socket, monkey);
				}
			});
		
	});
	
});


function connected(socket, monkey) {
	
	socket.emit('connected');
	
	socket.on('disconnect', function() {
		log("Monkey #"+monkey.id+" disconnected.");
		
		monkey.online = false;
		monkey.setPage(null);
		monkey.save().success( function() {
			updateCount(socket);
		});

	});
	
	// Get route
	socket.on('route', function() {
		
		log("Monkey #"+monkey.id+" asked for route.");
		
		Pages.findAndCountAll().success( function(result) {
			
			var pages = result.rows,
				route;
			
			if (result.count)
			{
				// Page occupation
				var total = 0;
				var ideal = [], crowded = [], empty = [], blank = [];
				for (var page in pages)
				{
					// Monkeys.findAndCountAll({ where: { online: 1, page_id: page.id }}).success( function(result) {
					// 	total++;
					// 	if (result.count >= 4) crowded.push(page.id);
					// 	if (result.count === 0) empty.push(page.id);
					// 	if (result.count < 4) ideal.push(page.id);
					// });
				}
				
				// Router rules
				if (crowded.length == total) // All pages are crowded, create a new one
				{
					route = pages[0].id;
					rule = 'all page crowded (temp)';
				}
				else if (empty.length == total) // All pages are empty, go to page 1
				{
					route = pages[0].id;
					rule = 'all pages empty';
				}
				else if (ideal.length) // If there is at least one ideal page, go there
				{
					route = ideal[0];
					rule = 'ideal page';
				}
			}
			
			if (!route)
			{
				Pages.create({
					content: ' ',
					version: 0,
					timestamp: 0,
					theme: ' ',
					theme_words: 1,
				}).success( function(page) {
					
					route = page.id;
					rule = 'no page available, creating a new one';
					
					// Send route to monkey
					socket.emit('route', route);
					log("Monkey #"+monkey.id+" routed to page "+route+" according to rule: "+rule+".");
					
				});
			}
			else
			{
				// Send route to monkey
				socket.emit('route', route);
				log("Monkey #"+monkey.id+" routed to page "+route+" according to rule: "+rule+".");
			}
			
			
		});
		
	});
	
	// Get pages
	socket.on('getPages', function(date) {
		
		log("Monkey #"+monkey.id+" asked for pages updated after "+date);
		
		Pages.findAndCountAll().success( function(result) {
			socket.emit('pages', result.rows);
		});
		
	});
	
	
	// Monkey changing page
	socket.on('move', function(move) {
		
		Pages.find({ where: { id: move.to }}).success( function(page) {
			
			// If page not found, send monkey to home
			if (!page)
			{
				socket.emit('route');
			}
			else
			{

				monkey.setPage(page).success(function() {
					
					updateCount(socket);
					
					sequelize.query('SELECT MIN(`id`) AS `next` FROM `pages` WHERE `id` > '+page.id+' LIMIT 1').success( function(result) {
						
						if (result.next) page.next = result.next;
						
						sequelize.query('SELECT MAX(`id`) AS `prev` FROM `pages` WHERE `id` < '+page.id+' LIMIT 1').success( function(result) {
							
							if (result.prev) page.prev = result.prev;
							
							log("Monkey #"+monkey.id+" moved from "+move.from+" to "+move.to+".");
							socket.emit('page', page);
							
						});
						
					});
				
				});
			}
			
		});
	
	});
	
	// Monkey saying
	socket.on('say', function(data) {
		
		input = formatInput(data.input);
		
/* 		log("Monkey saying '"+data.input+"'"); */
		
		var response = { page: data.page_id, monkey: monkey.token, input: input };
		
		socket.broadcast.emit('say', response);
		socket.emit('say', response);
		
	});
	
	// Monkey writing
	socket.on('write', function(data) {
		
		var input = formatInput(data.input);
		
		Pages.find({ where: { id: data.page }}).success( function(page) {
			
			console.log(page.last_player +'/'+monkey.token);
			
			// Check input
			if (data.input.length > 30)
			{
				socket.emit('alert', 'You may not enter a word longer than 30 characters.');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"'s input ("+input+") is longer than 30 chars.");
			}
			else if (m = /\/|\\|\||@|#|\[|]|{|}|\^|http|www|\.com|\.fr|\.net/.exec(data.input))
			{
				socket.emit('alert', 'Your input contains forbidden characters ('+m[0]+').');
				io.sockets.emit('say', { page: page.id, monkey: monkey.token, input: "" });
				log("Monkey #"+monkey.id+"'s input ("+data.input+") contains forbidden chars:"+m[0]);
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
					
					page.theme = themes[Math.floor(Math.random() * themes.length)]; // Choose a random word from array
					
					log('Changing theme to "'+page.theme+'" on page '+page.id+'.');
				}
				delete page.content;
		
				// Create new input
				Inputs
				.create({
					monkey_token: monkey.token,
					page_version: page.version,
					content: input,
				})
				.success(function(input) {
					
					// Update page content
					page.content += input.content;
					page.last_player = monkey.token;
					page.save().success( function() {
						
						var response = { page: page, monkey: monkey.token, input: input.content };
						
						socket.broadcast.emit('write', response);
						socket.emit('write', response);
						
						log("Monkey #"+monkey.id+" wrote '"+input.content+"' on page "+page.id+".");
					
					});
					
				});
			}
					
		});
		
	});
	
}

// Broadcast monkey count to all monkeys
function updateCount(socket) {
	
	Pages.findAll({ include: [Monkeys] }).success( function(res) {
		
		var page, online = [];
		for (var key in res)
		{
			page = res[key];
			online.push({ id: page.id, count: page.Monkeys.length});
		}
		
		socket.emit('monkeys', online);
		socket.broadcast.emit('monkeys', online);
		
	}).error( function(err) {
		log('Error while counting monkeys: '+err);
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
	console.log(strftime('%e %b %H:%M:%S').trim()+' - '+log)
}

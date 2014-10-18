var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var config = require('./config');

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

// Assets
app.use(express.static(__dirname+'/client/assets/css'));
app.use(express.static(__dirname+'/client/assets/images'));
app.use(express.static(__dirname+'/client/assets/js'));
app.use(express.static(__dirname+'/client/assets/sounds'));

// Home page
app.get('/', function(req, res){
  	res.sendFile(__dirname+'/client/index.html');
});

// Socket connect
io.on('connection', function(socket) {
	console.log('a user connected');
	
	socket.on('disconnect', function(){
	    console.log('a user disconnected');
	});
	
	// Get pages
	socket.on('getPages', function() {
		
		sql.query('SELECT * FROM `pages`', function(err, rows, fields) {
			if (err) throw err;
			socket.emit('pages', rows);
		});
		
	});
	
});

// Web server
http.listen(config.server.port, function(){
  console.log('listening on port '+config.server.port);
});
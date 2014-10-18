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


app.get('/', function(req, res){
  	res.sendFile(__dirname+'/client/index.html');
});

app.use(express.static(__dirname+'/client/assets/css'));

app.get('/assets/css/xmm.css', function(req, res){
  	res.sendFile(__dirname+'/client/assets/css/xmm.css');
});

io.on('connection', function(socket) {
	console.log('a user connected');
	
	socket.on('disconnect', function(){
	    console.log('user disconnected');
	});
	
});

http.listen(config.server.port, function(){
  console.log('listening on port '+config.server.port);
});
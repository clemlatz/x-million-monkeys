var express = require('express');
var app = express();

app.get('/', function(req, res){
  	res.sendFile(__dirname+'/../client/index.html');
});

/*
app.get('/:url', function (req, res) {
	var file = __dirname+'/client/'+req.params.url;
	console.log('GET '+file);
	res.sendFile(file);
});
*/

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
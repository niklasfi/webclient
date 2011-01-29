var fs = require('fs');
var http = require('http');
var urlparser = require('url');
var k = process.binding('constants');

function Download(url,path){
	this.u= urlparser.parse(url);
	this.httpStatus=null;
	this.recievedHeader=null;
	this.fd = null;
	this.connection.status = this.connection.clear;
	this.filestats = {filesize: null, bytesWritten: 0, bytesRecieved: 0};
	this.timer= {timerObject: null, bytesLastStatsUpdate: 0, timerInterval: 2000};

	this.Download(url,path);
}

Download.prototype = {
	connection: {clear: 0, awaitingResponse: 1, downloading: 2, finished: 3},

	Download: function (url,path){
		var that=this;
		fs.open(path, k.O_WRONLY | k.O_CREAT, 0777, function(err, fd){
			if(err){
				console.error("Got error while opening file: " + err.message);
				process.exit(1); 
			}
			that.fd=fd;
			console.log('file sucessfully opened')
			that.startDownload();
		});
	},
	startDownload: function(){

		var options={host: this.u.host, port: this.u.port ||'80', path: this.u.pathname, method: 'GET'};
		var g=http.get(options);
		this.connection.status = this.connection.awaitingResponse;
		console.log('now waiting for a response');
		var that= this;
		g.on('response', function(res) {
			console.log('got response: ' + res.statusCode);
			that.recievedHeader=res.headers;
			that.httpStatus=res.statusCode;
			that.filestats.filesize = res.headers['content-length'] || res.filestats.filesize;
			that.timer.timerObject=setInterval(function(){that.statsTick(that)},that.timer.timerInterval);
			this.connection.status = this.connection.downloading;
			res.on('data',function(chunk){that.onNewData(chunk, that)});
		});
		g.on('error', function(e) {
			console.log('got error while sending get request: ' + e.message);
			process.exit(2);
		});
		g.on('end', function() {
			this.connection.status = this.connection.finished;
			console.log('download complete');
		});
	},
	onNewData: function(chunk,that){
		fs.write(that.fd, chunk, 0, chunk.length, that.filestats.bytesRecieved, function(err, written){
			that.filestats.bytesWritten += written;
			if( that.connection.status == that.connection.finished) 
			  && that.filestats.bytesWritten == that.filestats.bytesRecieved){
				fs.close(that.fd);
				console.log('all bytes written');
				clearInterval(that.timer.timerObject)
			}
		});
		that.filestats.bytesRecieved += chunk.length;
	},
	statsTick: function(that){
		console.log('recieved: ' + that.filestats.bytesRecieved + 'B of '+ that.filestats.filesize + 'B, progress: ' + ( that.filestats.bytesRecieved /that.filestats.filesize*100).toPrecision(4) + '%, download-rate: '
			+ ((that.filestats.bytesRecieved-that.timer.bytesLastStatsUpdate)/that.timer.timerInterval).toPrecision(4) + 'kB/s');
		that.timer.bytesLastStatsUpdate = that.filestats.bytesRecieved;
	}
}

var d = new Download('http://dl.google.com/earth/client/current/GoogleEarthLinux.bin', 'googleearth.bin');

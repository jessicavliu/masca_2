// RFduino Node Example

// Discover and read temperature from RFduinos running the Temperature Sketch
// https://github.com/RFduino/RFduino/blob/master/libraries/RFduinoBLE/examples/Temperature/Temperature.ino
//
// (c) 2014 Don Coleman

var os = require('os');
var platform = os.platform();
var osRelease = parseFloat(os.release());

//if macOS Mojave is being used, import noble-mac dependency; else import noble dependency
//TODO: see if there is a way to alter noble code so this check isn't required
var noble = (platform == 'darwin' && osRelease < 18) ? require('../noble') : require('@s524797336/noble-mac');
//var noble = require('@s524797336/noble-mac');//noble = require('../noble'),
var rfduino = require('./rfduino');
var _ = require('underscore');
 // Set Up HTTP Server                                                                                                                                                                                                                  
var express = require('express');
var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/assets'));
app.get('/', function(req, res){
	//render the index.jade template
	//don't provide variables - we'll use socket.io for that
	res.render('index');
});

var server = app.listen(3000, function(){console.log("app listening at port 3000")});
var io = require('socket.io').listen(server);
var sock = null;
var fs = require('fs');
var stream = null;


function logData(variable, value) {
	stream.write(String(getTimestamp()));
	stream.write(';');
	stream.write(String(variable));
	stream.write(';');
	stream.write(String(value));
	stream.write('\r\n'); 
}

io.sockets.on('connection', function (socket) {
	console.log("connection")
	socket.emit('try', 222)
	sock = socket;

	setInterval(sendFakeData, 50);

	sock.on('user', function (data) {
		if (data.recording == 'start') {
			fileName = './logs/' + String(data.userName) + '_' + String(data.groupName);
			//console.log(fileName);
			if (fs.existsSync(fileName)) {
				//console.log('already exists');
				return;
			}
			stream = fs.createWriteStream(fileName);
			stream.write('TS;VAR;VAL');
			stream.write('\r\n');
			logData('user', data.userName);
			logData('group', data.groupName);
			logData('age', data.age);
			logData('gender', data.gender);
		} else {
			if (stream != null) {
				stream.end();
				stream = null;
			}
		}
	});
	sock.on('eyeMovReset', function(data) {
		//console.log('rest');
		eyeMovCounter = 0;
		sock.emit('eyeMovCounter', eyeMovCounter);
		minuteCounter = 0;
		minuteTime = new Date().getTime()/1000;
		sock.emit('eyeMovMinCounter', minuteCounter);
	});
});

function average(arr) {
	var sum = 0;
	for (var i = 0; i < arr.length; i++) {
		sum += parseInt(arr[i], 10);
	}
	return sum/arr.length;
}


var bufferRight = [],
		initRight = false,
		threshRightBot = 1,
		threshRightTop = 6,
		refracPeriod = 1.2,
		lastMov = new Date().getTime()/1000,
		eyeMovCounter = 0,
		minuteTime = new Date().getTime()/1000,
		minuteCounter = 0;
		
var state = 0, //  0 - Wake , 1 - NREM , 2 - REM
		bodyMinutes = 0, 
		eyeMinutes = 0,
		nullMinutes = 0,
		pitchBaseline = 0,
		rollBaseline = 0,
		eyeBaseline = 0,
		pitchThreshold = 1000,
		rollThreshold = 1000,
		eyeThreshold = 5 ;
		milliTime = 0 ;
		sendTime = 0 ;

const WAKE = 0,
			NREM = 1,
			REM = 2;

function processData(eye1, eye2) {
	// eye1 = left
	bufferRight.push(eye2);
	if (!initRight) {
		if (bufferRight.length == 10) {
			initRight = true;
		}
	} else {
		console.log("in else branch");
		bufferRight.shift();
		meanRight = average(bufferRight);
		now = new Date().getTime()/1000;
		diff = bufferRight[1] - eye2
		console.log("diff: " + String(diff));

		//emit eye movement
		console.log("publishEyeMovement")
		publishEyeMovement(diff, now);

		//if a minute has passed, emit eyeMovementPerMin and reset the per-min counter
		publishEyeMovementPerMin(now);

	}
}

function publishEyeMovement(diff, now){
	//the only reason this is commented out is because i'm trying to use fake data
	/*if (diff > threshRightBot &&
		diff < threshRightTop &&
		now - lastMov > refracPeriod) {*/
		lastMov = new Date().getTime()/1000;
		//console.log("MOVEMENT");
		eyeMovCounter++;
		minuteCounter++;  
		if (sock != null) {
			sock.emit('eyeMovCounter', eyeMovCounter);
			console.log('emitted eyeMovCounter')
			if (stream != null) {
				logData('eye movement', 1);
			}
		}
	//}
}

function publishEyeMovementPerMin(now){
	if (now - minuteTime > 60) {
		if (sock != null) {
			//sock.emit('eyeMovMinCounter', minuteCounter);
			if (stream != null) {
				logData('eyeMovementPerMin', minuteCounter);
			}
		}
		minuteTime = now; 
		minuteCounter = 0;
	}
}

function checkMovements(){
	//t_minutes = (millis() - t_millis)/60000 ;
	if(milliTime > 0){
		let pitchDiff = pitch - pitchBaseline ;
		let rollDiff = roll - rollBaseline ;
		let eyeDiff = eye1 - eyeBaseline ;
		if(abs(pitchDiff) > pitchThreshold || abs(rollDiff) > rollThreshold){
			bodyMinutes = bodyMinutes + 1 ;
			eyeMinutes = 0 ;
			nullMinutes = 0 ;
		}
		else if(abs(eyeDiff) > eyeThreshold){
			bodyMinutes = 0 ;
			eyeMinutes = eyeMinutes + 1 ;
			nullMinutes = 0 ;
		}       
		else{
			bodyMinutes = 0 ;
			eyeMinutes = 0 ;
			nullMinutes = nullMinutes + 1 ;
		}
		milliTime = new Date().getTime();
	 }
}

function updateState(){
	 switch(state){
		case WAKE: if(nullMinutes >= 5) state = NREM ;
							 break;
		case NREM: if(eyeMinutes >= 3) state = REM ;
							 if(bodyMinutes >= 3) state = WAKE ;
							 break;
		case REM: if(bodyMinutes >= 3) state = WAKE ;
							if(nullMinutes >= 5) state = NREM ;
							 break;
	 }
}

var oldEye1 = 0;

var oldEye2 = 0;
function sendFakeData(){
	var count = 0;
	if(count % 3000 == 0){
		console.log('state changing')
		state = (state+1)%3
		console.log('new state ' + state)
		count = 0;
	}

	fakeData = [Math.floor(Math.random() * 500), 0, 1, 1, state]
	eye1 = fakeData[0]
	eye2 = fakeData[1]
	pitch = fakeData[2]
	roll = fakeData[3]
	state = fakeData[4]
	console.log("eye1 " + eye1);

	processData(eye1, eye2);

	sock.emit('pitch',pitch);
	sock.emit('fakeData', fakeData);
	sock.emit('roll',roll);
	sock.emit('state', state);
	count++;
	//console.log('emitted pitch, fakeData, roll, state')
}

function sendData(data) {
	console.log("data: " + data)
	if (sock != null) {
		eye1 = data.readUInt32LE(0);
		eye2 = data.readUInt32LE(4);
		pitch = data.readInt32LE(8);	
		roll = data.readInt32LE(12);
		state = data.readInt32LE(16);
		/*console.log(eye1)
		console.log(eye2)
		console.log("state: " + state)*/
		sock.emit('eyeMovMinCounter',minuteCounter);
		/*
		//update and emit state
		checkMovements();
		updateState();
		if (sock != null){
			sock.emit('state', state);
			if (stream != null){
				logData('state', state);
			}
		}*/

		processData(eye1, eye2);
		if (stream != null) {
			logData('eye1', eye1);
			logData('eye2', eye2);
			logData('pitch',pitch);
			logData('roll',roll);
			logData('state', state);
		}
		sock.emit('pitch',pitch);
		sock.emit('data', data);
		sock.emit('roll',roll);
		str = String(eye1) + "," + String(eye2) + "," + String(pitch) + "," + String(roll) 
		//console.log(str);
	}
}

function getTimestamp() {
	return Math.round(new Date().getTime()/1000);
}

// TODO why does this need to be wrapped?
var stop = function() {
		noble.stopScanning();
};


noble.on('scanStart', function() {
		console.log('Scan started');
		//setTimeout(stop, 5000);
});



noble.on('scanStop', function() {
		console.log('Scan stopped');
});

var onDeviceDiscoveredCallback = function(peripheral) {
		console.log('\nDiscovered Peripherial ' + peripheral.uuid);

		if (_.contains(peripheral.advertisement.serviceUuids, rfduino.serviceUUID)) {
				console.log('RFduino is advertising \'' + rfduino.getAdvertisedServiceName(peripheral) + '\' service.');

				peripheral.on('connect', function() {
						peripheral.discoverServices();
				});

				peripheral.on('disconnect', function() {
						console.log('Disconnected');
				});

				peripheral.on('servicesDiscover', function(services) {

						var rfduinoService;

						for (var i = 0; i < services.length; i++) {
								if (services[i].uuid === rfduino.serviceUUID) {
										rfduinoService = services[i];
										break;
								}
						}

						if (!rfduinoService) {
								console.log('Couldn\'t find the RFduino service.');
								return;
						}

						rfduinoService.on('characteristicsDiscover', function(characteristics) {
								console.log('Discovered ' + characteristics.length + ' service characteristics');

								var receiveCharacteristic;

								for (var i = 0; i < characteristics.length; i++) {
										if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
												receiveCharacteristic = characteristics[i];
												break;
										}
								}

								if (receiveCharacteristic) {
										receiveCharacteristic.on('read', function(data, isNotification) {
												//console.log(peripheral.uuid);
												//console.log(data);
												sendData(data);
										});

										console.log('Subscribing for temperature notifications');
										receiveCharacteristic.notify(true);
								}

						});

						rfduinoService.discoverCharacteristics();

				});

				peripheral.connect();
		}
	else{
		console.log("failed at the _ step");
	}
};

noble.on('stateChange', function(state) {
	console.log("stateChange");
		if (state === 'poweredOn') {
				noble.startScanning([rfduino.serviceUUID], false);
		}
});

//noble.on('discover', onDeviceDiscoveredCallback);

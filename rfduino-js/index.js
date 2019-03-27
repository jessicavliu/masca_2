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

var server = app.listen(3000);
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
  sock = socket;
  sock.on('user', function (data) {
    if (data.recording == 'start') {
      fileName = './logs/' + String(data.userName) + '_' + String(data.groupName);
      console.log(fileName);
      if (fs.existsSync(fileName)) {
        console.log('already exists');
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
    console.log('rest');
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
function processData(eye1, eye2) {
  // eye1 = left
  bufferRight.push(eye2);
  if (!initRight) {
    if (bufferRight.length == 10) {
      initRight = true;
    }
  } else {
    bufferRight.shift();
    meanRight = average(bufferRight);
    now = new Date().getTime()/1000;
    diff = bufferRight[1] - eye2
    //console.log("diff: " + String(diff));
    if (diff > threshRightBot &&
      diff < threshRightTop &&
      now - lastMov > refracPeriod) {
      lastMov = new Date().getTime()/1000;
      console.log("MOVEMENT");
      eyeMovCounter++;
      minuteCounter++;  
      if (sock != null) {
        sock.emit('eyeMovCounter', eyeMovCounter);
        if (stream != null) {
          logData('movement', 1);
        }
      }
    }
    if (now - minuteTime > 60) {
      if (sock != null) {
        //sock.emit('eyeMovMinCounter', minuteCounter);
        if (stream != null) {
          logData('movementPerMin', minuteCounter);
        }
      }
      minuteTime = now; 
      minuteCounter = 0;
    }
  }
}

var oldEye1 = 0;
var oldEye2 = 0;

function sendData(data) {
  if (sock != null) {
    eye1 = data.readUInt32LE(0);
    eye2 = data.readUInt32LE(4);
    pitch = data.readInt32LE(8);	
    roll = data.readInt32LE(12);
    console.log(eye1)
    console.log(eye2)
    sock.emit('eyeMovMinCounter',minuteCounter);
    processData(eye1, eye2);
    if (stream != null) {
      logData('eye1', eye1);
      logData('eye2', eye2);
      logData('pitch',pitch);
      logData('roll',roll);
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
    if (state === 'poweredOn') {
        noble.startScanning([rfduino.serviceUUID], false);
    }
});

noble.on('discover', onDeviceDiscoveredCallback);

var socket = io.connect('http://localhost:3000', function(){console.log("client connected")});
console.log("connected to server!")
var eye1 = 0,
	thresh = 50,
	eye2 = 0;
	pitch = 0 ;
	roll = 0 ;
var state = 0;
var prev = new Date().getTime()/1000;
var now = new Date().getTime()/1000;
var lastBeat = new Date().getTime()/1000;
var delay = 20;
var buffer = [];
var bpmInit = false;

var num_threads = 2;
var MT = new Multithread(num_threads);

const WAKE = 0,
		NREM = 1,
		REM = 2;

function mapStateToColor(state){
	var color;
	 switch (state){
		case WAKE:
			color = "blue";
			break;
		case NREM: 
			color = "green"
			break;
		case REM:
			color = "red";
			break;
	 }
}

socket.on('try', function (data) {
	$('#eye1-counter-per-min').text(data);
});

socket.on('eyeMovMinCounter', function (data) {
	$('#eye1-counter-per-min').text(data);
});

socket.on('eyeMovCounter', function (data) {
	$('#eye1-counter').text(data);
});

socket.on('pitch',function(data){
	$("#pitch").text(data);
});

socket.on('roll',function(data){
	$("#roll").text(data);
});

socket.on('state', function(data){
	state = state;
	$("#state").text(data);
})

socket.on('data', function (data) {
		newData = new Uint32Array(data);
		eye2 = 10*(1024 - newData[0]);
		eye1 = 15*newData[1];
		//buffer.push(hr);
		//if (bpmInit) {
		//  buffer.shift();
		//}
		$('#eye1').text(eye1);
		$('#eye2').text(eye2);
		//if(hr - oldHr > thresh && now - lastBeat > .4){
		//  document.getElementById("channel-bpm").style.background = 'rgba(255,0,0,0.8)';
		//  lastBeat = new Date().getTime()/1000;
		//} else {
		//  document.getElementById("channel-bpm").style.background = 'rgba(255,0,0,0.1)';
		//}
		//now = new Date().getTime()/1000;
		//if (!bpmInit) {
		//  if(now - prev >= 60) { 
		//    MT.process(processBPM, setBPM)(buffer, thresh);
		//    prev = now;
		//    bpmInit = true;
		//  }
		//} else {
		//  if(now - prev >= 1) {
		//    MT.process(processBPM, setBPM)(buffer, thresh);
		//    prev = now;
		//  }
		//}
});

socket.on('fakeData', function(data){
	//console.log("in fakeData")
	eye1 = data[0];
	eye2 = data[1];
	$('#eye1').text(eye1);
	$('#eye2').text(eye2);
});

function processBPM(buffer, thresh) {
	_bpm = 0;
	_prev = 0;
	lastBeat = -3;
	var i;
	for (i = 1; i < buffer.length; i++) {
		_now = buffer[i];
		_prev = buffer[i-1];
		if (_now - _prev > thresh && i - lastBeat > 4) {
			_bpm++;
			lastBeat = i;
		}
	}  
	//console.log("before setBPM");
	return _bpm;
	//setBPM(_bpm);
}

var recording = false;
document.addEventListener("DOMContentLoaded", function(){
	document.getElementById("reset").addEventListener("click", function(){
		console.log('reset');
		socket.emit("eyeMovReset");        
	});
	document.getElementById("submit").addEventListener("click", function(){
			recording = !recording;
			if (recording) {
				document.getElementById("submit").value = "Stop recording";
				document.getElementById("user-name").disabled = true;
				document.getElementById("group-name").disabled = true;
				document.getElementById("age").disabled = true;
				document.getElementById("gender").disabled = true;
				document.getElementById("recording").style.background = "rgba(255, 0, 0, 0.5)";
			} else {
				document.getElementById("submit").value = "Start recording";
				document.getElementById("user-name").disabled = false;
				document.getElementById("group-name").disabled = false;
				document.getElementById("age").disabled = false;
				document.getElementById("gender").disabled = false;
				document.getElementById("recording").style.background = "rgba(0, 0, 0, 0.1)";
			}
			var userName = document.getElementById("user-name").value;
			var groupName = document.getElementById("group-name").value;
			var age = document.getElementById("age").value;
			var gender = document.getElementById("gender").value;
			data = {
				'recording': recording ? "start" : "stop",
				'userName': userName,
				'groupName': groupName,
				'age': age,
				'gender': gender
			}
			socket.emit("user", data);        
	});
			//....
	var n = 1000,
			nHist = 1,
			//dataEye1 = d3.range(n).map(() => {return {'eye1': 0, 'state': 0};});
			dataEye1 = d3.range(n).map(() => {return 0;})
			//console.log("dataEye1");
			//console.log(dataEye1);
			dataEye2 = d3.range(n).map(() => {return 0;});
			dataEyeHist = d3.range(n).map(() => {return 0;});
	var svg = d3.select("#plot"),
			svgHist = d3.select("#plot-hist"),
			margin = {top: 20, right: 20, bottom: 20, left: 40},
			width = parseInt(svg.style("width").slice(0, -2));
			width = width  - margin.left - margin.right,
			height = parseInt(svg.style("height").slice(0, -2));
			height = height - margin.top - margin.bottom,
			g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
			// second
			marginHist = {top: 20, right: 20, bottom: 20, left: 40},
			widthHist = parseInt(svgHist.style("width").slice(0, -2));
			widthHist = widthHist  - marginHist.left - marginHist.right,
			heightHist = parseInt(svgHist.style("height").slice(0, -2));
			heightHist = heightHist - marginHist.top - marginHist.bottom,
			gHist = svgHist.append("g").attr("transform", "translate(" + marginHist.left + "," + marginHist.top + ")");

	var x = d3.scaleLinear()
		.domain([0, n - 1])
		.range([0, width]);

	var y = d3.scaleLinear()
		.domain([0, 400])
		//.domain([0, 1023])
		.range([height, 0]);
	
	var xHist = d3.scaleLinear()
		.domain([0, nHist - 1])
		.range([0, widthHist]);

	var minVal = 0;
	var maxVal = 300;
	var yHist = d3.scaleLinear()
		//.domain([minVal, maxVal])
		.domain([0, 1023])
		.range([heightHist, 0]);

	var lineEye1 = d3.line()
		.x(function(d, i) { return x(i); })
		.y(function(d, i) {
		 /*if (i % 200 == 0){
		 	if(typeof(d) == 'object'){
		 		//console.log(d['eye1'])
		 		//return y(d['eye1'])
		 	}
		 	else{
		 		console.log(d)
		 		return y(d);
		 	}
		 }
		 return y(d['eye1']); */
		 return y(d);});
	var lineEye2 = d3.line()
		.x(function(d, i) { return x(i); })
		.y(function(d, i) { return y(d); });

	var lineEyeHist = d3.line()
		.x(function(d, i) { return x(i); })
		.y(function(d, i) { return y(d); });

	g.append("defs").append("clipPath")
	.attr("id", "clip")
	.append("rect")
	.attr("width", width)
	.attr("height", height);

	g.append("g")
	.attr("class", "axis axis--x")
	.attr("transform", "translate(0," + y(0) + ")")
	.call(d3.axisBottom(x));

	g.append("g")
	.attr("class", "axis axis--y")
	.call(d3.axisLeft(y));

	g.append("g")
		.attr("clip-path", "url(#clip)")
	.append("path")
		//dataEye1 is the data we want to test
		.datum(dataEye1)
		//.attr('stroke', '')
		//.attr('fill', 'none')
		.attr("class", "line-eye1")

		//,mapStateToColor(state))
		//.style("fill", "blue")//mapStateToColor(state))
	.transition()
		.duration(delay)
		.ease(d3.easeLinear)
		.on("start", tick);
	
	g.append("g")
		.attr("clip-path", "url(#clip)")
	.append("path")
		.datum(dataEye2)
		.attr("class", "line-eye2")
		.attr('stroke', 'purple')
	.transition()
		.duration(delay)
		.ease(d3.easeLinear)
		.on("start", tick);

	// Hist
	
	//gHist.append("defs").append("clipPath")
	//.attr("id", "clip")
	//.append("rect")
	//.attr("width", widthHist)
	//.attr("height", heightHist);

	//gHist.append("g")
	//.attr("class", "axis axis--x")
	//.attr("transform", "translate(0," + yHist(0) + ")")
	//.call(d3.axisBottom(xHist));

	//gHist.append("g")
	//.attr("class", "axis axis--y")
	//.call(d3.axisLeft(yHist));

	//gHist.append("g")
	//  .attr("clip-path", "url(#clip)")
	//.append("path")
	//  .datum(dataEyeHist)
	//  .attr("class", "line-eye-hist")
	//.transition()
	//  .duration(delay)
	//  .ease(d3.easeLinear)
	//  .on("start", tickHist);
	
	function tick() {
		// Push a new data point onto the back.
		//console.log(eye1);
		//console.log(eye2);
		//var elem = {'eye1':eye1, 'state':state}
		dataEye1.push(eye1);
		dataEye2.push(eye2);
		// Redraw the line.
		d3.select(this)
			.attr("d", lineEye1)
			//.attr("d", lineEye2)
			.attr("transform", null);
		// Slide it to the left.
		d3.active(this)
			.attr("transform", "translate(" + x(-1) + ",0)")
			.transition()
			.on("start", tick);
		// Pop the old data point off the front.
		dataEye1.shift();
		dataEye2.shift();
		//console.log(dataEye1);
	}
 
	function updateScale() {
		//console.log(temp, eda);
		var val = eye1,
			step = 20;
		//console.log(min);
		//console.log(max);
		//if (val < minVal) {
		//  minVal = val - step;
		//}
		//if (val > maxVal) {
		//  maxVal = val + step;
		//}
		//if (val > (minVal + step)) {
		//  minVal = val - step;
		//}
		//if (val < (maxVal - step)) {
		//  maxVal = val + step;
		//}
		//console.log(minVal, maxVal); 

		//yHist = d3.scaleLinear()
		//  .domain([minVal, maxVal])
		//  .range([heightHist, 0]);
		//svgHist.selectAll('g.axis--y')
		//  .call(d3.axisLeft(yHist));
		
		nHist++;
		xHist = d3.scaleLinear()
			.domain([0, nHist - 1])
			.range([0, widthHist]);
		svgHist.selectAll('g.axis--x')
			.call(d3.axisBottom(xHist));


	}
 
	function tickHist() {
		
		// Push a new data point onto the back.
		dataEyeHist.push(eye1);
		//dataEye2.push(eye2);
		updateScale();
		// Redraw the line.
		d3.select(this)
			.attr("d", lineEyeHist)
			//.attr("d", lineEye2)
			.attr("transform", null);
		// Slide it to the left.
		d3.active(this)
			.attr("transform", "translate(" + xHist(-1) + ",0)")
			.transition()
			.on("start", tickHist);
		// Pop the old data point off the front.
		dataEyeHist.shift();
		//dataEye2.shift();
	}

});

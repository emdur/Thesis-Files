outlets = 1;
inlets = 1;

var slots = 0;
var pulses = 16;
//Max interaction functions
function setSlots(num){
	slots = num;
	if(pulses > 0 && slots > 0){
		euclideanRhythm();
	}
}
function setPulses(num){
	pulses = num;
	if(pulses > 0 && slots > 0){
		euclideanRhythm();
	}
}
function bang(){
	outlet(0, bin);
}
var bin = [];
function euclideanRhythm(){
	bin = compute_bjorklund_bitmap(slots, pulses);
	if(rotateRandomly){
		var rotations = Math.floor(Math.random() * 16);
		for(var i = 0; i < rotations; i++){
			rotate(bin);
		}
	} else {
		while(bin[0] == 0){
			rotate(bin);
		}
	}
	outlet(0, bin);
}
var rotateRandomly = false;
function rotation(num){
	if(num == 0){
		rotateRandomly = false;
	} else if(num == 1) {
		rotateRandomly = true;
	}
}
function rotate(binary){
	var temp = binary[0];
	binary.shift();
	binary.push(temp);
	return binary;
}


var remainder = [];
var count = [];
var pattern = [];
	
function compute_bjorklund_bitmap(num_slots, num_pulses) { //patternlength, number of events
	// This is an algorithm developed by E. Bjorklund.
	// Source: Bjorklund, E. (2004): The Theory of Rep-Rate Pattern Generation in the SNS Timing System.
	// Available online under https://www.semanticscholar.org/paper/The-Theory-of-Rep-Rate-Pattern-Generation-in-the-Bjorklund/c652d0a32895afc5d50b6527447824c31a553659 (last checked on 30.08.21).
	pattern = [];
	remainder = new Array(num_slots);
	count = new Array(num_slots);
	
	var divisor = num_slots - num_pulses;
	remainder[0] = num_pulses;
	var level = 0;
	
	do {
		count[level] = Math.floor(divisor/remainder[level]);
		remainder[level+1] = divisor%remainder[level];
		divisor = remainder[level];
		level += 1;
	} while (remainder[level] > 1);
	
	count[level] = divisor;
	build_string(level);

	return pattern;
}
function build_string(level) {
	// This is an algorithm developed by E. Bjorklund.
	// Source: Bjorklund, E. (2004): The Theory of Rep-Rate Pattern Generation in the SNS Timing System.
	if (level == -1) {
		pattern.push(0);
	}
	else if (level == -2) {
		pattern.push(1);
	}
	else {
		for(var j = 0; j < count[level]; j++) {
			build_string(level-1);
		}
		if(remainder[level] != 0) {
			build_string(level-2);
		}
	}
}
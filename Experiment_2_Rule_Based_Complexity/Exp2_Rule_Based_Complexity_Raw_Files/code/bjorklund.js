outlets = 3;
inlets = 2;

var basicRhythm = [];
var notes = [];

//Max interaction functions
function complexity(comp){
	post("\nComposing w/ complexity: " + comp + "\n");
	compose(comp);
}
function metroIn(metro){
	notes.forEach(function (note){
		if(note.index == metro){
			outlet(0, note.velocity);
			outlet(1, note.pitch);
		}
	});
}
var rotateRandomly = false;
function rotation(num){
	if(num == 0){
		rotateRandomly = false;
	} else if(num == 1) {
		rotateRandomly = true;
	}
}
var velocityChooser = 0;
function velocitySetting(num){
	//value 0 --> basicRhythm-based velocity
	//value 1 --> random: either basicRhythm-based or absolute-position-based velocity (1:1)
	//other value --> velocity based on absolute position of notes in bar
	velocityChooser = num;
}

//Note object constructor
function Note (index, pitch, velocity) {
		this.index = index;
		this.pitch = pitch;
		this.velocity = velocity;
}

function rotate(binary){
	var temp = binary[0];
	binary.shift();
	binary.push(temp);
	return binary;
}

function compose(complexity){
	//call from "complexity : int"-Max-Message
	// This function generates a drum beat based on a euclidean binary pattern, the only parameter is the "complexity" (value 0-100).
	if(complexity > 100){
		complexity = 100;
	}
	if(complexity < 0){
		complexity = 0;
	}
	notes.length = 0;
	//Determine number of (slots and) pulses according to the complexity parameter:
	var slots = 16;
	var pulses = 0;
	for(var i = 0; i <= complexity; i+=6.25){
		pulses++;
	}
	//Compute the basic binary rhythm the note timings and orchestration will be based on:
	basicRhythm = compute_bjorklund_bitmap(slots, pulses);
	//Rotate it so the first slot will always be filled (makes for a starting point with lower complexity/perceivably simpler pattern):
	if(rotateRandomly){
		var rotations = Math.floor(Math.random() * 16);
		for(var i = 0; i < rotations; i++){
			rotate(basicRhythm);
		}
	} else {
		while(basicRhythm[0] == 0){
			rotate(basicRhythm);
		}
	}
	//FOR TESTING/CONSOLE OUT
	post(slots + " slots, " + pulses + " pulses \n");
	for(var i = 0; i < basicRhythm.length; i++){
		post(basicRhythm[i] + " ");
	}
	post("\n");
	//CONSOLE OUT TEST END
	//Set kick binary to basic rhythm:
	var kick = basicRhythm.slice(0);
	//Set standard Snare & HH/Ride binaries, initialize a Tom binary:
	var snare = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
	var hh = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
	//Get the current complexity
	var comp = Math.floor((get16thComplexity(kick) + get16thComplexity(snare) + get16thComplexity(hh))/3);
	//Determine if complexity level needs to be raised or lowered
	var raiseComp = false;
	if(comp < complexity){
		raiseComp = true;
	}
	var randomAction = 0;
	var randomArray = 0;
	var temp = [];
	var stopper = 0;
	var keepModifying = true;
	//Change binary arrays according to complexity (range: 0-100).
	//Adjust complexity points relative to transformative randomized actions *while* there are points left.
	while(keepModifying){
		//Randomly choose to add, move or remove note of random array (kick, hh, snare).
		//The variable "temp" points to the chosen array, so changes are made to the original array.
		randomArray = Math.floor(Math.random()*3);
		randomAction = Math.floor(Math.random()*3);
		switch(randomArray){
			case 0:
				temp = kick;
				break;
			case 1:
				temp = snare;
				break;
			case 2:
				temp = hh;
				break;
		}
		switch(randomAction){
			case 0:
				//Add a note
				var temp2 = addOrRemoveBinNote(temp, raiseComp, true);
				temp = temp2;
				break;
			case 1:
				//Move a note
				temp = moveBinNote(temp, raiseComp);
				break;
			case 2:
				//Remove a note
				temp = addOrRemoveBinNote(temp, raiseComp, false);
				break;
		}
		comp = Math.floor((get16thComplexity(kick) + get16thComplexity(snare) + get16thComplexity(hh))/3);
		if(comp > complexity - 5 && comp < complexity + 5){
			keepModifying = false;
		}
		//Make sure the program does not crash if it takes too many iterations to reach the input complexity
		// and avoid pushing the complexity value too high, because that results in 0101 a lot and does not sound diverse or good.
		//It is still going to *sound* more intense at higher comp.-input levels
		//even if the complexity-endvalue reached by the algorithm is low
		//because the basicRhythm has more pulses if the input complexity is higher.
		if(stopper > 25){
			keepModifying = false;
		}
		stopper++;
	}
	//Transform each "1" to a Note object. Store them in an Array.
	//Position in Array --> Note.index; Instrument MIDI Number --> Note.pitch; default velocity --> 100.
	transformBinToNotes(kick, 36);
	transformBinToNotes(snare, 38);
	var mainHand = 42;
	if(Math.random() < 1/3){
		mainHand = 51;
	} else if(Math.random() < 0.15){
		mainHand = 46;
	}
	transformBinToNotes(hh, mainHand);
	//Establish the back beat, transform the remaining snare notes into ghost notes or tom notes, set velocity values
	addMusicality(complexity, snare);

	//The resulting Note Array will be read by a Max-interactive function (metroIn)
	//in which velocity and pitch will be let out according to their index.
}
function getBackBeatPositions(complexity, snare){
	//Decide which notes are to be the back beat (loud Snaredrum) and return their indices:
	//There can be 1-4 back beat notes.
	//The back beat positions will be determined as follows:
	//If there is a snare note at index 4, next 5, 6 or 7 --> that is a back beat;
	//2nd back beat search at last quarter note => 12, 13, 14 or 15;
	//3rd at first quarter note = index 0, 1, 2 or 3, 4th at 3rd = index 8, 9, 10, 11,
	//5th at 2nd = 4, 5, 6, 7 and so on until the number of back beats "bbCount" is used up.
	//Only one back beat per quarter note is set unless the distribution of snare notes
	//makes it necessary to put more than one back beat in one quarter note.
	//Calculate positions of the backbeat & store the indices in bb array:
	var bb = [];
	var bbCount = 0;
	if(complexity < 30){
		bbCount = Math.floor(Math.random()*2)+1;
	} else {
		bbCount = Math.floor(Math.random()*4)+1;
	}
	var subdiv = 4;
	var quarterUsed = false;
	while(bbCount > 0){
		for(var i = subdiv; i < subdiv + 4; i++){
			if(quarterUsed){
				quarterUsed = false;
				break;
			}
			if(snare[i] == 1){
				bb.push(i);
				bbCount--;
				quarterUsed = true;
			}
		}
		subdiv += 8;
		if(subdiv == 16){
			subdiv = 4;
		} else if(subdiv > 16){
			subdiv = 0;
		}
	}
	return bb;
}
function addMusicality(complexity, snare){
	//This function is meant to add some Tom hits instead of Snare or Hi Hat Notes
	// and to change the velocity of the notes.
	// The binary complexity of the beat doesn't change directly because no notes that were there before are getting removed,
	// they are just being reorchestrated - however, they are on different instrument tracks than before.
	
	//Choose if velocities are to be influenced by the weight of the note position
	//or by the basicRhythm. Probability 1:1
	var velocities = [120, 70, 85, 70, 100, 70, 85, 70, 110, 70, 85, 70, 100, 70, 85, 70];
	var prob = Math.random();
	if(velocityChooser == 0 || (velocityChooser == 1 && prob > 0.5)){
		post("Velocity is based on basic rhythm");
		for(var i = 0; i < basicRhythm.length; i++){
			if(basicRhythm[i] != 0){
				velocities[i] = 110;
				if(i+1 < basicRhythm.length){
					velocities[i+1] = 70;
				} else if(i+2 < basicRhythm.length){
					velocities[i+2] = 85;
				}
			}
		}
	} else {
		post("Velocity is based on absolute positions of notes in bar");
	}
	//Decide which notes are to be the Backbeat (loud Snaredrum)
	var backbeat = getBackBeatPositions(complexity, snare); //[4, 8, 12];
	//Replace pitch and/or adjust velocity
	var p = Math.floor(Math.random()*3); //Only ghost notes, only tom notes or a mix of both
	var p2 = -1;
	notes.forEach(function(note) {
		if(note.pitch == 38 && backbeat.indexOf(note.index) == -1){
			if(p == 3){
				p2 = Math.floor(Math.random()*2);
			}
			if(p == 0 || p2 == 0){
				//Ghost Note
				note.velocity = 45;
			} else if(p == 1 || p2 == 1){
				//Tom notes (3 toms)
				var tomChoice = Math.floor(Math.random()*3);
				switch(tomChoice){
					case 0:
						note.pitch = 50;
						break;
					case 1:
						note.pitch = 48;
						break;
					case 2:
						note.pitch = 43;
						break;
				}
			}
		}
		if(note.pitch == 36){
			note.velocity = 105;
		} else if(note.pitch != 38){
			//Change velocity according to position in bar / index
			note.velocity = velocities[note.index];
			if(note.pitch == 42 || note.pitch == 46 || note.pitch == 51){
				note.velocity -= 25;
			}
		}
	});
}
function moveBinNote(binary, raiseComplexity){
	var temp = addOrRemoveBinNote(binary, raiseComplexity, false);
	temp = addOrRemoveBinNote(temp, raiseComplexity, true);
	return temp;
}
function addOrRemoveBinNote(binary, raiseComplexity, canAdd){
	//Add a note
	var temp = binary;
	var index = 0;
	var isDone = false;
	var comp = get16thComplexity(temp);
	var c = 0;
	var oldVal = 1;
	var newVal = 0;
	if(canAdd){
		oldVal = 0;
		newVal = 1;
		//Emphasize the basic euclidean-/Bjorklund-pattern
		if(basicRhythm.indexOf(1) != -1){
			var j = basicRhythm.indexOf(1);
			basicRhythm[j] = 2;
			binary[j] = 1;
			isDone = true;
		}
	}
	//canAdd => If all slots of the basic pattern have been filled, choose a random slot for a new note.
	//!canAdd => Remove a note.
	var stopper = 0;
	while(!isDone){
		index = Math.floor(Math.random() * binary.length);
		if(temp[index] == oldVal){
			temp[index] = newVal;
			c = get16thComplexity(temp);
			if(raiseComplexity && c > comp){
					isDone = true;
			} else if(!raiseComplexity && c < comp) {
					isDone = true;
			} else {
				temp[index] = oldVal;
			}
		}
		//Make sure the program does not crash if it takes too many iterations to reach the desired outcome
		if(stopper > 5){
			isDone = true;
		}
		stopper++;
	}
	return temp;
}
function get16thComplexity(binary){
	//Calculate current complexity level for a binary array of length 16:
	var comp = 0;
	for(var i = 0; i < binary.length; i+=4){
		var part = [binary[i], binary[i+1], binary[i+2], binary[i+3]];
		comp += getCompValue(part);
		comp += (getCompValue([part[0], part[1]]))/2;
		comp += (getCompValue([part[2], part[3]]))/2;
	}
	//Scale complexity to 100 as max. value
	comp *= 2.5;
	return comp;
}
function getCompValue(binary){
	//Calculate current complexity level for a binary array of length 2 or 4, based on Pressing's Complexity:
	//(Pressing, Jeffrey (1999): Cognitive complexity and the structure of musical patterns. University of Melbourne. Victoria, Australia.)
	
	//The most "complex" beat of length 16 is [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] with complexity = 40
	//because all 8th notes and quarter notes are syncopated.

	//Check for "null" option
	//--> No notes or one single note on the on-beat
	var isEmpty = true;
	for(var i = 1; i < binary.length; i++){
		if(binary[i] != 0){
			isEmpty = false;
		}
	}
	if(isEmpty){
		return 0;
	}
	//Check for "filled" option
	//--> 1 Note at each 8th or each 16th note position
	var isFilled = false;
	if(binary.length == 2){
		if(binary[0] == 1 && binary[1] == 1){
			isFilled = true;
		}
	} else if(binary.length == 4){
		if((binary[0] == 1 && binary[2] == 1 && binary[1] == 0 && binary[3] == 0)
		|| (binary[0] == 1 && binary[1] == 1 && binary[2] == 1 && binary[3] == 1)){
			isFilled = true;
		}
	}
	if(isFilled == true){
		return 1;
	}
	//Check for "run" option
	//--> 1 Note at the 1st position, directly followed by other notes (only applicable for quarter note, not eigth note length)
	if(binary.length == 4){
		if(binary[0] == 1 && binary[1] == 1 && (binary[2] != 1 || binary[3] != 1)){
			return 2;
		}
	}
	//Check for "upbeat" option
	//--> 1 Note at the 1st position and 0 at 2nd position, with 1 or more notes following
	if(binary.length == 4 && binary[0] == 1 && binary[1] == 0
		&& ((binary[2] == 1 || binary[3] == 1) || (binary[2] == 1 && binary[3] == 1))){
		return 3;
	}
	//Check for "syncopated" option
	//--> starts and ends on off-beats
	if(binary[0] == 0){
		return 5;
	}
}

function transformBinToNotes(binary, pitch){
	// This function transforms a binary pattern into Note objects and adds them to the "notes"-Array
	for(var i = 0; i < binary.length; i++){
		if(binary[i] != 0){
			note = new Note(i, pitch, 100);
			notes.push(note);
		}
	}
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
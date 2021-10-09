autowatch = 1;

const path = require('path');
const Max = require('max-api');
const core = require('@magenta/music/node/core');
const mvae = require('@magenta/music/node/music_vae');
const { NoteSequence } = require('@magenta/music/node/protobuf');

var notes = new NoteSequence();
var temp = 0.5; //Temperature value for sequence generation with magenta --> User Parameter
var isGenerating = new Boolean(false);
var isReady = new Boolean(false);
var tapInput = new NoteSequence();
tapInput = core.sequences.quantizeNoteSequence(tapInput, 4);
var tapArr = new Array(16);
function fillTap(){
  tapInput = {
    notes: [
      { pitch: 42, quantizedStartStep: 0, quantizedEndStep: 1, isDrum: true, velocity: 100 },
      { pitch: 42, quantizedStartStep: 4, quantizedEndStep: 5, isDrum: true, velocity: 100 },
      { pitch: 42, quantizedStartStep: 8, quantizedEndStep: 9, isDrum: true, velocity: 100 },
      { pitch: 42, quantizedStartStep: 12, quantizedEndStep: 13, isDrum: true, velocity: 100 }
    ],
    quantizationInfo: {stepsPerQuarter: 4},
    tempos: [{time: 0, qpm: 120}],
    totalQuantizedSteps: 16
  };
}
//Import the Magenta GrooVAE Model.
//Source for the Model:
//Gillick, Jon; Roberts, Adam; Engel, Jesse; Eck, Douglas; Bamman, David (2019):
//Learning to Groove with Inverse Sequence Transformations.
//In: Proceedings of the 36th International Conference on Machine Learning, PMLR 97.
//Available online under https://arxiv.org/pdf/1905.06118, last checked: 12.09.2021.
const model = new mvae.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/groovae/tap2drum_1bar");
model.initialize();
fillTap();
encodeDecode();
Max.post(`Loaded the ${path.basename(__filename)} script`);

// Max Interaction Functions
Max.addHandler("tap", (...args) => {
  tapInput.notes.splice(0, tapInput.notes.length);
  tapArr.length = 0;
  args.forEach(function (num){
    tapArr.push(num);
  });
  listToNotes(tapArr, 36);
  generateSeqNotes();
});

Max.addHandler("metroIn", (metro) => {
  if(isReady){
    if(!isGenerating){
        notes.notes.forEach(function(note) {
          if(note.quantizedStartStep == metro){
            Max.outlet("v", note.velocity);
            Max.outlet("p", note.pitch);
          }
        });
    }
  }
});

Max.addHandler("length", (msg) =>{
  if(notes != null){
	  Max.post(notes.notes.length);
  }
});

Max.addHandler("temperature", (t) =>{
  if(temp != t){
    temp = t;
  }
  generateSeqNotes();
});

Max.addHandler("generate", (msg) =>{
  generateSeqNotes();
});

//Functions for music generation

async function listToNotes(list, p=36){
//Convert a binary list to a NoteSequence. Parameters: List with 0/1 --> a 1 indicates an onset; pitch
for(var i = 0; i < list.length; i++){    
  if(list[i] == 1){
          var n = {
              notes: [
                { pitch: p, quantizedStartStep: i, quantizedEndStep: (i+1), isDrum: true, velocity: 100 }
              ],
              quantizationInfo: {stepsPerQuarter: 4},
              tempos: [{time: 0, qpm: 120}],
              totalQuantizedSteps: 16
            };
          tapInput.notes.push(n.notes[0]);
      }
  };
}

async function encodeDecode(){
  //Convert the input rhythm into a groove.
  var z = await model.encode([tapInput]);
  var newSample = await model.decode(z, temp, undefined, 4, 120);
  newSample[0].notes.forEach(function(note){
    notes.notes.push(note);
  });
  notes = core.sequences.quantizeNoteSequence(notes, 4);
  isGenerating = false;
  isReady = true;
}

async function generateSeqNotes(){
  if(!isGenerating && isReady){
    isGenerating = true;
    Max.post("A new sequence is being generated.");
    notes.notes.splice(0, notes.notes.length);
    if(!model.isInitialized){
      model.initialize();
    }
    encodeDecode();
    
  }
  
}
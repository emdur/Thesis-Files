//INTERPOLATION INDEX AS A USER PARAMETER
//This script generates a random basic beat (2 bars), and a second basic beat that is very unsimilar (similarity=0) to the first.
//It generates x bars worth of sequences to create a transition between those two beats. That is called an "interpolation".
//A user parameter changes the position on the interpolation and the script plays the according sequence.
//Each sequence (at one index position) contains a drum beat that is 2 bars long.

autowatch = 1;

const path = require('path');
const Max = require('max-api');
const core = require('@magenta/music/node/core');
const mvae = require('@magenta/music/node/music_vae');
const { NoteSequence } = require('@magenta/music/node/protobuf');


var temp = 0.8; //Temperature for the generation of the interpolation --> User Parameter
var temp1 = 0; //Temperature for the generation of basicBeat1 w/ magenta --> User Parameter
var temp2 = 1; //Temperature for the generation of basicBeat2 w/ magenta --> User Parameter
var canGenerate = new Boolean(true);
var isGenerating = new Boolean(false);
var isReady = new Boolean(false);
var interpolationPosition = 0; //Current position(/index) in the Interpolation NoteSequence-Array --> User Parameter
var noteSequenceArray = new Array(); //Contains all NoteSequences/ the complete interpolation
var basicBeat = [new NoteSequence(), new NoteSequence()];
var numberOfBars = 100; //Length of interpolation/ Number of bars that will be generated as a transition between basicBeat1 and basicBeat2 --> User Parameter

//The GrooVAE is very good for generating pleasant beats using the sample and similar functions.
//It can't do interpolations, though. The MusicVAE used in this script is meant for interpolations.
//It is also relatively small, which is practical since it is being loaded from the web.

//Source for the GrooVAE:
//Gillick, Jon; Roberts, Adam; Engel, Jesse; Eck, Douglas; Bamman, David (2019):
//Learning to Groove with Inverse Sequence Transformations.
//In: Proceedings of the 36th International Conference on Machine Learning, PMLR 97.
//Available online under https://arxiv.org/pdf/1905.06118, last checked: 12.09.2021.
const groovaeModel = new mvae.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/groovae_2bar_humanize");
//Source for the MusicVAE:
// Roberts, Adam; Engel, Jesse; Raffel, Colin; Hawthorne, Curtis; Eck, Douglas (2019):
// A Hierarchical Latent Vector Model for Learning Long-Term Structure in Music.
// In: ICML.
// Available online under https://arxiv.org/pdf/1803.05428, last checked: 27.09.2021.
const interpolModel = new mvae.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/drums_2bar_hikl_small");

interpolModel.initialize();
groovaeModel.initialize()
  .then(() => generate());

Max.post(`Loaded the ${path.basename(__filename)} script`);

function generate(){
  if(canGenerate){
    Max.post("Generating... Please wait for the 'Ready' message.");
    canGenerate = false;
    isGenerating = true;
    basicBeat = [new NoteSequence(), new NoteSequence()];
    noteSequenceArray = noteSequenceArray.splice(0, noteSequenceArray.length);
    groovaeModel
      //Generate a basic sequence
      .sample(numsamples = 1, temperature = temp1, stepsPerQuarter = 4)
      .then(samples => {
        samples[0].notes.forEach(function(note) {
          basicBeat[0].notes.push(note);
        });
        basicBeat[0].quantizationInfo = samples[0].quantizationInfo;
        basicBeat[0] = core.sequences.quantizeNoteSequence(basicBeat[0], 4);
        Max.post("Basic Beat1 has " + basicBeat[0].notes.length + " notes.");
      })
      //Generate a 2nd basic sequence that is very unsimilar (similarity=0) to the 1st basic sequence
      .then(() => groovaeModel.similar(inputSequence = basicBeat[0], numsamples = 1, similarity = 0, temperature = temp2, stepsPerQuarter = 4))
      .then(samples => {
        samples[0].notes.forEach(function(note) {
          basicBeat[1].notes.push(note);
        });
        basicBeat[1].quantizationInfo = samples[0].quantizationInfo;
        basicBeat[1] = core.sequences.quantizeNoteSequence(basicBeat[1], 4);
        Max.post("Basic Beat2 has " + basicBeat[1].notes.length + " notes.");
      })
      //Generate the interpolation sequences
      .then(() => Max.post("Interpolating..."))
      .then(() => interpolModel.interpolate(basicBeat, numberOfBars, temp))
      .then(samples => {
        var index = 0;
        samples.forEach(function(sample){
          noteSequenceArray[index] = new NoteSequence();
          sample.notes.forEach(function(note) {
            noteSequenceArray[index].notes.push(note);
          });
          index++;
        });
      })
      .then(() => isGenerating = false)
      .then(() => canGenerate = true)
      .then(() => isReady = true)
      .then(() => Max.post("Ready :-)"))
      ;
    }
}

Max.addHandler("length", (msg) =>{
  //Max Console Output: Number of notes of each NoteSequence in the interpolation
  var i = 0;
  while(i < noteSequenceArray.length){
    Max.post(noteSequenceArray[i].notes.length);
    i++;
  }
});
Max.addHandler("generate", (msg) =>{
  //Generate a new interpolation sequence
	generate();
});
Max.addHandler("numBars", (num) =>{
  //Length of the interpolation
	numberOfBars = num;
});
Max.addHandler("interpolationPosition", (ip) =>{
  //Position on the interpolation-bridge.
  //This decides which NoteSequence's notes are being put out by the metroIn-Function.
  if(ip >= numberOfBars){
    interpolationPosition = numberOfBars-1;
  } else {
    interpolationPosition = Math.floor(ip);
  }
});
Max.addHandler("temperature", (t) =>{
  //Temperature for the generation of the interpolation sequence
  temp = t;
});
Max.addHandler("temp1", (t) =>{
  //Temperature for the generation of basicBeat 1
  temp1 = t;
});
Max.addHandler("temp2", (t) =>{
    //Temperature for the generation of basicBeat 2
  temp2 = t;
});

var noteStartIndex = 0;
Max.addHandler("metroIn", (metro) => {
  if(isReady){
    if(!isGenerating){
      if(metro == 15){
        if(noteSequenceArray[interpolationPosition].notes[noteSequenceArray[interpolationPosition].notes.length-1].quantizedStartStep > metro + noteStartIndex){
          noteStartIndex+=16;
        } else if(metro + noteStartIndex > noteSequenceArray[interpolationPosition].notes[noteSequenceArray[interpolationPosition].notes.length-1].quantizedStartStep){
          noteStartIndex = 0;
        }
      }
      noteSequenceArray[interpolationPosition].notes.forEach(function(note) {
        if(note.quantizedStartStep == metro + noteStartIndex){
          //Max.post("step " + note.quantizedStartStep + " pitch " + note.pitch); //Post all notes that are being sent out
          //There is no velocity output, since the interpolation model can't generate those.
          Max.outlet("p", note.pitch);
        }
     });
    }
  }
});
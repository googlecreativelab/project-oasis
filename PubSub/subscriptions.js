/*
Copyright 2018 Google LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


/*
*
* This file listens to pull subscriptions from Cloud PubSub.
* Pubsub notification here are received as a JSON
* 
* Dialoglfow parses user language for city/location, time -> Gets weather data from external api -> 
* Forms a JSON for rain/mist levels -> And pushes to corresponding PubSub Topic/Subscription
* JSON FORMAT
* e.g: 'Welcome' messages trigger the terrarium lights, 
*      '{,rainConditions: 1,..}' 1, 2 or 3 define the amount of rain (light, medium, heavy(. We then set the specific seconds duration here
*      '{, mistMakerDuration: 0, ...}' 0, 3 or 5 define the duration misting should be active for. You can also change the second duration here 
        but we're currently using the second duration directly.
*       '{lightConditions: blue,...}' blue, lightyellow, orange, fullyellow, off are the colors received as per the current temperature
* TODO: Just receive city/location/action from dialog flow function and decouple dialogflow and PubSub listener. Parse weather on local RPi instead of cloud function.
* 
*/
'use strict';

//Flow: Lights -> Mist -> Rain with intervals between each
//Misting and Rain do not run continously because that would flood the terrarium with water or fill with dense fog.
//Instead they are switched on/off corresponding to the conditions while running for the total routine duration
//e.g: Heavy rain would mean smaller time offset between rain pump swtiching off and coming back on
var mistTimeOffset = 3000; //w.r.t light - time after light starts
var mistOntime = 5000; var mistOffTime = 10000;

var rainTimeOffset = 6000; //w.r.t light - time to start rain after light starts
var rainOntime = 5000; var rainOffTime = 10000;

//Time an interval should run for aftser user's inpput
var runningTime = 60 * 1000;

var rainIntervalFunc;  var mistIntervalFunc;
var userInputActive = false;
var terrariumRoutineFunc;

var deployMode = false;

//RainCodes, LightCodes and MistCodes are the shared between this JS Listener and Arduino 
//lightCodes: a (blue), b (lightyellow), c (fullyellow), d(yelloworange), e(off)
//rainCodes: h (rain), i (no rain) -- timing selected based on intesity coming through terrariumStatus
//mistCodes: m (mist), n (no mist) -- timing selected based on intensity coming through terrariumStatus
//On/off triggers from this NODEJS are written to Arduino over serial

var lightCodes = {
	blue: "a",
	lightyellow : "b",
	fullyellow: "c",
	yelloworange: "d",
	off: "e",
	fadedwhite: "f"
};

var rainCodes = {
	on: "h",
	off: "i"
};

var mistCodes = {
	on: "m",
	off: "n"
};

///// ARDUINO /////
const SerialPort = require('serialport');
var port;

//If you don't have an Arduino and are just working the logic/timings, deployMode is set false
//set to true when ready to test with arduino
if(deployMode){
  //CHANGE this to your serilal port. On RPi, run ls /dev/tty* to find your serial port #
  port = new SerialPort('/dev/tty.usb0');
}

function onOpen() {
  console.log('Port Open');  
}

function onData(data) {
  console.log(`Received:\t${data}`);
}

function onClose() {
  console.log('Port Closed');
  process.exit(1);
}

function onError(error) {
  console.log(`There was an error with the serial port: ${error}`);
  process.exit(1);
}

port.on('open', onOpen);
port.on('data', onData);
port.on('close', onClose);
port.on('error', onError);	


//// PUBSUB SUBSCRIPTION LISTENER ////
function listenForMessages(subscriptionName, timeout) {
  const PubSub = require(`@google-cloud/pubsub`);
  const pubsub = new PubSub();

  const subscription = pubsub.subscription(subscriptionName);

  // Create an event handler to handle messages
  let messageCount = 0;
  const messageHandler = message => {
  console.log(`Received message ${message.id}:`);
  console.log(`\tData: ${message.data}`);

  var dataStr = message.data.toString();

  //Dim white lights come on when the user just starts interaction with the terrarium
  if(dataStr == "welcome"){
  	suspendAll(); //everything else that was running before should be stopped as the user starts interacting

  	lightsRoutine("on", "fadedwhite"); //welcome faded white light
  	userInputActive = true;
  }else {
  	userInputActive = true;
  	triggerTerrarium(message.data);
  }

    console.log(`\tAttributes: ${message.attributes}`);
    messageCount += 1;

    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.on(`message`, messageHandler);
}

function terrariumRoutineControl(){
	if(userInputActive == false){
		// terrariumRoutineFunc = setInterval( 
			//start the function here to check weather and send triggre request
			// );
	}else{
		// clearInterval(terrariumRoutineFunc);
	}
}

function triggerTerrarium(data){
	var terrariumStatusResponseObj = JSON.parse (data);

  	if( terrariumStatusResponseObj['mistMakerDuration'] != undefined &&
	 	terrariumStatusResponseObj['rainConditions'] != undefined && 
 	 	terrariumStatusResponseObj['lightConditions'] != undefined){

    suspendAll(); //stop all components before starting new terrarium actions
		
    //light -> mist -> rain flow
		lightsRoutine("on", terrariumStatusResponseObj['lightConditions']);
		setTimeout(lightsRoutine, runningTime, "off");
		

  		if(terrariumStatusResponseObj['mistMakerDuration'] > 0 ){
    		setTimeout(mistRoutine, mistTimeOffset, "on", terrariumStatusResponseObj['mistMakerDuration'] * 1000, mistOffTime); //mist will start in 3 seconds
  			setTimeout(mistRoutine, runningTime - mistTimeOffset, "off");
  		}


  		if(terrariumStatusResponseObj['rainConditions'] == 1 ){
  			rainOntime = 10 * 1000;
  			rainOffTime = 10* 1000;
  		}else if ( terrariumStatusResponseObj['rainConditions'] == 2){
  			rainOntime = 20 * 1000;
  			rainOffTime = 15 * 1000;
  		}else if ( terrariumStatusResponseObj['rainConditions'] == 3){
  			rainOntime = 30 * 1000;
  			rainOffTime = 20 * 1000;;
  		}

		if(terrariumStatusResponseObj['rainConditions'] > 0 ){
  			setTimeout(rainRoutine, rainTimeOffset, "on", rainOntime, rainOffTime); 
  			setTimeout(rainRoutine, runningTime - rainTimeOffset, "off"); 
  		}
    }
}

function rainRoutine(status, onInterval, offInterval){
  
  var rainOnTime = 0; var rainOffTime = 0; var currStatus = 0; 

  if(status == "on"){
    //start the on/off loop for the rain electronics
    currStatus = 1; //change to on status for the local loop
    
    //run every second
    rainIntervalFunc = setInterval(function() {

      if(currStatus == 1){
        if(deployMode){
          port.write(rainCodes["on"]);
        }else{
          console.log(rainCodes["on"]); 
        }
        
        rainOnTime += 1000;
        if(rainOnTime > onInterval){
          currStatus = 0;
          rainOnTime = 0;
        }
      }

      if(currStatus == 0){
        if(deployMode){
          port.write(rainCodes["off"]);
        }else{
          console.log(rainCodes["off"]);  
        }
        
        
        rainOffTime += 1000;
        if(rainOffTime > offInterval){
          currStatus = 1;
          rainOffTime = 0;
        }
      }

    }, 1000);


  }else{
    if(deployMode){
      port.write(rainCodes["off"]);
    }

    clearInterval(rainIntervalFunc);

    rainOnTime = 0; var rainOffTime = 0; currStatus = "off";
  }
}

function mistRoutine(status, onInterval, offInterval){
  
  var mistOntime = 0; var mistOffTime = 0; var currStatus = 0;

  if(status == "on"){
    //start the on/off loop for the mist electronics
    currStatus = 1; //change to on status for the local loop
    
    //run every second
    mistIntervalFunc = setInterval(function() {

      if(currStatus == 1){
        if(deployMode){
          port.write(mistCodes["on"]);
        }else{
          console.log(mistCodes["on"]);
        }
        
        
        
        mistOntime += 1000;
        if(mistOntime > onInterval){
          currStatus = 0;
          mistOntime = 0;
        }
      }

      if(currStatus == 0){
        if(deployMode){
          port.write(mistCodes["off"]);
        }else{
          console.log(mistCodes["off"]);  
        }
        
        mistOffTime += 1000;
        if(mistOffTime > offInterval){
          currStatus = 1;
          mistOffTime = 0;
        }
      }

    }, 1000);


  }else{
    if(deployMode){
      port.write(mistCodes["off"]);
    }

    clearInterval(mistIntervalFunc);
    mistOntime = 0; var mistOffTime = 0; currStatus = "off";
  }
}

function lightsRoutine(status, lightType){
//lightCodes: a (blue), b (lightyellow), c (fullyellow), d(yelloworange), e(off)
	if(status == "on"){
		if(deployMode){
			port.write(lightCodes[lightType]);	
		}else{
			console.log(lightCodes[lightType]);		
		}
	}else{
		if(deployMode){
			port.write(lightCodes[status]);
		}else{
			console.log(lightCodes[status]);
		}
	}
}

function suspendAll(){
	if(deployMode){
		port.write(rainCodes["off"]);
		port.write(mistCodes["off"]);
		port.write(lightCodes["off"]);
	}
}

const cli = require(`yargs`)
  .demand(1)
  .command(
    `listen-messages <subscriptionName>`,
    `Listens to messages for a subscription.`,
    {
      timeout: {
        alias: 't',
        type: 'number',
        default: 10,
      },
    },
    opts => listenForMessages(opts.subscriptionName, opts.timeout)
  )
  .command(
    `listen-errors <subscriptionName>`,
    `Listens to messages and errors for a subscription.`,
    {
      timeout: {
        alias: 't',
        type: 'number',
        default: 10,
      },
    },
    opts => listenForErrors(opts.subscriptionName, opts.timeout)
  )

if (module === require.main) {
  cli.help().strict().argv; // eslint-disable-line
}
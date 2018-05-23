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

'use strict';

/*
* Dialoglfow parses user language for city/location, time -> Gets weather data from external api -> 
* Forms a JSON for rain/mist levels -> And pushes to corresponding PubSub Topic/Subscription
*
* We export functions to associate with user actions on Google Assistant. 
* Refer to https://dialogflow.com/docs/getting-started/basic-fulfillment-conversation for basic conversation and fulfillment setup
* Each function calls a PubSub client to publish the status to the terrarium. Refer to firebase cloud function logs for console.log() information of your webfunctions
* A NodeJS listener in the RPi of the terrarium is listening to these messages, which are further mapped to serial codes for Arduino
* 
* 
* JSON FORMAT
* e.g: 'Welcome' messages trigger the terrarium lights, 
*      '{,rainConditions: 1,..}' 1, 2 or 3 define the amount of rain (light, medium, heavy(. We then set the specific seconds duration here
*      '{, mistMakerDuration: 0, ...}' 0, 3 or 5 define the duration misting should be active for. You can also change the second duration here 
        but we're currently using the second duration directly.
*       '{lightConditions: blue,...}' blue, lightyellow, orange, fullyellow, off are the colors received as per the current temperature
* We use openweatherapi to get the weather information. You will need an apikey to hit their server and get a response
* 
*/


process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const requestMod = require('request');

/********************************************************/
//PUBSUB Integration
// --> Publishing Only --- from webhook middleware firebase functions//
//The 
//We created a 'WEATHER' Topic in the GCloud PubSub project, under which all subscriptions were created
// Refer to https://cloud.google.com/pubsub/docs/quickstart-console on how to create topic and subscription

const PubSub = require(`@google-cloud/pubsub`);
//FILL YOUR GCLOUD PROJECT ID HERE
const projectId = 'xxxxxxxxxxx';
const pubsubClient = new PubSub({
  projectId: projectId,
});

const pubWeatherTopic = "WEATHER"; 
/********************************************************/


//ASSISTANT INTEGRATION//
// a. the action name from the make_name Dialogflow intent
const WEATHER_ACTION = 'weatherreport'; //weather of a certain place, e.g: weather in seattle
const WELCOME_ACTION = 'welcome'; //understanding when a user starts interacting (hey google, talk to the terrarium ...), so terrarium can a light up as if listening
const CSR_ACTION = 'exp_csr_actions'; //e.g: make it rain, make it cloudy

// b. the parameters that are parsed from the make_name intent
const CITY_ARGUMENT = 'geo-city';
const DATE_ARGUMENT = 'date';
const ANY_ARGUMENT = 'any';

// Webhook URL
// Refer to https://dialogflow.com/docs/getting-started/basic-fulfillment-conversation for basic conversation and fulfillment setup
// on how to generate your webhook function url

//This function is exported and used by the assistant to listen/respond to user queries
exports.naturebox = functions.https.onRequest((request, response) => {
const app = new App({request, response});

function welcome(app){
    console.log("Issuing Welcome Call");
    const dataBuffer = Buffer.from("welcome"); 

    pubsubClient
      .topic(pubWeatherTopic)
      .publisher()
      .publish(dataBuffer)
      .then(results => {
      const messageId = results[0];
      console.log(`Message ${messageId} published.`);

      app.ask('What would you like to know?');
      })
      .catch(err => {
        console.error('ERROR:', err);
      });
     
  }

function cloudrainsunaction(app){
    let actionType = app.getArgument(ANY_ARGUMENT);

    if (actionType != null){

      console.log("Issuing explicit CSR Action");

      var terrariumStatus = {};
      terrariumStatus["mistMakerDuration"] = 0;
      terrariumStatus["rainConditions"] = 0;
      terrariumStatus["lightConditions"] = "off";

      switch(actionType.toLowerCase()){
        case 'rain':
        {
          terrariumStatus["rainConditions"] = 1;
        }
        break;
        case 'clouds':
        case 'cloudy':
        {
          terrariumStatus["mistMakerDuration"] = 3;
        }
        break;
        case 'sun':
        case 'sunny':
        { 
          terrariumStatus["lightConditions"] = "yellow";
        }
        break;
      }

      var terrariumStatusStr = JSON.stringify(terrariumStatus);
      const dataBuffer = Buffer.from(terrariumStatusStr);


      pubsubClient
        .topic(pubWeatherTopic)
        .publisher()
        .publish(dataBuffer)
        .then(results => {
        const messageId = results[0];
        console.log(`Message ${messageId} published.`);

        app.ask('Sure');
          console.log(Date.now());
        })
        .catch(err => {
          console.error('ERROR:', err);
        });
    }

  }

  function weatherreport(app){
    let apiKey = 'xxxxxxxxxxx'; //ADD your openweathermap API key here

    let voicedate = app.getArgument(DATE_ARGUMENT);
    let voicecity = app.getArgument(CITY_ARGUMENT);

    let city = 'new york'; //default city

    if(voicecity != null){
      city = voicecity;
    }

    //Ping the openweather API to find clouds, rain, light status
    let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`

    requestMod(url, function(err, response, body) {
    if (err) {
      console.log('error:', error);
    } else {
    var weatherRepsonseJSON = JSON.parse(body);

    if (weatherRepsonseJSON.weather != undefined) {
      var lightAndRain = weatherRepsonseJSON.weather[0].description;
      var cloudNum = weatherRepsonseJSON.clouds.all;
      var avgTemperature = weatherRepsonseJSON.main.temp;

      //Defaults for rain, clouds, light
      var currentTime = Math.floor(new Date() / 1000);
      var mistMakerDuration = 0;
      var rainConditions = 0;
      var lightConditions = "off";
      avgTemperature = avgTemperature - 273; //convert to C

      //mist maker
      if (cloudNum < 30) {
        mistMakerDuration = 0;
      } else if (cloudNum >= 30 && cloudNum < 70) {
        mistMakerDuration = 3;
      } else if (cloudNum >= 70) {
        mistMakerDuration = 5;
      }

      //rain conditions
      if (lightAndRain == "shower rain" || lightAndRain == "light rain") {
        rainConditions = 1;
        lightConditions = "blue";
      } else if (lightAndRain == "rain" || lightAndRain == "moderate rain") {
        rainConditions = 2;
        lightConditions = "blue";
      } else if (lightAndRain == "thunderstorm") {
        rainConditions = 3;
        lightConditions = "blue";
      } else if (lightAndRain == "fog" || lightAndRain == "mist") {
        mistMakerDuration = 5;
        lightConditions = "blue";
      }

      //light conditions
      if (lightAndRain == "thunderstorm") {
        lightConditions = "thunderstorm";
      } 
      else if (lightAndRain == "clear sky" || lightAndRain == "broken clouds") { //clear and night
        //check if it is b/w sunrise and sunset time
        if (currentTime > weatherRepsonseJSON.sys.sunrise && currentTime < weatherRepsonseJSON.sys.sunset) {
          //find a light as per temperature

          if (avgTemperature <= 5) {
            lightConditions = "blue";
          } else if (avgTemperature > 5 && avgTemperature < 12) {
            lightConditions = "lightyellow";
          } else if (avgTemperature >= 12 && avgTemperature < 20) {
            lightConditions = "fullyellow";
          } else if (avgTemperature >= 20) {
            lightConditions = "yelloworange";
          }

        } else {
          lightConditions = "off";
        }
      }

    var terrariumStatus = {};
    terrariumStatus["mistMakerDuration"] = mistMakerDuration;
    terrariumStatus["rainConditions"] = rainConditions;
    terrariumStatus["lightConditions"] = lightConditions;

    var terrariumStatusStr = JSON.stringify(terrariumStatus);
    const dataBuffer = Buffer.from(terrariumStatusStr);

    console.log("Issuing PubSub Call");

    pubsubClient
      .topic(pubWeatherTopic)
      .publisher()
      .publish(dataBuffer)
      .then(results => {
      const messageId = results[0];
      console.log(`Message ${messageId} published.`);

      app.tell('Reported');
      })
      .catch(err => {
        console.error('ERROR:', err);
      });
     } 

     else {
        console.log("City not found");
      }

     }  
    });

  }

  //mapping all the exported functions (cloud functions to assistant actions. assistant calls corresponding functions after questions/requests by user)
  let actionMap = new Map();
  actionMap.set(WEATHER_ACTION, weatherreport); //weather of a certain place, e.g: weather in seattle
  actionMap.set(WELCOME_ACTION, welcome); //understanding when a user starts interacting (hey google, talk to the terrarium ...), so terrarium can a light up as if listening
  actionMap.set(CSR_ACTION, cloudrainsunaction); //e.g: make it rain, make it cloudy


app.handleRequest(actionMap);
});


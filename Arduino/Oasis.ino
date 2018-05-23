//Copyright 2018 Google LLC.
//
//Licensed under the Apache License, Version 2.0 (the "License");
//you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//
//https://www.apache.org/licenses/LICENSE-2.0
//
//Unless required by applicable law or agreed to in writing, software
//distributed under the License is distributed on an "AS IS" BASIS,
//WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//See the License for the specific language governing permissions and
//limitations under the License.

#include "terrariumComponents.h"

/*
 * The current terrarium components include mist maker, rain maker 
 * and lighting modules. The relays for the same are switched on/off 
 * based on the notifications from Cloud PubSub subscription listener.
 * The PubSub listener dispatches on/off/status notifications via serial
 * that the Arduino relays respond to. 
 * 
 * RPi is used to  have a Google AIY Voice Kit 
 * inside the terrarium. Arduino Nano connected via USB for serial transfer 
 * from Raspberry Pi 3. 
 */
 
void setup() {
  //Relay pins for switching power to MistMaker, Peristaltic Pump(s)
  pinMode(mistMakerPeristalticRelay, OUTPUT);
  pinMode(rainMakerPeristalticRelay, OUTPUT);
  pinMode(mistMakerCeramicsRelay, OUTPUT);
  pinMode(ceilingLED, OUTPUT);
 
  Serial.begin(9600);
 
  strip.begin();
  strip.show(); // Initialize all pixels to 'off'
}

//Serial codes are shared from NodeJS listener and Arduino. Note the codes here
//light is calculated based on temperature of day
//lightCodes: a (blue), b (lightyellow), c (fullyellow), d(yelloworange), e(off)
//rainCodes: h (on), i (off)
//mistCodes: m (on), n (off)
//mistPump: u(on), v(off)

void loop() {
 
  // send data only when you receive data:
  if (Serial.available() > 0) {
     // read the incoming byte:
 
     incomingByte = Serial.read();
     Serial.println(incomingByte, DEC);
 
      switch (incomingByte){
         case 'h':
         {
           digitalWrite(rainMakerPeristalticRelay, HIGH);
         }
         break;
         case 'i':
         {
           digitalWrite(rainMakerPeristalticRelay, LOW);
         }
         break;
         case 'u':
         {
           digitalWrite(mistMakerPeristalticRelay, HIGH);
         }
         break;
         case 'v':
         {
           digitalWrite(mistMakerPeristalticRelay, LOW);
         }  
         break;
         case 'm':
         {
           digitalWrite(mistMakerCeramicsRelay, HIGH);
         }
         break;
         case 'n':
         {
           digitalWrite(mistMakerCeramicsRelay, LOW);
         }
         break;
         case 'a':
         {
           colorWipe(strip.Color(255,255,255), 5); //blue
         }
         break;
         case 'b':
         {
           colorWipe(strip.Color(130,50,0), 5); //light yellow
         }
         break;
         case 'c':
         {
           colorWipe(strip.Color(255,127,0), 5); //full yellow
         }
         break;
         case 'd':
         {
           colorWipe(strip.Color(255,60,0), 5); //yellow orange
         }
         break;
         case 'e':
         {
           colorWipe(strip.Color(0,0,0), 5);
         }
         break;
         case 'f':
         {
           colorWipe(strip.Color(63,63,63), 5);
         }
         break;
         
      }
   }
}
 
// Fill the dots one after the other with a color
void colorWipe(uint32_t c, uint8_t wait) {
  for(uint16_t i=0; i<strip.numPixels(); i++) {
    strip.setPixelColor(i, c);
    strip.show();
    delay(wait);
  }
 
}

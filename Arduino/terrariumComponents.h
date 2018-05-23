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

#ifndef _TCOMPONENTS_
#define _TCOMPONENTS_

#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

//5-24V Peristaltic Pump [Rain Water Dispenser]
//Externally controlled voltage can control the flow rate of the rain
//Relay at pin switches rain pump supply on/off
int rainMakerPeristalticRelay = 5;

//12V Perdistaltic Pump [Mist Maker Water Dispenser]
//This auxiliary pump ocaasionally fills up the water for the misting modules
int mistMakerPeristalticRelay = 7;

//5V Mist Maker modules
//This relay swtiches the driver board supply on/off
int mistMakerCeramicsRelay = 8;

//5V Neopixel High Intensity LEDs
//Neopixel library switches LEDs on/off
int ceilingLED = 4;

Adafruit_NeoPixel strip = Adafruit_NeoPixel(114, ceilingLED, NEO_GRB + NEO_KHZ800);

//Incoming Serial Byte Messages from Cloud PubSub [NodeJS Listener running on RPi3]
int incomingByte = 0;   // for incoming serial data

#endif

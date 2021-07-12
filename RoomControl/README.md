## Room Control 

Turn on/off lights/outlets based on light switch, time of day, day of week, and contact sensors

## File Structure

* smartapp.js &mdash; the SmartApp implementation (also in typescript)
* locales/en.json &mdash; English version of the app configuration page text

## Node Package Dependencies
1. npm i @smartthings/smartapp --save
2. npm i @katesthings/smartutils --save
3. npm i @katesthings/smartcontrols --save

## DynamoDB Table Elements
**smart-room-settings**
* _startTime_: time settings start
* _endTime_: time settings end
* _endBehavior_: behavior at end time (mainOff, mainCheck, groupOff)

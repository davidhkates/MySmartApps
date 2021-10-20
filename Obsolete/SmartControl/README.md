## SmartControl 

Control room based on settings in smart_room_settings DynamoDB table

## File Structure

* smartapp.ts &mdash; the SmartApp implementation
* locales/en.json &mdash; English version of the app configuration page text

## Node Package Dependencies
1. npm i @smartthings/smartapp --save
2. npm i @katesthings/smartutils --save
3. npm i @katesthings/smartcontrols --save

## DynamoDB Table Elements
**smart-room-settings**
* _startTime_: time settings start
* _endTime_: time settings end (if not specified, treated as event timer)
* _daysOfWeek_: days of week for time settings (R=THURSDAY, U=SUNDAY)
* _switchBehavior_: behavior of other controls when main switch pressed ('on', 'off')
* _onBehavior_: what to do when room switch is turned on (groupOn)
* _offBehavior_: what to do when room switch is turned off (groupOff)
* _switchDelay_: delay after room switch is turned off for switch off behavior (in seconds)
* _startBehavior_: what to do when motion in room starts (roomOn)
* _stopBehavior_: what to do when motion in room stops (roomOff)
* _stopDelay_: delay after motion stops for stopBehavior (in seconds)
* _openBehavior_: what to do when contact(s) in room are opened (allOn, allOff, anyOn, anyOff)
* _closeBehavior_: what to do when contact(s) in room are closed (allOn, allOff, anyOn, anyOff)
* _contactDelay_: delay after contact(s) are open/closed for relevant behavior

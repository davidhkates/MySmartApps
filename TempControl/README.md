# Fan Control

Control fan switch based on room temperature, door/window sensors, and time of day/day(s) of week


## File Structure

* smartapp.ts &mdash; the SmartApp implementation
* locales/en.json &mdash; English version of the app configuration page text

## Node Package Dependencies

* npm i @smartthings/smartapp --save
* npm i @aws-sdk/client-dynamodb --save
* npm i @katesthings/smartdevice --save
* npm i @katesthings/smartutils --save
* npm i @katesthings/smartstate --save

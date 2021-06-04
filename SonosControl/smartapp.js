// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
// const SmartSensor = require('@katesthings/smartcontrols');
// const SmartUtils  = require('@katesthings/smartutils');

const axios = require("axios");

// HTTPS get request to authenticate Sonos
const http  = require('http');
const https = require('https');

const uriWeather = 'http://api.openweathermap.org/data/2.5/weather?q=Denver&appid=178796e24e49d001f0999f866eb7eb52';
const authClient = 'd313a2a0-960e-481f-9fc7-3c02e4366955';
const authCode = 'abcdef';
const authRedirect = '&redirect_uri=https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const uriSonosAuthRequest = 'https:///login/v3/oauth?response_type=code&state=testState&scope=playback-control-all&client_id=' + authClient + authRedirect;
const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code=' + authCode + authRedirect;

/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// enable/disable control, motion delay setting
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled')
			.defaultValue(true)
			.required(true);
		section.deviceSetting('mainSwitch')
			.capabilities(['button','switch'])
			.required(true)
			.permissions('rx');
		/*
		section.soundSetting('roomSound')
			.permissions('rx');
		section.deviceSetting('roomSpeaker')
			.capabilities(['audioVolume'])
			.permissions('rx');
		*/
	});
	
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("SonosControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (controlEnabled) {
		const uri = 'http://www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new';
		const getData = async uri => {
  			try {
    				const response = await axios.get(uri);
    				// const data = response.data;
    				console.log('Response from call to random.org: ', response.data);
  			} catch (error) {
    				console.log(error);
  			}
		};
		getData(uri);
	}
	
	console.log('SonosControl: END CREATING SUBSCRIPTIONS')
})

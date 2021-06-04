// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
// const SmartSensor = require('@katesthings/smartcontrols');
// const SmartUtils  = require('@katesthings/smartutils');

// HTTPS get request to authenticate Sonos
// const http  = require('http');
// const https = require('https');
const axios = require("axios");

const uriRandom = 'http://www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new';
const uriWeather = 'http://api.openweathermap.org/data/2.5/weather?q=Denver&appid=178796e24e49d001f0999f866eb7eb52';
const sonosClientID = 'd313a2a0-960e-481f-9fc7-3c02e4366955';
const sonosToken = '';
// const sonosRedirect = 'https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const sonosRedirect = encodeURI('https://m4bm3s9kj5.execute-api.us-west-2.amazonaws.com/dev/callback');
const authRedirect = '&redirect_uri=https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosToken + '&redirect_uri=' + sonosRedirect;

/*
const instance = axios.create({
  baseURL: 'https://some-domain.com/api/',
  timeout: 1000,
  headers: {'Authorization': 'Bearer '+token}
});

instance.get('/path')
.then(response => {
    return response.data;
})
*/

function getURI( uri ) {
	axios.get(uri).then(response => {
		console.log('Axios response: ', response.data);
		return response.data;
	});
};

function postURI( uri, token ) {
	const config = {
    		headers: { Authorization: 'Bearer ' + token }
	};
	
	const bodyParameters = {
		key: "value"
	};

	axios.post(uri, bodyParameters, config).then(resp => {
		console.log('Axios response: ', resp.data);
	}.catch(console.log);
};
	

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
		const response = await getURI(uriRandom);
		console.log('Response from web service: ', response);
	}
	
	console.log('SonosControl: END CREATING SUBSCRIPTIONS')
})

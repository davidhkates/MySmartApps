// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
// const SmartSensor = require('@katesthings/smartcontrols');
// const SmartUtils  = require('@katesthings/smartutils');

const axios = require("axios");

// HTTPS get request to authenticate Sonos
const http  = require('http');
const https = require('https');

const requestWeather = {
	hostname: 'api.openweathermap.org',
	port: 80,
  	path: '/data/2.5/weather?q=Denver&appid=178796e24e49d001f0999f866eb7eb52',
	method: 'GET'
	/*
	headers: {
    		'Content-Type': 'application/json'
    		// 'Content-Length': Buffer.byteLength(postData)
		// 'Content-Length': 1024
	}
  	*/
};


	
/*
var uriRequest = '/login/v3/oauth';
var uriParams = '&response_type=code&state=testState&scope=playback-control-all'
const authClient = 'd313a2a0-960e-481f-9fc7-3c02e4366955';
const authRedirect = '&redirect_uri=https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
var uriPath = uriRequest + '?client_id=' + authClient + uriParams + authRedirect;

const sonosAuthRequest = {
  hostname: 'api.sonos.com',
  port: 443,
  path: uriPath,
  method: 'GET'
}

// Create token request parameters
const uriRequest = '/login/v3/oauth/access';
const uriParams = '&grant_type=authorization_code&code={auth_code}&redirect_uri={redirect_uri}';

const sonosCreateToken = {
  hostname: 'api.sonos.com',
  port: 443,
  path: uriPath,
  method: 'POST'
}

function sonosCall(request) {
	const req = https.request(request, res => {
		console.log(`statusCode: ${res.statusCode}`)

		res.on('data', d => {
			console.log(d)
		})
	})

	req.on('error', error => {
  		console.error(error)
	})

	req.end()
}
*/


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
		console.log('Making http request to: ', requestWeather);

		const uri = 'http://www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new';
		const getData = async url => {
  			try {
    				const response = await axios.get(uri);
    				const data = response.data;
    				console.log(data);
  			} catch (error) {
    				console.log(error);
  			}
		};

		/*
		http.get(uri, (resp) => {
  			let data = '';

  			// A chunk of data has been received.
  			resp.on('data', (chunk) => {
    				data += chunk;
  			});

  			// The whole response has been received. Print out the result.
  			resp.on('end', () => {
    				// console.log(JSON.parse(data).explanation);
    				console.log('Response: ', data);
  			});

		}).on("error", (err) => {
  			console.log("Error: " + err.message);
		});		
		*/
		
		console.log('Http request completed');

		/*
		// http.request(requestWeather, (res) => {
		https.get('https://encrypted.google.com/', (res) => {
			console.log('statusCode:', res.statusCode);
			console.log('headers:', res.headers);

			res.on('data', (d) => {
				process.stdout.write(d);
			});

			}).on('error', (e) => {
  				console.error(e);
		});
		// sonosCall(sonosAuthRequest);
		*/
	}
	console.log('SonosControl: END CREATING SUBSCRIPTIONS')
})

//---------------------------------------------------------------------------------------
// Sonos Control - control sonos speaker(s) from light switch
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');
const axios = require('axios');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
// const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');
const SmartSonos  = require('@katesthings/smartsonos');

// SmartApp type definitions
interface device {
	[value: string]: any
}

// var aws = require('aws-sdk');
// aws.config.update({region: 'us-west-2'});

// Remove console log and console error outputs when not debugging
/*
// console.log('NODEJS environment variable(s): ', process.env);
// if (process.env.NODE_ENV == "production") {
    console.log = function(){}; 
    console.error = function(){}; 
// }
*/


//---------------------------------------------------------------------------------------
// Sonos Utility Functions - use control API to stop/start speakers
//---------------------------------------------------------------------------------------

// Store stateful Sonos data in DynamoDB home setting table
async function getSonosData( key ) {
	return await SmartState.getHomeMode( 'niwot', 'sonos-' + key );
};

async function putSonosData( key, value ) {
	await SmartState.putHomeMode( 'niwot', 'sonos-' + key, value );
};

// Refresh access token
async function refreshToken() {

	// declare access token variable to be returned
	let accessToken;
	
	try {
		// create axios sonos control object
		const refreshToken = await SmartState.getSonosData('refresh-token');
		console.log('refreshToken - retrieved refresh token: ', refreshToken);
			
		const urlToken = 'https://api.sonos.com/login/v3/oauth/access';

		const params = new URLSearchParams();
		params.append('grant_type', 'refresh_token');
		params.append('refresh_token', refreshToken);
		// params.append('redirect_uri', 'https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Fauth-callback');
		console.log('refreshToken - initialized parameters: ', params);
	
		const config = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg=='
			}
		}
		
		console.log('refreshToken - refreshing access token');
		axios.post(urlToken, params, config).then((result) => {
			console.log('refreshToken - Success!  Data: ', result.data);
			
			// store tokens in DynamoDB home settings file
			const token_data = result.data;
			accessToken = token_data.access_token;
			
			putSonosData( 'token-time', new Date() );
			putSonosData( 'access-token', token_data.access_token );
			putSonosData( 'refresh-token', token_data.refresh_token );
			putSonosData( 'expires-in', token_data.expires_in );
			
			// putSonosToken( tokenData );
		}).catch((err) => { console.log('refreshToken - error refreshing token: ', err); })
	} catch(err) { console.log('refreshToken - error getting refresh token from DynamoDB: ', err) }	
	
	// return refreshed access token
	return accessToken;
};

// Get access token
async function getAccessToken() {
	
	// declare access token variable to be returned
	let accessToken;

	try {
		// create axios sonos control object
		console.log('getAccessToken - getting Sonos data from DyanmoDB');
		accessToken = await getSonosData('access-token');
		const tokenTime = new Date( await getSonosData( 'token-time' ) );
		const expiresIn = await getSonosData( 'expires-in' );

		// check to see if token has expired
		const currentTime: any = new Date();
		const elapsedTime = (currentTime.getTime() - tokenTime.getTime()) / 1000;
		console.log('getAccessToken - token-time: ', tokenTime, ', expires-in: ', expiresIn, ', time gap: ', elapsedTime );
		if ( elapsedTime > expiresIn ) {
			console.log('getAccessToken - token expired, need to refresh: ', elapsedTime);
			accessToken = await refreshToken();
		}
	} catch(err) { console.log('getAccessToken - error getting refresh token from DynamoDB: ', err) }	
	
	return accessToken;
};


// Control playback on Sonos speakers
async function controlSpeakers(context, speakers, command) {
	  	
	try {
		// create axios sonos control object
		// const access_token = await SmartState.getHomeMode('niwot', 'sonos-access-token');
		const access_token = await getAccessToken();
		const sonosControl = axios.create({
			baseURL: 'https://api.ws.sonos.com/control/api/v1',
			timeout: 5000,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + access_token
			}
		});

		// get household id
		console.log('controlSpeakers - getting households');
		sonosControl.get('households').then((result) => {
			const householdId = result.data.households[0].id;			
			console.log('controlSpeakers - household ID: ', householdId);
			// putSonosData( 'household-id', idHousehold );

			// get sonos groups and devices
			sonosControl.get('households/' + householdId + '/groups').then((result) => {
				const sonosGroups = result.data.groups;
				console.log('controlSpeakers - Sonos groups: ', sonosGroups);
			
				// pause all specified speakers
				// for (const speaker of context.config.roomSpeakers) {
				const speakerDevices = context.config[speakers];
				for (const speaker of speakerDevices) {
					const speakerId = speaker.deviceConfig.deviceId;
					// const speakerInfo = await context.api.devices.get(speakerId);
					context.api.devices.get(speakerId).then((speakerInfo) => {
						const speakerName = speakerInfo.name;
						// SmartSonos.controlSpeaker(speakerInfo.name, 'pause');
						
						const result = sonosGroups.find(speaker => speaker.name === speakerName);
						const groupId = result.id;

						const command = 'pause';
						const urlControl = '/groups/' + groupId + '/playback/' + command;
						// sonosControl.post(urlControl);
						sonosControl.post(urlControl).then((result) => {
							console.log('controlSpeakers - Success!  Data: ', result.data);;
						}).catch((err) => { console.log('controlSpeakers - error controlling speaker: ', err, ', command: ', command); })
					})
				}
			}).catch((err) => { console.log('controlSpeakers - error getting groups/speakers: ', err); })
		}).catch((err) => { console.log('controlSpeakers - error getting household(s): ', err); })
	} catch(err) { console.log('controlSpeakers - error controlling Sonos: ', err); }
};


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// set control enabled flag to control other settings prompts
	let bControlEnabled = context.configBooleanValue('controlEnabled');
	if (!bControlEnabled) {
		bControlEnabled = true;
	}

	// initialize state variable(s)
	SmartState.putState( context, 'roomSwitchPressed', 'true' );

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true).submitOnChange(true);
		if (bControlEnabled) {
			section.textSetting('homeName').required(false);
		}
	});

	if (bControlEnabled) {
		// room switches
		page.section('controls', section => {
			section.deviceSetting('roomSwitch').capabilities(['switch'])
				.required(true).permissions('rx');
			section.deviceSetting('roomSpeakers').capabilities(['audioVolume'])
				.required(false).multiple(true).permissions('rx');
			section.enumSetting('speakerBehavior').options(['onAlways','onActive']).required(false);
		});
	}
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('sonosControl - start install/update');

	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	// await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	// console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		// await context.api.devices.sendCommands(context.config.delayGroup, 'switch', 'off');
	} else {
		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.on', 'switchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.off', 'switchOffHandler');		
	}	
	console.log('sonosControl - end creating subscriptions');
})


// Turn on the lights/outlets in the on group when room switch is turned on
.subscribedEventHandler('switchOnHandler', async (context, event) => {
	console.log('switchOnHandler - starting, context: ', context, ', event: ', event);
	
	// Get session state variable to see if button was manually pressed
	console.log("Checking value of roomSwitchPressed");
	const speakerBehavior = context.configStringValue('speakerBehavior');
	console.log('switchOnHandler - speaker behavior: ', speakerBehavior);
	
	if (speakerBehavior==='onAlways' || 
	   (speakerBehavior==='onActive' && SmartState.isHomeActive(context.stringValue('homeName')))) {		
	
		// turn on speaker(s)
			console.log('switchOnHandler - switch pressed, turning on speakers');
			await controlSpeakers( context, 'roomSpeakers', 'play');
			console.log('switchOnHandler - speakers turned on');
	}
	
	console.log('switchOnHandler - finished');	
})


// Turn off speakers when room switch is turned off
.subscribedEventHandler('switchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	console.log('switchOffHandler - starting');
		
	// await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'pause');
	await controlSpeakers(context, 'roomSpeakers', 'pause');
	console.log('roomSwitchOffHandler - turning off speakers complete');
});

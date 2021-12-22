//---------------------------------------------------------------------------------------
// Sonos Control - control sonos speaker(s) from light switch
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');
const axios = require('axios');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
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


/*
// Control playback on Sonos speakers
async function controlSpeakers(context, speakers, command) {
	  	
	try {
		// create axios sonos control object
		const access_token = await SmartState.getHomeMode('niwot', 'sonos-access-token');
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
*/


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// main options page with room controls and behaviors
	// page.nextPageId('optionsPage');

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
			if (roomType==='complex') {
				section.textSetting('homeName').required(false);
			}
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
	const switchPressed = await SmartState.getState( context, 'roomSwitchPressed' );
	console.log('switchOnHandler - main switch pressed: ', switchPressed);
	
	if (bTimeWindow || onTimeCheck==='onAlways') {		
	
		// check value of roomSwitchPressed state variable
		if ( switchPressed == 'true' ) {
			console.log('switchOnHandler - main switch pressed, turning on all lights in OnGroup');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
			console.log('switchOnHandler - speakers turned on as part of onGroup');
		} else {
			console.log('switchHandler - main switch NOT pressed, don\'t turn on other lights');
			SmartState.putState( context, 'roomSwitchPressed', 'true' );
		}
	}
	
	console.log('switchOnHandler - finished');	
})


// Turn off the lights in the offGroup when room switch is turned off
.subscribedEventHandler('switchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	console.log('switchOffHandler - starting');
		
	// Determine if Now() is in time window
	console.log('switchOffHandler - time window: ', SmartUtils.inTimeContext( context, 'startTime', 'endTime') );
	const daysOfWeek = context.configStringValue('daysOfWeek');
	console.log('switchOffHandler - daysOfWeek: ', daysOfWeek, ', isDayOfWeek: ', SmartUtils.isDayOfWeek( daysOfWeek ) );
	
	const bTimeWindow = ( SmartUtils.inTimeContext( context, 'startTime', 'endTime' ) &&
		SmartUtils.isDayOfWeek( context.configStringValue('daysOfWeek') ) &&
		!!(context.configStringValue('startTime')) ); 		
		
	console.log('switchOffHandler - in time window: ', bTimeWindow);
	if (!bTimeWindow) {	
		console.log('roomSwitchOffHandler - outside time window');
		const offDelay = context.configNumberValue('offDelay')
		console.log('roomSwitchOffHandler - off delay: ', offDelay);
		
		// get state variable to see if room switch was turned off by delay
		const roomState = await SmartState.getState(context, 'roomOff');
		console.log('roomSwitchOffHandler - room off context value: ', roomState);

		if (offDelay>0 && roomState==='delay') {
			console.log('roomSwitchOffHandler - turning off group after delay, ' + offDelay);
			await context.api.schedules.runIn('delayedGroupOff', offDelay);
		} else {
			console.log('roomSwitchOffHandler - turning off group immediately');
			await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
			console.log('roomSwitchOffHandler - turning speakers off', context.config['roomSpeakers']);
			await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'pause');
			// await controlSpeakers(context, 'roomSpeakers', 'pause');
			console.log('roomSwitchOffHandler - turning off group complete');
		}
	}
});

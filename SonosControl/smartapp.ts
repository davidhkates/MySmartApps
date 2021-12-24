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


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// set control enabled flag to control other settings prompts
	let bControlEnabled = context.configBooleanValue('controlEnabled');
	if (bControlEnabled === undefined) {
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
			await SmartSonos.controlSpeakers( context, 'roomSpeakers', 'play');
			console.log('switchOnHandler - speakers turned on');
	}
	
	console.log('switchOnHandler - finished');	
})


// Turn off speakers when room switch is turned off
.subscribedEventHandler('switchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	console.log('switchOffHandler - starting');
		
	// await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'pause');
	await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'pause');
	console.log('roomSwitchOffHandler - turning off speakers complete');
});

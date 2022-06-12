//---------------------------------------------------------------------------------------
// Lock Control - control door locks based on lock and timer events and time of day
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');
const axios = require('axios');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');

// SmartApp type definitions
interface device {
	[value: string]: any
}


// Remove console log and console error outputs when not debugging
/*
// console.log('NODEJS environment variable(s): ', process.env);
// if (process.env.NODE_ENV == "production") {
    console.log = function(){}; 
    console.error = function(){}; 
// }
*/

// lock door
async function lockDoor( context ) {
	console.log('lockDoor - starting routine');
	await context.api.devices.sendCommands(context.config.doorLock, 'lock', 'lock');
};


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// main options page with room controls and behaviors

	// set control enabled flag to control other settings prompts
	let bControlEnabled: boolean = context.configBooleanValue('controlEnabled');

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true).submitOnChange(true);
		if (bControlEnabled) {

			section.deviceSetting('doorLock').capabilities(['lock'])
				.required(true).permissions('rx');
			section.numberSetting('lockDelay').required(false).min(0).defaultValue(300);
		}
	});

	// time window and days of week	
	if (bControlEnabled) {
		page.section('time', section => {
			section.timeSetting('startTime').required(false);
			section.timeSetting('endTime').required(false);
		});	
	}
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('lockControl - start install/update');
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	if (controlEnabled) {
		// create subscriptions for relevant devices
		console.log('lockControl - create subscriptions');
		await context.api.subscriptions.subscribeToDevices(context.config.doorLock,
		    'lock', 'lock.locked', 'lockLockedHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.doorLock,
		    'lock', 'lock.unlocked', 'lockUnlockedHandler');
	
		// Schedule endTime activities
		const endTime = context.configStringValue('endTime');
		if (endTime) {
			await context.api.schedules.runDaily('endTimeHandler', new Date(endTime));
		}
	}	
	console.log('lockControl - end creating subscriptions');
})


// Cancel pending scheduled delayed door lock activity
.subscribedEventHandler('doorLockedHandler', async (context, event) => {
	console.log('doorLockedHandler - starting');
	await context.api.schedules.delete('delayedDoorLock');
	console.log('doorLockedHandler - finished');	
})


// Turn off the lights in the offGroup when room switch is turned off
.subscribedEventHandler('lockUnlockedHandler', async (context, event) => {
	console.log('lockUnlockedHandler - starting');
	
	// Determine if in time window
	const bTimeWindow = SmartUtils.inTimeContext( context, 'startTime', 'endTime' );
		
	console.log('roomSwitchOffHandler - in time window: ', bTimeWindow);
	if (!bTimeWindow) {	
		console.log('lockUnlockedHandler - outside time window');
		const lockDelay = context.configNumberValue('lockDelay')
		
		// set timer to lock door specified seconds after locked
		if (lockDelay>0) {
			console.log('lockUnlockedHandler - setting timer for locking door: ' + lockDelay);
			await context.api.schedules.runIn('delayedDoorLock', lockDelay);
		}
	}	
})


// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	console.log('endTimeHandler - starting');

	// lock door
	await context.api.devices.sendCommands(context.config.doorLock, 'lock', 'lock');
	console.log('endTimeHandler - finished');
})


// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedDoorLock', async (context, event) => {
	console.log('delayedDoorLock - starting');

	// lock door
	await context.api.devices.sendCommands(context.config.doorLock, 'lock', 'lock');
	console.log('delayedDoorLock - finished');
});

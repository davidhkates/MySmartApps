// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
// const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}

// Utility functions for this automation


// Define the SmartApp
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {
	// separate page for additional options
	// page.nextPageId('optionsPage');
	
	// operating switch and controls to set home status
	page.section('controls', section => {
		// section.booleanSetting('controlEnabled').defaultValue(true);
		section.textSetting('homeName').required(true);
		section.deviceSetting('homeSwitch').capabilities(['switch'])
			.required(true).permissions('r');
		section.deviceSetting('homeMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		section.deviceSetting('homeContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactsOpenClosed').options(['Open','Closed']);
	});

	// OPTIONAL: start and end time
	page.section('time', section => {
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
		section.numberSetting('onDuration').defaultValue(60).required(false);
	});

})

// Handler called whenever app is installed or updated (unless separate .installed handler)
.updated(async (context, updateData) => {
	console.log('homeControl - starting install/update');

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

/*
	const homeName = context.configStringValue('homeName');
	const returnValue = await SmartState.getHomeMode(homeName, 'occupancy');
	console.log('homeControl - current mode for home occupancy: ', homeName, ' = ', returnValue);
*/
	
	// register activities of home control sensors
	await context.api.subscriptions.subscribeToDevices(context.config.homeSwitch,
		'switch', 'switch.on', 'homeSwitchOnHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.homeSwitch,
		'switch', 'switch.off', 'homeSwitchOffHandler');
	
	// initialize motion behavior
	await context.api.subscriptions.subscribeToDevices(context.config.homeMotion,
		'motionSensor', 'motion.active', 'motionStartHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.homeMotion,
		'motionSensor', 'motion.inactive', 'motionStopHandler');

	// initialize contact behaviors
	await context.api.subscriptions.subscribeToDevices(context.config.homeContacts,
		'contactSensor', 'contactSensor.open', 'contactOpenHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.homeContacts,
		'contactSensor', 'contactSensor.closed', 'contactClosedHandler');
	
	// set end time event handler
	// const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");
	if (endTime) {
		await context.api.schedules.runDaily('resetHomeMode', new Date(endTime));
	}		
	
	console.log('homeControl - finished creating subscriptions')
})


// When home control switch turned on, set timer to update home status/mode
.subscribedEventHandler('homeSwitchOnHandler', async (context, event) => {
	console.log('homeSwitchOnHandler - started');

	// Schedule turning off room switch if delay specified
	const duration = context.configNumberValue('onDuration');
	console.log('homeSwitchOnHandler - set home status/mode after specified duration: ' + duration);	
	if (duration) {
		await context.api.schedules.runIn('delayedSetMode', duration);
	}
	
	console.log('homeSwitchOnHandler - finished');
})


// If home switch turned off, cancel call to delayedSetMode
.subscribedEventHandler('homeSwitchOffHandler', async (context, event) => {
	console.log('homeSwitchOffHandler - starting');
	
	try {
		await context.api.subscriptions.unsubscribe('delayedSetMode');
		// await context.api.subscriptions.delete('delayedSetMode');
	} catch(err) {
		console.error('Error canceling delayed set mode subscription: ', err);
	};
		
	console.log('homeSwitchOffHandler - finished');
})


// If one or more contacts open, set home occupancy mode to awake
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - trigger to change home occupancy mode to AWAY');
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'awake');
})


// If contact is closed, see if they're all closed in which case set home mode to HOME
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - check other selected contacts, if any');

	// See if there are any other contact sensors defined
	const otherSensors =  context.config.contactSensors
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	if (otherSensors) {
		// Get the current states of the other contact sensors
		const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'contactSensor'
		));

		// Quit if there are other sensors still open
		const states: device = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'open')) {
			return
		}
	}

	// If we got here, no set home occupancy mode to active 
	console.log('contactClosedHandler - change home occupancy mode to active');
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
})


// Delayed action to set home status to active (formerly awake)
.scheduledEventHandler('delayedSetMode', async(context, event) => {
	console.log('delayedSetMode - starting set home status/mode');
	// check current home status - TODO: remove
	const homeMode = SmartState.getHomeMode(context.configStringValue('homeName'), 'occupancy');
	console.log('delayedSetMode - current home mode: ', homeMode);
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
})


// Reset home status to inactive (formerly asleep)
.scheduledEventHandler('resetHomeMode', async (context, event) => {		
	console.log('resetHomeMode - starting reset home status/mode');
	// check current home status - TODO: remove
	const homeMode = SmartState.getHomeMode(context.configStringValue('homeName'), 'occupancy');
	console.log('resetHomeMode - current home mode: ', homeMode);
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'inactive');
});

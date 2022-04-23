//---------------------------------------------------------------------------------------
// Home Control - set home state and settings based on time of day and events
//---------------------------------------------------------------------------------------

// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
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
		section.modeSetting('homeMode');
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
		section.timeSetting('onTime').required(false);
		section.numberSetting('onDuration').defaultValue(60).required(false);
	});

})

// Handler called whenever app is installed or updated (unless separate .installed handler)
.updated(async (context, updateData) => {
	console.log('homeControl - starting install/update');

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// Get list of locations
	console.log('homeControl - locations: ', context.api.locations);
	const locationList = context.api.locations.list; 
	console.log('homeControl - list of locations: ', locationList.toString());
	// console.log('homeControl - list of locations: ', JSON.stringify(locationList));
	
	/*
	context.api.locations.list().then(locations => {
		console.log('Number of locations: ', locations.length)
	})
	*/
	
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
	const endTime = context.configStringValue('endTime');
	if (endTime) {
		// console.log('homeControl - setting home mode to inactive at endTime: ', endTime);
		await context.api.schedules.runDaily('endTimeInactivate', new Date(endTime));
	}

	// set activate time event handler
	const onTime = context.configStringValue('onTime');
	if (onTime) {
		// console.log('homeControl - setting home mode to active at onTime: ', onTime);
		await context.api.schedules.runDaily('onTimeActivate', new Date(onTime));
	}
	
	
	console.log('homeControl - finished creating subscriptions')
})


// When home control switch turned on during time window, set timer to update home status/mode
.subscribedEventHandler('homeSwitchOnHandler', async (context, event) => {
	console.log('homeSwitchOnHandler - started');

	// Check to see if switch turned on during time window
	const startTime = context.configStringValue('startTime');
	const endTime   = context.configStringValue('endTime');
	if ( SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('homeSwitchOnHandler - in time window');
		// Schedule turning off room switch if delay specified
		const duration = context.configNumberValue('onDuration');
		console.log('homeSwitchOnHandler - set home status/mode after specified duration: ' + duration);	
		if (duration) {
			await context.api.schedules.runIn('delayedHomeActivate', duration);
		} else {
			SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
			context.api.modes.update(context.configStringValue('homeName'),'active');
		}
	}
	
	console.log('homeSwitchOnHandler - finished');
})


// If home switch turned off, cancel call to delayedHomeActivate
.subscribedEventHandler('homeSwitchOffHandler', async (context, event) => {
	console.log('homeSwitchOffHandler - starting');
	
	try {
		await context.api.subscriptions.unsubscribe('delayedHomeActivate');
		// await context.api.subscriptions.delete('delayedSetMode');
	} catch(err) {
		console.error('homeSwitchOffHandler - error canceling delayedHomeActivate subscription: ', err);
	};
		
	console.log('homeSwitchOffHandler - finished');
})


// If one or more contacts open, set home occupancy mode to active
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - trigger to change home occupancy mode to AWAY');
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
	context.api.modes.update(context.configStringValue('homeName'),'Awake');
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
	context.api.modes.update(context.configStringValue('homeName'),'Awake');
})


// Delayed action to set home status to active
.scheduledEventHandler('delayedHomeActivate', async(context, event) => {
	console.log('delayedHomeActivate - starting set home status/mode');
	// check current home status - TODO: remove
	const homeMode = await SmartState.getHomeMode(context.configStringValue('homeName'), 'occupancy');
	console.log('delayedHomeActivate - current home mode: ', homeMode);
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
	context.api.modes.update(context.configStringValue('homeName'),'Awake');
})


// Set home mode to inactive at end time
.scheduledEventHandler('endTimeInactivate', async (context, event) => {		
	console.log('endTimeInactivate - starting reset home status/mode');
	// check current home status - TODO: remove
	// const homeMode = await SmartState.getHomeMode(context.configStringValue('homeName'), 'occupancy');
	// console.log('endTimeInactivate - current home mode: ', homeMode);
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'inactive');
	context.api.modes.update(context.configStringValue('homeName'),'Asleep');
})


// Set home mode to active at on time
.scheduledEventHandler('onTimeActivate', async (context, event) => {		
	console.log('onTimeActivate - starting set home status/mode');
	SmartState.putHomeMode(context.configStringValue('homeName'), 'occupancy', 'active');
	context.api.modes.update(context.configStringValue('homeName'),'Awake');
});

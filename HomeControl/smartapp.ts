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
async function setHomeMode( context ) {
}


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
		section.deviceSetting('homeSwitch').capabilities(['switch'])
			.required(true).permissions('r');
		section.deviceSetting('homeMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		section.deviceSetting('doorContacts').capabilities(['contactSensor'])
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
	
	console.log('homeControl - finished creating subscriptions')
})


// When home control switch turned on, set timer to update home status/mode
.subscribedEventHandler('homeSwitchOnHandler', async (context, event) => {
	console.log('homeSwitchOnHandler - started');

	// Schedule turning off room switch if delay specified
	const delay = context.configNumberValue('onDuration');
	console.log('homeSwitchOnHandler - set home status/mode after specified delay: ' + delay);	
	if (delay) {
		await context.api.schedules.runIn('delayedSetMode', delay);
	}
	
	console.log('homeSwitchOnHandler - finished');
})


// If home switch turned off, cancel call to delayedSetMode
.subscribedEventHandler('homeSwitchOffHandler', async (context, event) => {
	console.log('homeSwitchOffHandler - starting');
	
	await context.api.subscriptions.delete('delayedSetMode');
		
	console.log('homeSwitchOffHandler - finished');
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log("Contact open");
	setHomeMode(context);
})


// If contact is closed, see if they're all closed in which case stop fan
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log("Contact closed");

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
	console.log("Turn off lights after specified delay");

	// If we got here, no other contact sensors are open so turn off fan 
	// stopFan(context);
})


// Handle end time if specified
.scheduledEventHandler('delayedSetMode', async(context, event) => {
	console.log('delayedSetMode - starting set home status/mode');
	// check current home status
	SmartState.putValue('smartapp-home-settings', 'Niwot', 'awake');
})


// Check temperature and turn on/off fan as appropriate
.scheduledEventHandler('resetHomeMode', async (context, event) => {		
	console.log('resetHomeMode - starting reset home status/mode');
	SmartState.putValue('smartapp-home-settings', 'Niwot', 'asleep');
});

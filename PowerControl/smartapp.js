// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
const SmartUtils  = require('@katesthings/smartutils');


/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// enable/disable control, motion delay setting
	page.section('parameters', section => {
		section
			.booleanSetting('controlEnabled')
			.defaultValue(true)
			.required(false);
		section
			.numberSetting('delay')
			.defaultValue(60)
			.required(false);
	});

	// controls and sensors
	page.section('controls', section => {
		section
			.deviceSetting('powerOutlets')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
		section
			.deviceSetting('lightSwitches')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
	});

	// start and end time
	page.section('time', section => {
		section
			.timeSetting('startTime')
			.required(false);
		section
			.timeSetting('endTime')
			.required(false);
	});
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("PowerControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.powerOutlets, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.lightSwitches,
		    'switch', 'lightSwitches.on', 'lightSwitchOnHandler');
//		await context.api.subscriptions.subscribeToDevices(context.config.lightSwitches,
//		    'switch', 'lightSwitches.off', 'lightSwitchOffHandler');
	}
	
	console.log('PowerControl: END CREATING SUBSCRIPTIONS')
})


// Turn on lights when motion occurs during defined times if dependent lights are on
.subscribedEventHandler('lightSwitchOnHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Turn on power outlet if in time window when any light switch turned on
	if ( SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('Turning power outlet(s) on');
		await context.api.devices.sendCommands(context.config.powerOutlets, 'switch', 'on');
	}
})


// Turn off the lights only when all light switch(es) are turned off
.subscribedEventHandler('lightSwitchOffHandler', async (context, event) => {

	// See if there are any other light switches defined
	const otherSensors =  context.config.switch
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	if (otherSensors) {
		// Get the current states of the other motion sensors
		const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));

		// Quit if there are other sensor still active
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'on')) {
			return
		}
	}
	console.log("Turn off power outlets after specified delay");

	const delay = context.configNumberValue('delay')
	if (delay) {
		// Schedule turn off if delay is set
		await context.api.schedules.runIn('lightsOffDelay', delay)
	} else {
		// Turn off immediately if no delay
		await context.api.devices.sendCommands(context.config.powerOutlets, 'switch', 'off');
	}
})


// Turns off power outlet(s) after delay elapses
.scheduledEventHandler('lightsOffDelay', async (context, event) => {
	await context.api.devices.sendCommands(context.config.powerOutlets, 'switch', 'off');
});

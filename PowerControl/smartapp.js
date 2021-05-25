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
			.required(true);
		section
			.numberSetting('delay')
			.min(60)
			.defaultValue(300)
			.required(true);
	});

	// controls and sensors
	page.section('controls', section => {
		section
			.deviceSetting('controlSwitch')
			.capabilities(['switch'])
			.required(true)
			.permissions('rx');
		section
			.deviceSetting('roomSwitches')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
		section
			.deviceSetting('motion')
			.capbilities(['motionSensor'])
			.required(false)
			.multiple(true)
			.permissions('rx');
	});

	// time window and auto-off
	page.section('time', section => {
		section
			.timeSetting('startTime')
			.required(false);
		section
			.timeSetting('endTime')
			.required(false);
		section
			.timeSetting('autoOffTime')
			.required(false);
	});
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("RoomControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('lightsOffDelay');

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.lightSwitches,
		    'switch', 'lightSwitches.on', 'lightSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.lightSwitches,
		    'switch', 'lightSwitches.off', 'lightSwitchOffHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');
		await context.api.schedules.runDaily('roomOffHandler');
	}
	
	console.log('RoomControl: END CREATING SUBSCRIPTIONS')
})


// Turn on lights when motion occurs during defined times if dependent lights are on
.subscribedEventHandler('lightSwitchOnHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Turn on room switch(es) if in time window when light switch turned on
	if ( SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('Turning room switch(es) on');
		await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'on');
	}
})


// Turn off the room switch(es) if light turned off outside of time window
.subscribedEventHandler('lightSwitchOffHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Turn off room switch(es) if outside time window when light switch turned off
	if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('Turning room switch(es) off');
		await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
	}
})


// Turns off room switch(es) after delay elapses if no motion in room
.scheduledEventHandler('roomOffHandler', async (context, event) => {

	// See if there are any motion sensors defined
	const motionSensors =  context.config.motion;
	if (motionSensors) {
		// Get the current states of the motion sensors
		const stateRequests = motionSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'motion'
		));

		// Check again after delay if there is any motion in room, if not turn off now
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.switch.value === 'active')) {
			const delay = context.configNumberValue('delay')
			await context.api.schedules.runIn('roomOffHandler', delay);
		} else {
			// Turn off now if no motion
			await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
		}
	}
});

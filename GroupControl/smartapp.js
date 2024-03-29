const SmartApp   = require('@smartthings/smartapp');
// const stateVariable = require('./state-variable');
const stateVariable = require('@katesthings/smartstate');

/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()        // auto-create i18n files for localizing config pages
// .contextStore(contextStore)     // context store to persist room state

// Configuration page definition
.page('mainPage', (context, page, configData) => {
	
	// enable/disable control, motion delay setting
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true);
	});

	// main control switch
	page.section('switches', section => {
		section.deviceSetting('mainSwitch').capabilities(['switch'])
			.required(true).permissions('rx');            
		section.deviceSetting('onGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');            
		section.deviceSetting('offGroup').capabilities(['switch'])
			.multiple(true).permissions('rx');            
	});

	// motion sensors and delay for automatically turning off lights
	page.section('sensors', section => {
		section.deviceSetting('motionSensors').capabilities(['motionSensor'])
			.multiple(true);
		section.numberSetting('delay').required(false);
	});

/*
	// speaker(s) in room to turn on/off with group lights
	page.section('speakers', section => {
		section.deviceSetting('sonos').capabilities(['Music Player'])
			.multiple(true).required(false);
	});
*/
})

// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("MotionGroup: Installed/Updated");

	// initialize state variable(s)
	stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	} else {
		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.on', 'mainSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.off', 'mainSwitchOffHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.on', 'onGroupOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.off', 'onGroupOffHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');
	}
	
	console.log('Motion Group: END CREATING SUBSCRIPTIONS')
})


// Turn on the lights when main switch is pressed
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	console.log("Checking value of mainSwitchPressed");
	const switchPressed = await stateVariable.getState( context.event.appId, 'mainSwitchPressed' );
	console.log("Main Switch Pressed: ", switchPressed);

	// check value of mainSwitchPressed state variable
	if ( switchPressed == 'true' ) {
		console.log("Main switch pressed, turning on all lights in OnGroup");
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
	} else {
		console.log("Main switch NOT pressed, don't turn on other lights");
		stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
	}	

	// start timer to turn off lights if value specified
	const delay = context.configNumberValue('delay')
	if (delay) {
	    // Schedule turn off if delay is set
		await context.api.schedules.runIn('motionStopped', delay)
	}
})


// Turn off the lights when main switch is pressed
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	// Turn on the lights in the on group
	await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
	await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	console.log("Turn off all lights in on and off groups");
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('onGroupOnHandler', async (context, event) => {
	console.log("Turn on the main switch when a light in the on group is turned on");

	// indicate main switch was NOT manually pressed
	stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('onGroupOffHandler', async (context, event) => {
	console.log("Turn off the main switch when ALL lights in the on group are turned off");

	// See if there are any other switches in the onGroup defined
	const otherOnGroup =  context.config.onGroup
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId);

	// Get the current states of the other motion sensors
	if (otherOnGroup) {
		const stateRequests = otherOnGroup.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));	

		// Quit if there are other switches still on
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.switch.value === 'on')) {
			return
		}
	}

	// If we get here, turn off the main switch and reset mainSwitchPressed state variable
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
})


// Turn off the lights only when all motion sensors become inactive
.subscribedEventHandler('motionStopHandler', async (context, event) => {

	// See if there are any motion sensors defined
	const motionSensors =  context.config.motionSensors
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	if (motionSensors) {
		// Get the current states of the other motion sensors
		const stateRequests = motionSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'motionSensor'
		));

		// Quit if there are other sensor still active
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'active')) {
			return
		}
	}
	console.log("Turn off lights after specified delay");

	const delay = context.configNumberValue('delay')
	if (delay) {
		// Schedule turn off if delay is set
		await context.api.schedules.runIn('motionStopped', delay)
	} else {
		// Turn off immediately if no delay
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	}
})

/*
.subscribedEventHandler('switchHandler', async (ctx, event) => {
	console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
})
*/


// Turns off lights after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
});

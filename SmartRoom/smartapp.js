// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
const SmartUtils  = require('@katesthings/smartutils');
// const SmartState  = require('@katesthings/smartstate');


/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// enable/disable control, motion delay setting
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true);
	});

	// room switches
	page.section('controls', section => {
		section.deviceSetting('mainSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('onGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
		section.deviceSetting('offGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
		section.deviceSetting('delayGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
	});

	// room contacts
	page.section('controls', section => {
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactMode').options(['allOpen', 'allClosed','anyClosed']);
	});

	// time window and auto-off
	page.section('time', section => {
		section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
			defaultValue('everyday').required(true);
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
		section.timeSetting('autoOffTime').required(false);
		section.decimalSetting('delayOff').required(false).min(0);
	});
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log("RoomControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('checkOnHandler');
	await context.api.schedules.delete('roomOffHandler');

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.on', 'mainSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.off', 'mainSwitchOffHandler');

		// motion sensor handlers
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');

		// check to see if light was turned on before start time
		const checkOnTime = context.configStringValue("startTime");
		if (checkOnTime) {
			await context.api.schedules.runDaily('checkOnHandler', new Date(checkOnTime));
		}
		const autoOffTime = context.configStringValue("autoOffTime");
		if (autoOffTime) {
			await context.api.schedules.runDaily('roomOffHandler', new Date(autoOffTime));
		}
	}
	
	console.log('RoomControl: END CREATING SUBSCRIPTIONS')
})


// Turn on the lights/outlets in the on group when main switch is pressed
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	console.log('Checking whether all switches in on group are off');
	const onGroupSwitches = context.config.onGroup;
	console.log('On group switches: ', onGroupSwitches);
	if (onGroupSwitches) {
		// Get the current states of the switches in the on group
		const switchStates = onGroupSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));
		console.log('Switch states: ', switchStates);

		// Quit if any of the switches are already on
		const onGroupStates = OnGroupSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));	

		const states = await Promise.all(onGroupStates)
		if (states.find(it => it.switch.value === 'on')) {
			console.log('Switch(es) in on group already on, do not turn on group')
		} else {
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
		}
	}
})



// Turn off the lights when main switch is pressed
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	// Turn on the lights in the on and off group
	// await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
	await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	console.log("Turn off all lights in on and off groups");
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('onGroupOnHandler', async (context, event) => {
	console.log("Turn on the main switch when a light in the on group is turned on");

	// indicate main switch was NOT manually pressed
	// stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('onGroupOffHandler', async (context, event) => {
	console.log("Turn off the main switch when ALL lights in the on group are turned off");

	// See if there are any other switches in the onGroup defined
	const otherOnGroup =  context.config.onGroup
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

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
	// stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
})


// Turn off the room switch(es) if light turned off outside of time window
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	// Check today is specified day of week
	if (SmartUtils.isDayOfWeek(context.configStringValue("daysOfWeek"))) {
		const startTime  = context.configStringValue("startTime");
		const endTime    = context.configStringValue("endTime");

		// Turn off room switch(es) if outside time window when light switch turned off
		if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
			console.log('Turning room switch(es) off');
			await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
		}
	}
})


// Check to see if control switch was turned on prior to start time
.scheduledEventHandler('checkOnHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( SmartSensors.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) on');
		await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'on');
	}
})


// Turns off room switch(es) at end time
.scheduledEventHandler('roomOffHandler', async (context, event) => {
	// await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
});

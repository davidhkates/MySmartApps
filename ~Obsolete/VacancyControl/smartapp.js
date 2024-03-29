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
		section.booleanSetting('controlEnabled')
			.defaultValue(true)
			.required(true);
		section.numberSetting('delay')
			.min(60)
			.defaultValue(300)
			.required(true);
		section.enumSetting('mode')
			.options(['vacancy','occupancy'])
			.defaultValue('Vacancy')
			.required(true);
	});

	// controls and sensors
	page.section('controls', section => {
		section.deviceSetting('motion')
			.capabilities(['motionSensor'])
			.required(true)
			.multiple(true)
			.permissions('r');
		section.deviceSetting('mainSwitch')
			.capabilities(['button','switch'])
			.required(true)
			.permissions('rx');
		section.deviceSetting('roomSwitches')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
	});

	// time window
	page.section('time', section => {
		section.timeSetting('startTime')
			.required(false);
		section.timeSetting('endTime')
			.required(false);
		section.enumSetting('daysOfWeek')
			.options(['everyday','weekdays','weekend'])
			.required(true);
	});
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("VacancyControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('motionStopped');

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
		/*
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'button', 'button.pushed', 'mainSwitchButtonHandler');
		*/

		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');
		const endTime = context.configStringValue("endTime");
		if (endTime) {
			await context.api.schedules.runDaily('motionStopHandler', new Date(endTime));
		}
	}
	console.log('VacancyControl: END CREATING SUBSCRIPTIONS')
})


// Turns on room lights with main switch
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	console.log('Main switch turned on');
	await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'on');
	console.log('Room switches turned on');
})


// Turns off room lights with main switch
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	console.log('Main switch turned off');
	await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
	console.log('Room switches turned off');
})


// Treat button push as toggling switch
.subscribedEventHandler('mainSwitchButtonHandler', async (context, event) => {
	const mainSwitch = await SmartSensor.getSwitchState( context, context.config.mainSwitch[0] );
	console.log('Main button pressed: switch state:', mainSwitch)
	if ( mainSwitch == 'on' ) {	
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		// await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
	} else {
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
		// await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'on');
	}		
})



// Turn on room lights if mode set to Occupancy
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	// See if mode set to occupancy
	const mode = context.configStringValue('mode');
	if (mode=='occupancy') {

		// Get start and end times
		const startTime = context.configStringValue("startTime");
		const endTime   = context.configStringValue("endTime");

		// Turn on room switch(es) if in time window
		if ( SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
			console.log('Turn on lights since mode is occupancy and in time window');
			await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
		}
	}
})


// Turn off the room switch(es) if motion stops outside of time window
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Turn off room switch(es) if outside time window when light switch turned off
	if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('Outside time window, check other motion sensors');

		// See if there are any motion sensors defined
		const motionSensors =  context.config.motion
	    		.filter(it => it.deviceConfig.deviceId !== event.deviceId);

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
	
		// All motion sensors inactive, turn off room switch(es) after delay
		if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
			console.log('Turning room switch(es) off after specified delay');
			const delay = context.configDecimalValue("delay");
			if (delay) {
				await context.api.schedules.runIn('motionStopped', delay);
			} else {
				await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
			}
		}
	}
})


// Turns off lights after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
});

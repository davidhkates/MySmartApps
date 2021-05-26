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
			.options(['Vacancy','Occupancy'])
			.defaultValue('Vacancy')
			.required(true);
	});

	// controls and sensors
	page.section('controls', section => {
		section.deviceSetting('controlSwitch')
			.capabilities(['switch'])
			.required(true)
			.permissions('r');
		section.deviceSetting('roomSwitches')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
		section.deviceSetting('motion')
			.capabilities(['motionSensor'])
			.required(true)
			.multiple(true)
			.permissions('r');
	});

	// time window
	page.section('time', section => {
		section.timeSetting('startTime')
			.required(false);
		section.timeSetting('endTime')
			.required(false);
		section.enumSetting('daysOfWeek')
			.options(['Every Day','Weekdays'])
			.required(true);
	});
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log("RoomControl: Installed/Updated");

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
		await context.api.subscriptions.subscribeToDevices(context.config.controlSwitch,
		    'switch', 'switch.on', 'controlSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.controlSwitch,
		    'switch', 'switch.off', 'controlSwitchOffHandler');

		/*
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStartHandler');
		*/
		// await context.api.subscriptions.subscribeToDevices(context.config.motion,
		//    'motionSensor', 'motion.inactive', 'motionStopHandler');
		/*
		const endTime = context.configStringValue("endTime");
		if (endTime) {
			await context.api.schedules.runDaily('roomOffHandler', new Date(endTime));
		}
		*/
	}
	
	console.log('RoomControl: END CREATING SUBSCRIPTIONS')
})


// Turns on room lights with control switch
.scheduledEventHandler('controlSwitchOn', async (context, event) => {
	await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'on');
});


// Turns off room lights with control switch
.scheduledEventHandler('controlSwitchOff', async (context, event) => {
	await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'off');
});


/*
// Turn off the room switch(es) if motion stops outside of time window
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Turn off room switch(es) if outside time window when light switch turned off
	if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
		console.log('Outside time window, check other motion sensors');

		// See if there are any motion sensors defined
		const motionSensors =  context.config.motionSensors
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
*/

// Turns off lights after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
});

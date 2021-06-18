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


// Turn on room switches/outlets when control switch turned on during defined times
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Check today is specified day of week
	if (SmartUtils.isDayOfWeek(context.configStringValue("daysOfWeek"))) {
		const startTime  = context.configStringValue("startTime");
		const endTime    = context.configStringValue("endTime");
		console.log("Today is one of days of week, start time: ", startTime);

		// Turn on room switch(es) if in time window when light switch turned on
		if ((!(startTime) && !(endTime)) || SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
			console.log('Turning room switch(es) on');
			await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'on');
			
			// start delay timer to turn off if delay specified
			const delay = context.configNumberValue('delay');
			console.log('Motion stopped, turn off lights after delay: ', delay);
			if (delay) {
				await context.api.schedules.runIn('roomOffHandler', delay)
			}
		}
	}
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


// Turn on light in occupancy mode during defined times when motion occurs
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	if (context.configStringValue('motionMode')=='occupancy') {

		// Check today is specified day of week
		if (SmartUtils.isDayOfWeek(context.configStringValue("daysOfWeek"))) {
			const startTime  = context.configStringValue("startTime");
			const endTime    = context.configStringValue("endTime");

			// if in time window, turn on main/control switch which, in turn, will turn on room switches
			if ((!(startTime) && !(endTime)) || SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
				console.log('Turning control switch on');
				await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
			}
		}
	}

	// Delete any scheduled turn offs
        if (context.configNumberValue('delay')) {
            await context.api.schedules.delete('motionStopped');
        }
})


// Turn off the lights only when all motion sensors become inactive
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	
	// check to see this is specified day of week
	if (SmartUtils.isDayOfWeek(context.configStringValue("daysOfWeek"))) {
		// if mode is vacancy or occupancy, schedule room switches to turn off
		const motionMode = context.configStringValue('motionMode');
		console.log('Motion stop handler, mode: ', motionMode);
		if (motionMode=='vacancy' || motionMode=='occupancy') {

			// check to see we're outside the designated day and time window
			const startTime = context.configStringValue("startTime");
			const endTime   = context.configStringValue("endTime");
			if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {

				// See if there are other sensors
				const otherSensors =  context.config.motion
					.filter(it => it.deviceConfig.deviceId !== event.deviceId)

				if (otherSensors) {
					// Get the current states of the other motion sensors
					const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
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

				// If no other active sensore, turn off lights now or after delay
				const delay = context.configNumberValue('delay')
				console.log('Motion stopped, turn off lights after delay: ', delay);
				if (delay) {
					// Schedule turn off if delay is set
					await context.api.schedules.runIn('roomOffHandler', delay)
				} else {
					// Turn off immediately if no delay
					await context.api.devices.sendCommands(context.config.lights, 'switch', 'off');
				}
			}
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


// Turns off room switch(es) at end time if no motion in room
.scheduledEventHandler('roomOffHandler', async (context, event) => {

	// See if there are any motion sensors defined
	console.log("Checking status of motion sensors");
	const motionSensors =  context.config.motion;
	if (motionSensors) {
		// Get the current states of the motion sensors
		const stateRequests = motionSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'motionSensor'
		));

		// Turn off control and room switch(es) if all motion detectors are 
		console.log("Turn off control and room switches if all motion sensors are inactive");
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'active')) {
			// const delay = context.configNumberValue('delay')
			// await context.api.schedules.runIn('roomOffHandler', delay);
			return;
		} else {
			await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
			await context.api.devices.sendCommands(context.config.roomSwitches, 'switch', 'off');
		}
	}
});

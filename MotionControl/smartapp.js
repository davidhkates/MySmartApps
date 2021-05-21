// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
// const SmartSensor = require('@katesthings/smartcontrols');


// Utility functions
async function getTemperature( context, sensor ) {
	const sensorDevice = sensor.deviceConfig;
	const sensorState = await context.api.devices.getCapabilityStatus( sensorDevice.deviceId, sensorDevice.componentId, 'temperatureMeasurement');
	// console.log('Sensor state: ', sensorState);
	return sensorState.temperature.value;
}

function setToday( date, today ) {
	date.setDate( today.getDate() );
	date.setMonth( today.getMonth() );
	date.setFullYear( today.getFullYear() );
	return date;
}


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
			.required(false);
		section
			.numberSetting('delay')
			.defaultValue(300)
			.required(false);
	});

	// controls and sensors
	page.section('controls', section => {
		section
			.deviceSetting('motion')
			.capabilities(['motionSensor'])
			.required(true)
			.multiple(true)
			.permissions('r');
		section
			.deviceSetting('lightSwitch')
			.capabilities(['switch'])
			.required(true)
			.multiple(true)
			.permissions('rx');
		section
			.deviceSetting('dependentSwitch')
			.capabilities(['switch'])
			.required(false)
			.multiple(true)
			.permissions('r');
		section
			.deviceSetting('contact')
			.capabilities(['contactSensor'])
			.required(false)
			.multiple(true)
			.permissions('r');
	});

	// start and end time (assumes daytime therefore startTime < endTime)
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
	console.log("MotionControl: Installed/Updated");

	// get fan enabled setting and turn off fan if not
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.lightSwitch, 'switch', 'off');
	}

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// create subscriptions for relevant devices
	await context.api.subscriptions.subscribeToDevices(context.config.motion,
	    'motion', 'motion.active', 'motionStartHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.motion,
	    'motion', 'motion.inactive', 'motionStopHandler');

	console.log('Motion Group: END CREATING SUBSCRIPTIONS')
})


// Turn on lights when motion occurs during defined times if dependent lights are on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Determine whether current time is within start and end time window
	var bTimeWindow = true;
	if (startTime) {
		const currentTime = new Date();
		if ( currentTime < setToday( startTime, currentTime ) ) {
			bTimeWindow = false;
		} else {
			if (endTime) {
				if ( currentTime > setToday( endTime, currentTime ) ) {
					bTimeWindow = false;
				}
			}
		}
	}
	
	// Determine if dependent lights/switches are on
	var bDependent = true;
	// if (dependentSwitch) {
	
	
	// turn on light if in time window and dependent switch(es) are on
	if ( bTimeWindow && bDependent ) {
		console.log('Turning light(s) on');
		await context.api.devices.sendCommands(context.config.lightSwitch, 'switch', 'on');
	}
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


// Turns off lights after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.lightSwitch, 'switch', 'off');
});

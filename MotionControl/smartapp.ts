// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
// const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}


/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// enable/disable control, motion delay setting
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').required(false);
		section.textSetting('homeName').required(false);
		section.numberSetting('delay').defaultValue(300).required(false);
	});

	// controls and sensors
	page.section('controls', section => {
		section.deviceSetting('motion').capabilities(['motionSensor'])
			.required(true).multiple(true).permissions('r');
		section.deviceSetting('controlSwitch').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
		section.deviceSetting('checkSwitches').capabilities(['switch'])
			.required(false).multiple(true).permissions('r');
		section.deviceSetting('contacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
	});

	// start and end time (assumes daytime therefore startTime < endTime)
	page.section('time', section => {
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
	});
})


// Handler called whenever app is installed or updated
// Called for both INSTALLED and UPDATED lifecycle events if there is
// no separate installed() handler
.updated(async (context, updateData) => {
	console.log('motionControl: Installed/Updated');

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('motionControl - control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');
	}
	
	console.log('motionControl - END CREATING SUBSCRIPTIONS')
})


// Turn on lights when motion occurs during defined times if dependent lights are on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Determine whether current time is within start and end time window
	var bTimeWindow = SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime));
	
	// Determine if ANY of the switch(es) to check are on
	var bCheckSwitch = true;
	const checkSwitches = context.config.checkSwitches;
	console.log('motionStartHandler - check switches: ', checkSwitches);
	if (checkSwitches) {
		const stateRequests = checkSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));
		
		//set check switch to true if any switch is on
		const switchStates: any = await Promise.all(stateRequests);
		bCheckSwitch = ( switchStates.find(it => it.switch.value === 'on') ) !== undefined;
		console.log('motionStartHandler - are any of check switch(es) on?: ', bCheckSwitch);
	}

	// check to see if home is active
	const bHomeActive: boolean = await SmartState.isHomeActive(context.configStringValue('homeName'));
	console.log('motionStartHandler - home active: ', bHomeActive, ', check switch: ', bCheckSwitch);

	// turn on light if in time window and check switch(es) are on
	if ( ( bTimeWindow && bCheckSwitch ) || bHomeActive) {
		console.log('motionStartHandler - turning lights/switches on');
		await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'on');
	}
})


// Turn off the lights only when all motion sensors become inactive
.subscribedEventHandler('motionStopHandler', async (context, event) => {

	// See if there are any other motion sensors defined
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
		const states: any = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'active')) {
			return
		}
	}
	console.log("motionStopHandler - turn off lights/switches after specified delay");

	const delay = context.configNumberValue('delay')
	if (delay) {
		// Schedule turn off if delay is set
		await context.api.schedules.runIn('motionStopped', delay)
	} else {
		// Turn off immediately if no delay
		await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'off');
	}
})


// Turns off lights/switches after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.controlSwitch, 'switch', 'off');
});

//---------------------------------------------------------------------------------------
// Trigger Control - control virtual switch based on real switches and sensors
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');
const SmartSonos  = require('@katesthings/smartsonos');

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

	// main options page with room controls and behaviors

	// set control enabled flag to control other settings prompts
	let bControlEnabled: boolean = context.configBooleanValue('controlEnabled');

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true).submitOnChange(true);
		if (bControlEnabled) {
			section.modeSetting('modeName').required(false);
		}
	});

	if (bControlEnabled) {
		// controls
		page.section('controls', section => {
			section.deviceSetting('triggerSwitch').capabilities(['switch'])
				.required(true).permissions('rx');		
			// motion and contact switches 
			section.deviceSetting('roomMotion').capabilities(['motionSensor'])
				.required(false).multiple(true).permissions('r');
			// section.numberSetting('motionDelay').required(false).min(0);
			section.deviceSetting('roomContacts').capabilities(['contactSensor'])
				.required(false).multiple(true).permissions('r');
		});

		// delays
		page.section('delays', section => {
			section.numberSetting('offDelay').required(false).min(0).defaultValue(300);
			section.numberSetting('motionDelay').required(false).min(0).defaultValue(60);
			section.numberSetting('openDelay').required(false).min(0).defaultValue(15);
			section.numberSetting('closeDelay').required(false).min(0).defaultValue(30);
		});
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('targetControl - start install/update');
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	} else {
		// create subscriptions for relevant devices
		console.log('targetControl - create subscriptions');

		// initialize motion behavior
		if (context.config.roomMotion) {
			console.log('targetControl - setting up handlers for room motion sensor(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.active', 'motionStartHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.inactive', 'motionStopHandler');
		}

		// initialize contact behaviors
		if (context.config.roomContacts) {
			console.log('targetControl - setting up handlers for room contact(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.open', 'contactOpenHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.closed', 'contactClosedHandler');
		}
	}	
	console.log('targetControl - end creating subscriptions');
})


// Turn on lights when motion occurs during defined times if dependent lights are on
// TODO: turn off handler once lights are turned on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	console.log('motionStartHandler - start');

	const motionEnabled = context.configBooleanValue('motionEnabled');
	console.log('motionStartHandler - motionEnabled: ', motionEnabled);
	if (motionEnabled) {

		// check to see if home is active
		const homeName = context.configStringValue('homeName');
		const bHomeActive: boolean = await SmartState.isHomeActive(homeName);
		console.log('motionStartHandler - home name: ', homeName, ', home active: ', bHomeActive);

		// turn on light if in time window and check switch(es) are on
		if (bHomeActive) {
			const roomSwitchState = await SmartDevice.getSwitchState(context, 'roomSwitch');
			console.log('motionStartHandler - turning lights/switches on, currently: ', roomSwitchState);
			if (roomSwitchState==='off') {
				await SmartDevice.setSwitchState(context, 'roomSwitch', 'on');
			} else {
				await turnRoomOn(context);
			}
			await SmartState.putState(context, 'roomOccupied', 'occupied');	
		}
	}	
	console.log('motionStartHandler - finished');
})


// Turn off the trigger switch when all motion sensors become inactive
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	console.log('motionStopHandler - starting');

	const motionSensors = await SmartDevice.getMotionState(context, 'roomMotion');
	if (motionSensors==='inactive') {
		const delay = context.configNumberValue('motionDelay');
		console.log('motionStopHandler - turn off lights after specified delay: ' + delay);	

		if (delay) {
			// Schedule turning off room switch if delay is set
			console.log('motionStopHandler - run delayedSwitchOff after specified delay: ', delay);
			await context.api.schedules.runIn('delayedSwitchOff', delay)
		} else {
			// Turn room switch off immediately if no delay
			console.log('motionStopHandler - turn room switch off immediately');
			await SmartDevice.setSwitchState(context, 'roomSwitch', 'off');
		}	
	}
})


.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - set room to entering or leaving');	

	// Check to see if lights are already on and room is currently occupied
	const roomSwitch = await SmartDevice.getSwitchState(context, 'roomSwitch'); 
	console.log('contactOpenHandler - room switch state: ', roomSwitch);

	// Set room occupied state to leaving if lights are on, else turn on
	if (roomSwitch==='on') {
		console.log('contactOpenHandler - setting room state to LEAVING');
		SmartState.putState(context, 'roomOccupied', 'leaving');
	} else {
		const homeName = context.configStringValue('homeName');
		const bHomeActive: boolean = await SmartState.isHomeActive(homeName);
		console.log('contactOpenHandler - home name: ', homeName, ', home active: ', bHomeActive);

		// turn on room switch/light(s) if home active
		if (bHomeActive) {
			console.log('contactOpenHandler - turning on room switch, setting room state to ENTERING');
			await SmartState.putState(context, 'roomOccupied', 'entering');
			// TODO: Define timers for checking for activity in room			
			await SmartDevice.setSwitchState(context, 'roomSwitch', 'on');
			context.api.schedules.runIn('delayedSwitchOff', 15);
		}
	}
})	


.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - set room to occupied or vacant');	
	const roomState = await SmartState.getState(context, 'roomOccupied');
	console.log('contactClosedHandler - current room state: ', roomState);
	
	const transientStates = ['entering', 'leaving'];
	if (transientStates.includes(roomState)) {
		console.log('contactClosedHandler - setting room state to VACANT');
		await SmartState.putState(context, 'roomOccupied', 'vacant');
		SmartDevice.setSwitchState(context, 'roomSwitch', 'off');
		// SmartDevice.setSwitchState(context, 'offGroup', 'off');
	} else {
		console.log('contactClosedHandler - setting room state to OCCUPIED');
		await SmartState.putState(context, 'roomOccupied', 'occupied');

		// turn off lights if motion NOT detected within specified time
		const closeDelay = context.configNumberValue('closeDelay');
		if (closeDelay>0) {
			console.log('contactClosedHandler - check for activity after delay: ', closeDelay);
			await context.api.schedules.delete('delayedSwitchOff');
			context.api.schedules.runIn('delayedSwitchOff', closeDelay);
		}
	}
})


// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	console.log('endTimeHandler - starting');
	
	// check to see if routine should be run based on specified day of week
	const daysOfWeek = context.configStringValue('daysOfWeek');
	if ( SmartUtils.isDayOfWeek(daysOfWeek) ) {
		console.log('endTimeHandler - run end time handler today based on daysOfWeek:', daysOfWeek);
		// Turn off room switch(es) if main switch already turned off
		const isRoomOn = await SmartDevice.getSwitchState(context, 'roomSwitch');
		console.log('endTimeHandler - isRoomOn state: ', isRoomOn );
		if (isRoomOn!=='on') {
			console.log('endTimeHandler - turning room switch(es) off since main switch already off');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		}
	}
	console.log('endTimeHandler - finished');
})


// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedSwitchOn', async (context, event) => {
	// console.log('delayedSwitchOn - starting');
	
	console.log('delayedSwitchOn - turning room switch ON, setting room state to OCCUPIED');
	// await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
	SmartDevice.setSwitchState(context, 'roomSwitch', 'on');
	SmartState.putState(context, 'roomOccupied', 'occupied');
})


// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedSwitchOff', async (context, event) => {
	// console.log('delayedSwitchOff - starting');
	
	// save state variable to indicate room switch was turned off by delay
	console.log('delayedSwitchOff - setting room switch mode to delay');
	const roomSwitchState = await SmartDevice.getSwitchState(context, 'roomSwitch');
	console.log('delayedSwitchOff - current room switch state: ', roomSwitchState);
	if (roomSwitchState==='on') {
		console.log('delayedSwitchOff - turning room switch off');
		SmartState.putState(context, 'roomSwitchMode', 'delay');
		SmartDevice.setSwitchState(context, 'roomSwitch', 'off');
		// SmartState.putState(context, 'roomOccupied', 'vacant');
	}
})


// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedGroupOff', async (context, event) => {
	console.log('delayedGroupOff - starting');
	SmartDevice.setSwitchState(context, 'offGroup', 'off');
});

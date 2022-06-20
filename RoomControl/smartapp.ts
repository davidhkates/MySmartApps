//---------------------------------------------------------------------------------------
// Room Control - control lights/switches in room based on sensors, time of day, 
//     and day of week
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');
const axios = require('axios');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');
const SmartSonos  = require('@katesthings/smartsonos');

// SmartApp type definitions
interface device {
	[value: string]: any
}


// Remove console log and console error outputs when not debugging
/*
// console.log('NODEJS environment variable(s): ', process.env);
// if (process.env.NODE_ENV == "production") {
    console.log = function(){}; 
    console.error = function(){}; 
// }
*/

// turn room lights, outlets, and speakers on
async function turnRoomOn( context ) {
	console.log('turnRoomOn - turning on room lights, outlets and speakers');
	await SmartDevice.setSwitchState(context, 'onGroup', 'on');

	// turn on speakers based on setting of speakerBehavior
	const speakerBehavior = context.configStringValue('speakerBehavior');
	if (speakerBehavior==='onAlways' || speakerBehavior==='onActive' &&
		SmartState.isHomeActive(context.stringValue('homeName'))) {		
			await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'play');
	}
};

// turn room lights, outlets, and speakers off
async function turnRoomOff( context ) {
	console.log('turnRoomOff - turning off room lights, outlets and speakers');
	await SmartDevice.setSwitchState(context, 'offGroup', 'off');
	console.log('turnRoomOff - turning speakers off', context.config['roomSpeakers']);
	await SmartSonos.controlSpeakers(context, 'roomSpeakers', 'pause');
};


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// main options page with room controls and behaviors

	// set control enabled flag to control other settings prompts
	let bControlEnabled: boolean = context.configBooleanValue('controlEnabled');
	/*
	if (bControlEnabled === undefined) {
		bControlEnabled = true;
	}
	*/

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true).submitOnChange(true);
		if (bControlEnabled) {
			section.booleanSetting('changeSettings').required(true);
			section.textSetting('homeName').required(false);
		}
	});

	// time window and days of week	
	if (bControlEnabled) {
		page.section('time', section => {
			section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
				defaultValue('everyday').required(true);
			section.timeSetting('startTime').required(false);
			section.timeSetting('endTime').required(false);
		});
	
		// show options page if selected
		console.log('Boolean change settings: ', context.configBooleanValue('changeSettings'));
		if (context.configBooleanValue('changeSettings')) {
			page.nextPageId('optionsPage');
		} else {
			page.nextPageId('controlsPage');
		}
	}
})

.page('optionsPage', (context, page, configData) => {
	page.section('delays', section => {
		section.numberSetting('offDelay').required(false).min(0).defaultValue(300);
		section.numberSetting('motionDelay').required(false).min(0).defaultValue(60);
		section.numberSetting('closeDelay').required(false).min(0).defaultValue(30);
	});

	page.section('options', section => {
		section.enumSetting('contactMode').options(['stayOnAlways', 'stayOnWindow', 'turnOffClose'])
			.required(true).defaultValue('stayOnWindow');
		section.enumSetting('speakerBehavior').options(['doNothing', 'onAlways','onActive'])
			.required(true).defaultValue('doNothing');				
	});	
	
	// show options page if selected
	// if (context.configBooleanValue('useDefaults')) {
		page.nextPageId('controlsPage');
	// }
})

.page('controlsPage', (context, page, configData) => {

	// room switches
	page.section('switches', section => {
		section.deviceSetting('roomSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
			section.deviceSetting('onGroup').capabilities(['switch'])
				.required(true).multiple(true).permissions('rx');
			section.deviceSetting('offGroup').capabilities(['switch'])
				.required(false).multiple(true).permissions('rx');
			// section.numberSetting('offDelay').required(false).min(0);
	});
		
	// get motion and contact sensors 
	page.section('sensors', section => {
		section.booleanSetting('motionEnabled').defaultValue(true);
		section.deviceSetting('roomMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		// section.numberSetting('motionDelay').required(false).min(0);
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		// section.enumSetting('contactMode').options(['stayOnAlways', 'stayOnWindow', 'turnOffClose']);
	});

	// speakers
	page.section('speakers', section => {
		section.deviceSetting('roomSpeakers').capabilities(['audioVolume'])
			.required(false).multiple(true).permissions('rx');
		// section.enumSetting('speakerBehavior').options(['doNothing', 'onAlways','onActive'])
			// .required(true).defaultValue('doNothing');				
	});		
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('roomControl - start install/update');
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete();

	// initialize state variable(s)
	SmartState.putState(context, 'roomOccupied', 'vacant');
	SmartState.putState(context, 'roomSwitchMode', 'manual');

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	} else {
		// create subscriptions for relevant devices
		console.log('roomControl - create subscriptions');
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.on', 'roomSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.off', 'roomSwitchOffHandler');
		
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.on', 'groupOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.off', 'groupOffHandler');

		// initialize motion behavior
		if (context.config.roomMotion) {
			console.log('roomControl - setting up handlers for room motion sensor(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.active', 'motionStartHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.inactive', 'motionStopHandler');
		}

		// initialize contact behaviors
		if (context.config.roomContacts) {
			console.log('roomControl - setting up handlers for room contact(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.open', 'contactOpenHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.closed', 'contactClosedHandler');
		}

		// Schedule endTime activities
		const endTime = context.configStringValue('endTime');
		if (endTime) {
			await context.api.schedules.runDaily('endTimeHandler', new Date(endTime));
		}
	}	
	console.log('roomControl - end creating subscriptions');
})


// Turn on the lights/outlets in the on group when room switch is turned on
.subscribedEventHandler('roomSwitchOnHandler', async (context, event) => {
	// console.log('roomSwitchOnHandler - starting, context: ', context);
	console.log('roomSwitchOnHandler - locationId: ', context.locationId, ', installedAppId: ', context.installedAppId);
	// const modesList = await context.api.modes.get( context.locationId );
	// console.log('roomSwitchOnHandler - modes: ', modesList);
	
	// Get session state variable to see if button was manually pressed
	const roomSwitchMode = await SmartState.getState( context, 'roomSwitchMode' );
	console.log('roomSwitchOnHandler - room switch mode: ', roomSwitchMode);
	
	// Determine if in time window
	const bTimeWindow = ( SmartUtils.inTimeContext( context, 'startTime', 'endTime' ) &&
		SmartUtils.isDayOfWeek( context.configStringValue('daysOfWeek') ) ); 		
	// const onTimeCheck = 'onAlways';
	// console.log('roomSwitchOnHandler - time window: ', bTimeWindow, ', onTimeCheck: ', onTimeCheck);
		
	const roomState = await SmartState.getState( context, 'roomOccupied' );
	console.log('roomSwitchOnHandler - time window: ', bTimeWindow, ', room state: ', roomState);
	// if (bTimeWindow || onTimeCheck==='onAlways') {		
	if (bTimeWindow) {
	
		// Turn onGroup on if switchPressed AND room is NOT in transient state
		const transientStates = ['entering', 'leaving'];
		if ( (roomSwitchMode==='manual') && !(transientStates.includes(roomState)) ) {
			await turnRoomOn(context);			
		} else {
			console.log('roomSwitchOnHandler - main switch NOT pressed, don\'t turn on other lights');
			SmartState.putState(context, 'roomSwitchMode', 'manual');
		}		
	}
		
	// Schedule turning off room switch if delay specified
	const delay = context.configNumberValue('motionDelay');
	console.log('roomSwitchOnHandler - turn off lights after specified delay: ', delay, ', room state: ', roomState);	
	// if (delay && roomState==='occupied') {
	if (delay) {
		console.log('roomSwitchOnHandler - setting delayed switch off');
		await context.api.schedules.runIn('delayedSwitchOff', delay);
	}
	
	// save state variable to indicate room should be turned off immediately
	await SmartState.putState(context, 'roomSwitchMode', 'manual');
	console.log('roomSwitchOnHandler - finished');	
})


// Turn off the lights in the offGroup when room switch is turned off
.subscribedEventHandler('roomSwitchOffHandler', async (context, event) => {
	// Set room occupied state to vacant
	console.log('roomSwitchOffHandler - starting');
	
	// get state variable to see if room switch was turned off by delay
	const roomSwitchMode = await SmartState.getState(context, 'roomSwitchMode');		
	console.log('roomSwitchOffHandler - room switch mode: ', roomSwitchMode);

	if (roomSwitchMode==='manual') {
		await turnRoomOff(context);
	} else {
	
		// Determine if in time window
		const daysOfWeek = context.configStringValue('daysOfWeek');	
		const bTimeWindow = ( SmartUtils.inTimeContext( context, 'startTime', 'endTime' ) &&
			SmartUtils.isDayOfWeek( context.configStringValue('daysOfWeek') ) &&
			!!(context.configStringValue('startTime')) ); 		
			
		console.log('roomSwitchOffHandler - in time window: ', bTimeWindow);
		if (!bTimeWindow) {	
			console.log('roomSwitchOffHandler - outside time window');
			const offDelay = context.configNumberValue('offDelay')
			
			if (offDelay>0 && roomSwitchMode==='delay') {
				console.log('roomSwitchOffHandler - turning off group after delay, ' + offDelay);
				await context.api.schedules.runIn('delayedGroupOff', offDelay);
			} else {
				await turnRoomOff(context);
			}
		}
	}
	
	// Set room switch mode to manual and room occupied to vacant
	SmartState.putState(context, 'roomSwitchMode', 'manual');
	SmartState.putState(context, 'roomOccupied', 'vacant');
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('groupOnHandler', async (context, event) => {
	console.log('groupOnHandler starting - turn on main room switch');

	// indicate room switch was turned on from 'group' handler
	SmartState.putState(context, 'roomSwitchMode', 'group');
	await SmartDevice.setSwitchState(context, 'roomSwitch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('groupOffHandler', async (context, event) => {
	console.log('groupOffHandler - starting');

	// See if there are any other switches in the onGroup defined
	const otherOnGroup = context.config.onGroup
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	// Get the current states of the other switches in the on group
	if (otherOnGroup) {
		const stateRequests = otherOnGroup.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));	

		// Quit if there are other switches still on
		const states: any = await Promise.all(stateRequests);
		if (states.find(it => it.switch.value === 'on')) {
			return
		}
	}

	// If we get here, turn off the main switch and reset roomSwitchPressed state variable
	console.log('groupOffHandler - turning off lights/switches');
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
	// SmartState.putState(context, 'roomSwitchPressed', 'true');
	SmartState.putState(context, 'roomSwitchMode', 'manual');
	console.log('groupOffHandler - done');
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
	
	// Cancel delayed off switch handler
	console.log('motionStartHandler - deleting scheduled activities');
	await context.api.schedules.delete('delayedSwitchOff');
	await context.api.schedules.delete('delayedGroupOff');
	console.log('motionStartHandler - finished');
})


// Turn off the lights only when all motion sensors become inactive
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
			await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
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
			SmartDevice.setSwitchState(context, 'roomSwitch', 'on');
			// context.api.schedules.runIn('delayedSwitchOn', 15);		
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
		SmartDevice.setSwitchState(context, 'offGroup', 'off');
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
//---------------------------------------------------------------------------------------
// Room Control - control lights/switches in room based on sensors, time of day, 
//     and day of week
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}

// var aws = require('aws-sdk');
// aws.config.update({region: 'us-west-2'});


// Utility functions for this automation
/*
async function scheduleEndHandler( context ) {
	// schedule room end handler at specified time, if specified
	const endTime = context.configStringValue('endTime');
	if (endTime) {
		await context.api.schedules.runDaily('endTimeHandler', new Date(endTime));
	}
}
*/

/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// main options page with room controls and behaviors
	// page.nextPageId('optionsPage');

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true);
	});

	// room switches
	page.section('controls', section => {
		section.deviceSetting('roomSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('onGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
		section.enumSetting('onTimeCheck').options(['onWindow', 'onAlways']);
		// section.enumSetting('onBehavior').options(['onBefore', 'onAfter', 'onAlways']);
		section.deviceSetting('offGroup').capabilities(['switch'])
			.required(false).multiple(true).permissions('rx');
		section.numberSetting('offDelay').required(false).min(0);
	});

	// specify next (second) options page
	page.nextPageId('optionsPage');
})

.page('optionsPage', (context, page, configData) => {
	// room motion sensor(s) and door/window contact(s)
	page.section('sensors', section => {
		section.deviceSetting('roomMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		// section.deviceSetting('roomMotionOn').capabilities(['motionSensor'])
		//	.required(false).multiple(true).permissions('r');
		section.numberSetting('motionDelay').required(false).min(0);
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactMode').options(['allOpen', 'allClosed', 'anyOpen', 'anyClosed']);
	});

	page.section('speakers', section => {
		section.deviceSetting('roomSpeakers').capabilities(['audioVolume'])
		// section.deviceSetting('roomSpeakers').capabilities(['audioMute'])
			.required(false).multiple(true).permissions('rx');
	});

	// behavior at turn switch off and delay, if applicable
	/*
	page.section('behavior', section => {
		section.enumSetting('offBehavior').options(['group','speakers', 'all','none'])
			.defaultValue('both').required('true');
		section.numberSetting('offDelay').required(false).min(0).defaultValue(0);
	});
	*/

	// time window and days of week
	page.section('time', section => {
		section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
			defaultValue('everyday').required(true);
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
	});

	// specify next (third) options page
	// page.nextPageId('timePage');
})

/*
.page('timePage', (context, page, configData) => {
	
	// pointer to previous (second) configuration page
	// page.prevPageId('optionsPage');
	
	// time window and days of week
	page.section('time', section => {
		section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
			defaultValue('everyday').required(true);
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
	});
})
*/


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('roomControl - start install/update');
	// console.log('Context, room speakers: ', context.config.roomSpeakers);
	// console.log('Context, on group: ', context.config.onGroup);
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	// await context.api.schedules.delete('roomOnHandler');
	// await context.api.schedules.delete('roomOffHandler');
	await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	// console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		// await context.api.devices.sendCommands(context.config.delayGroup, 'switch', 'off');
	} else {
		// Get current appSettings to determine which devices need subscriptions 
		// appSettings = await getCurrentSettings(context);
		// console.log('App settings: ', appSettings);

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
		// await context.api.subscriptions.subscribeToDevices(context.config.roomMotionOn,
		await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');

		// initialize contact behaviors
		await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
		    'contactSensor', 'contactSensor.open', 'contactOpenHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
		    'contactSensor', 'contactSensor.closed', 'contactClosedHandler');

		// Schedule endTime activities
		// await scheduleEndHandler(context);
		const endTime = context.configStringValue('endTime');
		if (endTime) {
			await context.api.schedules.runDaily('endTimeHandler', new Date(endTime));
		}
	}	
	console.log('roomControl - end creating subscriptions');
})


// Turn on the lights/outlets in the on group when room switch is turned on
.subscribedEventHandler('roomSwitchOnHandler', async (context, event) => {
	console.log('roomSwitchOnHandler - starting');
	
	// Get start and end times
	const startTime = context.configStringValue('startTime');
	const endTime = context.configStringValue('endTime');
	const onTimeCheck = context.configStringValue('onTimeCheck');

	// Determine whether current time is within start and end time window
	var bTimeWindow = SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime));
	console.log('roomSwitchOnHandler - time window: ', bTimeWindow, ', onTimeCheck: ', onTimeCheck);
		
	if (bTimeWindow || onTimeCheck==='onAlways') {		
	
		// Cancel scheduled event to turn off main switch after delay
		await context.api.schedules.delete('delayedOffSwitch');
		
		// Only turn on switches in the on group if none have already been turned on
		const onGroupSwitches = context.config.onGroup;
		if (onGroupSwitches) {
			// Get the current states of the switches in the on group
			const onGroupStates = await onGroupSwitches.map(it => context.api.devices.getCapabilityStatus(
				it.deviceConfig.deviceId,
				it.deviceConfig.componentId,
				'switch'
			));	
			
			const states: device = await Promise.all(onGroupStates);
			// If any switches in the on group are already on, don't turn on others
			if (states.find(it => it.switch.value === 'on')) {
				console.log('roomSwitchOnHandler - switch(es) in on group already on, do not turn on group')
			} else {
				console.log('roomSwitchOnHandler - turn on switches in on group');
				await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
			}
		}
	}
	
	// Schedule turning off room switch if delay specified
	const delay = context.configNumberValue('motionDelay');
	console.log('roomSwitchOnHandler - turn off lights after specified delay: ' + delay);	
	if (delay) {
		await context.api.schedules.runIn('delayedSwitchOff', delay);
	}
	
	// save state variable to indicate room should be turned off immediately
	SmartState.putState(context, 'roomOff', 'immediate');		
	
})


// Turn off the lights in the offGroup when room switch is turned off
.subscribedEventHandler('roomSwitchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	console.log('roomSwitchOffHandler - starting');
	
	// Get start and end times
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");

	// Determine whether current time is within start and end time window
	var bTimeWindow = SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime));
	
	console.log('roomSwitchOffHandler - in time window: ', bTimeWindow);
	if (!bTimeWindow) {	
		console.log('roomSwitchOffHandler - outside time window');
		const offDelay = context.configNumberValue('offDelay')
		console.log('roomSwitchOffHandler - off delay: ', offDelay);
		
		// get state variable to see if room switch was turned off by delay
		const roomState = await SmartState.getState(context, 'roomOff');
		console.log('roomSwitchOffHandler - room off context value: ', roomState);

		if (offDelay>0 && roomState==='delay') {
			console.log('roomSwitchOffHandler - turning off group after delay, ' + offDelay);
			await context.api.schedules.runIn('delayedGroupOff', offDelay);
		} else {
			console.log('roomSwitchOffHandler - turning off group immediately');
			await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
			// await context.api.devices.sendComments(context.config.roomSpeakers, 'mute', 'setMute');
			// await context.api.devices.sendComments(context.config.roomSpeakers, 'supportedPlaybackCommand', 'stop');
			console.log('roomSwitchOffHandler - turning off group complete');
		}
	}


/*
	// get app settings from room settings table, if specified
	const offBehavior = getSettingValue(context, 'offBehavior');
	const offDelay: number = parseInt(getSettingValue(context, 'offDelay'), 10);
	// const mainList = ['main', 'both'];
	// const groupList = ['group', 'both'];
	console.log('Turn off lights based on off behavior: ' + offBehavior);
*/

/*
	const offBehavior = context.configStringValue('offBehavior');
	const offDelay = parseInt(context.configStringValue('offDelay'), 10);

	// if (offBehavior==='main' || offBehavior==='both') await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
	// if (offBehavior==='group' || offBehavior==='all') {
	if (offBehavior!='none') {
		if (offDelay>0) {
			console.log('Turning off group after delay, ' + offDelay);
			await context.api.schedules.runIn('delayedGroupOff', offDelay);
		} else {
			console.log('Turning off group immediately');
			await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
			// await context.api.devices.sendComments(context.config.roomSpeakers, 'playbackStatus', 'stopped');
		}
	}
*/
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('groupOnHandler', async (context, event) => {
	console.log('groupOnHandler - starting');

	// indicate main switch was NOT manually pressed
	// stateVariable.putState( context.event.appId, 'roomSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'on');
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
	// stateVariable.putState( context.event.appId, 'roomSwitchPressed', 'true' );
})


// Turn on lights when motion occurs during defined times if dependent lights are on
// TODO: turn off handler once lights are turned on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	console.log('motionStartHandler - start');

	// turn on room switch
	console.log('motionStartHandler - turning room light(s) on');
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'on');
	
	/*
	// Get motion behavior setting
	// appSettings = await getCurrentSettings(context);
	// const motionBehavior = getSettingValue(context, 'motionBehavior');
	const motionBehavior = context.getStringValue('motionBehavior');

	// Determine if ANY of the switch(es) to check are on
	var bCheckSwitch = true;
	const checkSwitches = context.config.checkSwitches;
	console.log("Check switches: " + checkSwitches);
	if (checkSwitches) {
		const stateRequests = checkSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));
		
		//set check switch to true if any switch is on
		const switchStates = await Promise.all(stateRequests);
		console.log("Switch states: " + switchStates);
		bCheckSwitch = ( switchStates.find(it => it.switch.value === 'on') );		
	}
	
	// turn on light if in time window and check switch(es) are on
	console.log('Checking motionBehavior and check switch values: ' + motionBehavior);
	if ( motionBehavior==='occupancy' && bCheckSwitch ) {
		console.log('Turning light(s) on');
		await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'on');
		// console.log('Unsubscribe from room motion sensor: ', context);
		// await context.api.subscriptions.unsubscribe('motionStartHandler');
	}
	*/
	
	// Cancel delayed off switch handler
	await context.api.schedules.delete('delayedSwitchOff');
	console.log('motionStartHandler - end');
})


// Turn off the lights only when all motion sensors become inactive
// TODO: Turn on motion handler handler if being used to turn on lights
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	console.log('motionStopHandler - starting');

	// See if there are any other motion sensors defined
	const otherSensors =  context.config.roomMotion
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	if (otherSensors) {
		console.log('motionStopeHandler - other sensors found');
		// Get the current states of the other motion sensors
		const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'motionSensor'
		));

		// Quit if there are other sensor still active
		const states: any = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'active')) {
			console.log('motionStopHandler - other motion sensors active');
			return;
		}
	}
	console.log('motionStopHandler - all other motion sensors inactive');

	// const delay = context.configNumberValue('motionDelay')
	// appSettings = await getCurrentSettings(context);
	// const delay = getSettingValue(context, 'motionDelay');
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
	// await context.api.schedules.runIn('delayedSwitchOff', delay);
})


/*
// Schedule activity(ies) to be performed at start time
.scheduledEventHandler('startTimeHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( SmartSensor.getSwitchState( context, context.config.roomSwitch[0] ) ) {
		console.log('Turning room switch(es) on since main switch already on');
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
	}
})
*/

// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	console.log('endTimeHandler starting');
	
	// check to see if routine should be run based on specified day of week
	// TODO: confirm that isDaysOfWeek works if daysOfWeek is NULL
	const daysOfWeek = context.configStringValue('daysOfWeek');
	if ( SmartUtils.isDayOfWeek(daysOfWeek) ) {
		console.log('endTimeHandler - run end time handler today based on daysOfWeek:', daysOfWeek);
		// Turn off room switch(es) if main switch already turned off
		if ( !SmartDevice.getSwitchState( context, context.config.roomSwitch[0] ) ) {
			console.log('endTimeHandler - turning room switch(es) off since main switch already off');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		}
	}
})

/*
// Turns off lights after delay when motion stops
.scheduledEventHandler('delayedMotionStop', async (context, event) => {
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
})
// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedMainOff', async (context, event) => {
	console.log('Delayed switch off turning off main switch');
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
})
*/

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedGroupOff', async (context, event) => {
	console.log('delayedGroupOff - starting');
	await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
})

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedSwitchOff', async (context, event) => {
	console.log('delayedSwitchOff - starting');
	
	// save state variable to indicate room switch was turned off by delay
	console.log('delayedSwitchOff - setting roomOff state variable to delay');
	SmartState.putState(context, 'roomOff', 'delay');	
	
	console.log('delayedSwitchOff - turning off room switch');
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
});

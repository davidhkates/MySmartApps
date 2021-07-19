//---------------------------------------------------------------------------------------
// Room Control - control lights/switches in room based on settings in in app or
//      smartapp-room-settings DynamoDB parameter values
//
//	offBehavior (main, group, both, none)
//      endBehavior (offNow, checkMain, checkNext)			
//---------------------------------------------------------------------------------------



// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
// const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}


// global variables
let appSettings: any = {}

//----------------------------------------------------------------------------------------
// TODO: move routines to get settings values from DynamoDB database to katesthings
//----------------------------------------------------------------------------------------
var aws = require('aws-sdk');
aws.config.update({region: 'us-west-2'});

async function getAppSettings(room) {
	var docClient = new aws.DynamoDB.DocumentClient();
	const params = {
  		TableName: 'smartapp-room-settings',
  		KeyConditionExpression: 'room = :room',
		ExpressionAttributeValues: {
    			':room': room
		}		
	};
	console.log('Params: ', params);

	/*
	var bFound = false;
	await docClient.query(params, function(err, data) {
		if (err) {
        		console.log("Error querying state machine: ", JSON.stringify(err, null, 2));
    		} else {
        		console.log("Query succeeded: ", data.Items);
			return data.Items;
		}
	});
	*/
	
	try {
		const data = await docClient.query(params).promise();
		return data.Items;
	} catch (err) {
		console.log("Failure", err.message);
		return undefined;
	}
};

async function getCurrentSettings(context) {
	// check to see if settings database room name specified
	const roomName: string = context.configStringValue('roomName');
	console.log('Room name specified: ', roomName);
	if (roomName) {
		// find settings from database for current app
		const items: any = await getAppSettings(roomName);
		console.log('Items: ', items);

		if (items) {

			// get local time and day of week for today
			const daysOfWeek = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
			const localToday = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
			const localDate = new Date(localToday);
			const strLocalTime = localDate.getHours().toString().padStart(2,'0') + localDate.getMinutes().toString().padStart(2,'0');
			const strDayOfWeek = daysOfWeek[localDate.getDay()];

			// find state data for current day/time
			// let bFound: boolean = false;
			for (const item of items) {
				console.log('Item: ', item);
				if (item.daysofweek.includes(strDayOfWeek) && 
						( (!item.startTime && !item.endTime) ||
						(strLocalTime>=item.startTime) && (strLocalTime<item.endTime) ) ) {
					// console.log('Current settings found: ', item);
					return item;
					break;
				}
			}
		}
	}
};

// function getSettingValue(context, settingName, bAppOnly) {
function getSettingValue(context, settingName) {
	// declare variable to return stateVariables
	let settingValue: string;

	// see if settings found in smartapp DynamoDB database
	if (appSettings) {
		settingValue = appSettings[settingName];
	// } else if (!bAppOnly) {
	} else {
		settingValue ??= context.configStringValue(settingName);
	}
	return settingValue;
};

// convert time in hhmm format to javascript date object
function convertDateTime( hhmm ) {
	const now = new Date();
	// const tzOffset = now.getUTCHours() - now.getHours();
	const tzOffset = now.getUTCHours() - parseInt(now.toLocaleString("en-US", {timeZone: "America/Denver", hour12: false, hour: "numeric"}), 10);
	const localDate: string = new Date().toLocaleString("en-US", {timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"});
	const localTime: any = new Date(parseInt(localDate.substr(6, 4), 10), parseInt(localDate.substr(0, 2), 10)-1, parseInt(localDate.substr(3, 2), 10),
		parseInt(hhmm.substr(0, 2), 10), parseInt(hhmm.substr(2, 2), 10));
	console.log('Local time: ', localTime, localDate, tzOffset);
	const returnValue: Date = new Date(localTime.valueOf() + (tzOffset>0 ? tzOffset : 24+tzOffset)*60*60*1000);
	console.log('Converted date/time: ', returnValue.toLocaleString("en-US", {timeZone: "America/Denver"}));
	return returnValue;
};

// schedule activities for current end time
async function scheduleEndHandler(context) {
	// Schedule endTime activities based on endBehavior(s) ('checkMain', 'offMain', 'offGroup', 'motionOn')	
	const endTime = convertDateTime( getSettingValue(context, 'endTime') );
	if (endTime) {
		console.log('Run end time handler at: ', endTime.toLocaleString("en-US", {timeZone: "America/Denver"}));
		const endBehavior = getSettingValue(context, 'endBehavior') ?? 'checkNext';
		console.log('End behavior: ', endBehavior);
		SmartState.putState(context, 'endBehavior', endBehavior);
		await context.api.schedules.runOnce('endTimeHandler', endTime);
	}
};


/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// separate page for options that aren't needed if states set in DynamoDB (specified by keyName)
	page.nextPageId('optionsPage');

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true);
		section.textSetting('roomName').required(false);
	});

	// room switches
	page.section('controls', section => {
		section.deviceSetting('mainSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('onGroup').capabilities(['switch'])
			.required(true).multiple(true).permissions('rx');
		section.deviceSetting('offGroup').capabilities(['switch'])
			.required(false).multiple(true).permissions('rx');
	});
})

.page('optionsPage', (context, page, configData) => {
	
	// separate page for options that aren't needed if states set in DynamoDB (specified by keyName)
	// page.nextPageId('timePage');

	// room motion sensor(s) and door/window contact(s)
	page.section('sensors', section => {
		section.deviceSetting('roomMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		section.numberSetting('motionDelay').required(false).min(0);
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactMode').options(['allOpen', 'allClosed', 'anyOpen', 'anyClosed']);
	});

	page.section('speakers', section => {
		section.deviceSetting('roomSpeakers').capabilities(['audioVolume'])
			.required(false).multiple(true).permissions('rx');
	});

	// behavior at turn switch off and delay, if applicable
	// TODO: align with DynamoDB choices
	page.section('behavior', section => {
		section.enumSetting('offBehavior').options(['main','group','both','none'])
			.defaultValue('both').required('true');
		section.numberSetting('offDelay').required(false).min(0).defaultValue(0);
	});
})

/*
.page('timePage', (context, page, configData) => {
	
	// separate page for options that aren't needed if states set in DynamoDB (specified by keyName)
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
	console.log("RoomControl: Installed/Updated");
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	// await context.api.schedules.delete('roomOnHandler');
	// await context.api.schedules.delete('roomOffHandler');
	await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		// await context.api.devices.sendCommands(context.config.delayGroup, 'switch', 'off');
	} else {

		// Get current appSettings to determine which devices need subscriptions 
		appSettings = await getCurrentSettings(context);
		// console.log('App settings: ', appSettings);

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.on', 'mainSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.off', 'mainSwitchOffHandler');
		
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.on', 'groupOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.off', 'groupOffHandler');

		// initialize motion behavior
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
		await scheduleEndHandler(context);
		
	}	
	console.log('RoomControl: END CREATING SUBSCRIPTIONS')
})


// Turn on the lights/outlets in the on group when main switch is pressed
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Cancel scheduled event to turn off main switch after delay
	await context.api.schedules.delete('delayedOffSwitch');
	
	// Get session state variable to see if button was manually pressed
	console.log('Checking whether all switches in on group are off');
	const onGroupSwitches = context.config.onGroup;
	console.log('On group switches: ', onGroupSwitches);
	if (onGroupSwitches) {
		// Get the current states of the switches in the on group
		const onGroupStates = await onGroupSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));	
		
		const states: device = await Promise.all(onGroupStates);
		if (states.find(it => it.switch.value === 'on')) {
			console.log('Switch(es) in on group already on, do not turn on group')
		} else {
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
		}
	}
})


// Turn off the lights when main switch is pressed
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	// console.log("Turn off all lights in on and off groups");
	const offBehavior = getSettingValue(context, 'offBehavior');
	const offDelay = getSettingValue(context, 'offDelay');
	const mainList = ['main', 'both'];
	const groupList = ['group', 'both'];
	console.log('Turn off lights based on off behavior: ', context.config.offBehavior, offBehavior);

	if (offBehavior==='main' || offBehavior==='both') await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	if (offBehavior==='group' || offBehavior==='both') {
		if (offDelay) {
			await context.api.schedules.runIn('delayedGroupOff', offDelay);
		} else {
			await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
			// await context.api.devices.sendComments(context.config.roomSpeakers, 'playbackStatus', 'stopped');
		}
	}
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('groupOnHandler', async (context, event) => {
	console.log("Turn on the main switch when a light in the on group is turned on");

	// indicate main switch was NOT manually pressed
	// stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('groupOffHandler', async (context, event) => {
	console.log("Turn off the main switch when ALL lights in the on group are turned off");

	// See if there are any other switches in the onGroup defined
	const otherOnGroup = context.config.onGroup
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	// Get the current states of the other motion sensors
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

	// If we get here, turn off the main switch and reset mainSwitchPressed state variable
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	// stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
})


/*
// Turn off the room switch(es) if light turned off outside of time window
.subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
	// Check today is specified day of week
	if (SmartUtils.isDayOfWeek(context.configStringValue("daysOfWeek"))) {
		const startTime  = context.configStringValue("startTime");
		const endTime    = context.configStringValue("endTime");
		// Turn off room switch(es) if outside time window when light switch turned off
		if ( !SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime)) ) {
			console.log('Turning room switch(es) off');
			await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		}
	}
})
*/


// Turn on lights when motion occurs during defined times if dependent lights are on
// TODO: turn off handler once lights are turned on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	// Get motion behavior setting
	appSettings = await getCurrentSettings(context);
	const motionBehavior = getSettingValue(context, 'motionBehavior');

	// Determine if ANY of the switch(es) to check are on
	var bCheckSwitch = true;
	/*
	const checkSwitches = context.config.checkSwitches;
	console.log("Check switches: ", checkSwitches);
	if (checkSwitches) {
		const stateRequests = checkSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));
		
		//set check switch to true if any switch is on
		const switchStates = await Promise.all(stateRequests);
		console.log("Switch states: ", switchStates);
		bCheckSwitch = ( switchStates.find(it => it.switch.value === 'on') );		
	}
	*/
	
	// turn on light if in time window and check switch(es) are on
	if ( motionBehavior==='occupancy' && bCheckSwitch ) {
		console.log('Turning light(s) on');
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
		// console.log('Unsubscribe from room motion sensor: ', context);
		// await context.api.subscriptions.unsubscribe('motionStartHandler');
	}
	
	// Cancel delayed off switch handler
	await context.api.schedules.delete('delayedSwitchOff');
})


// Turn off the lights only when all motion sensors become inactive
// TODO: Turn on motion handler handler if being used to turn on lights
.subscribedEventHandler('motionStopHandler', async (context, event) => {

	// See if there are any other motion sensors defined
	const otherSensors =  context.config.roomMotion
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

	// const delay = context.configNumberValue('motionDelay')
	appSettings = await getCurrentSettings(context);
	const delay = getSettingValue(context, 'motionDelay');
	console.log("Turn off lights after specified delay: ", delay);

	/*
	if (delay) {
		// Schedule turn off if delay is set
		console.log("Subscribing to delayedSwitchOff routine after specified delay: ", delay);
		await context.api.schedules.runIn('delayedSwitchOff', delay)
	} else {
		// Turn off immediately if no delay
		// await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		console.log("Subscribing to delayedSwitchOff routine with 60 second delay");
		await context.api.schedules.runIn('delayedSwitchOff', 60)
	}
	*/
	await context.api.schedules.runIn('delayedSwitchOff', 900);
})


/*
// Schedule activity(ies) to be performed at start time
.scheduledEventHandler('startTimeHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( SmartSensor.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) on since main switch already on');
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
	}
})
*/

// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	const endBehavior = SmartState.getValue(context, 'endBehavior');

	if ( endBehavior.includes('checkMain') ) {
		// Turn on room switch(es) if main switch already turned on
		if ( SmartSensor.getSwitchState( context, context.config.mainSwitch[0] ) ) {
			console.log('Turning room switch(es) on since main switch already on');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		}
	} else if ( endBehavior.includes('offMain') ) {

		// Turn off room switch(es) when end time reached
		console.log('Turning off main switch at specified end time');
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	} else if ( endBehavior.includes('onMain') ) {

		// Turn on room switch(es) when end time reached
		console.log('Turning on main switch at specified end time');
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		
	}
	
	// Schedule next endTime activities based on endBehavior(s) ('checkMain', 'offMain', 'offGroup', 'onGroup, 'motionOn', 'checkNext')	
	appSettings = await getCurrentSettings(context);
	await scheduleEndHandler(context);
})

/*
// Turns off lights after delay when motion stops
.scheduledEventHandler('delayedMotionStop', async (context, event) => {
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
})

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedMainOff', async (context, event) => {
	console.log('Delayed switch off turning off main switch');
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
})
*/

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedGroupOff', async (context, event) => {
	console.log('Turn off lights in offGroup after delay');
	await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
})

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedSwitchOff', async (context, event) => {
	console.log('Delayed switch off turning off main switch');
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
});

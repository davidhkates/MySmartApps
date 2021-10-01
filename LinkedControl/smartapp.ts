//---------------------------------------------------------------------------------------
// Linked Control - control lights/switches in room based on sensors, time of day, 
//     and day of week
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
/*
let appSettings: any = {};
let bCheckSettings: boolean = false;
let logSettings = 'dynamo';	// console to log to CloudWatch console, dynamo to log to DynamoDB log, else don't log
const logCategory = 'RoomControl';
const logMessageTypes = ['INFO', 'ERROR', 'DEBUG', 'ENTRY', 'EXIT'];
*/

//----------------------------------------------------------------------------------------
// TODO: move routines to get settings values from DynamoDB database to katesthings
//----------------------------------------------------------------------------------------
var aws = require('aws-sdk');
aws.config.update({region: 'us-west-2'});

/*
async function getAppSettings(room) {
	var dynamoDB = new aws.DynamoDB.DocumentClient();
	dynamoDB.get({
		TableName: 'smartapp-room-settings',
		Key: {
			room: room,
		},
	}).promise()
	.then(function(data) {
		return data.Items;
	})
	.catch(console.error);		
};

// write log entry to circular log
async function console.log(logRecord, recordType="INFO") {
	// check to make sure message type should be logged
	if (logMessageTypes.includes(recordType)) {
		
		// send log to destination specified in logSettings
		// TODO: make logSettings a JSON object
		if (logSettings==='console') {
			console.log(logRecord);
		} else if (logSettings==='dynamo') {
			const dynamoDB = new aws.DynamoDB.DocumentClient();
			const logTable = 'smartapp-circular-log';

			// get metadata from circular log file
			dynamoDB.get({
				TableName: logTable,
				Key: {
					logItem: 0,	// record 0 contains circular log metadata
				},
			}).promise()
			.then(function(data) {		
				let logOffset: number = data.Item.logOffset;
				const maxRecords: number = data.Item.maxRecords;

				// write log record to next entry in circular table
				dynamoDB.put({
					Item: {
						logItem: logOffset,
						logCategory: recordType,
						logRecord: logRecord,
						timestamp: new Date().toLocaleString("en-US", {timeZone: "America/Denver"}),
					},
					TableName: logTable,
				}).promise();

				// update metadata
				if (logOffset++ == maxRecords) { logOffset = 1 };
				dynamoDB.update({
					Key: {
						logItem: 0
					},				
					AttributeUpdates: {
						logOffset: {
							Action: 'PUT',
							Value: logOffset
						},
					},
					TableName: logTable,
				}).promise()
				// .then( data => console.log(data.Attributes))
				.catch(console.error);		
			})		
			.catch(console.error);
		}
	}
};	

async function getCurrentSettings(context) {
	// mark bCheckSettings true regardless of outcome
	bCheckSettings = true;
	
	// check to see if settings database room name specified
	const roomName: string = context.configStringValue('roomName');
	console.log('Room name specified: ' + roomName);
	
	if (roomName) {
		// find settings from database for current app
		const items: any = await getAppSettings(roomName);
		console.log('Room settings found: ' + bCheckSettings);

		if (items) {

			// get local time and day of week for today
			const daysOfWeek = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
			const localToday = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
			const localDate = new Date(localToday);
			console.log('Current settings assigne local date constants: ' + localDate.toString());
			const strLocalTime = localDate.getHours().toString().padStart(2,'0') + localDate.getMinutes().toString().padStart(2,'0');
			const strDayOfWeek = daysOfWeek[localDate.getDay()];
			console.log('Current settings constants assigned: day: ' + strDayOfWeek + ', time: ' + strLocalTime);

			// find state data for current day/time
			for (const item of items) {
				if (item.daysofweek.includes(strDayOfWeek) && 
						( (!item.startTime && !item.endTime) ||
						(strLocalTime>=item.startTime) && (strLocalTime<item.endTime) ) ) {
					return item;
					break;
				}
			}
		}
		console.log('Room settings retrieved');
	}
};

function getSettingValue(context, settingName) {
	// declare variable to return stateVariables
	let settingValue: string;

	// get current settings if not already checked
	if (!bCheckSettings) {
		getCurrentSettings(context);
	}
	
	// see if settings found in smartapp DynamoDB database
	if (appSettings) {
		settingValue = appSettings[settingName];
	// } else if (!bAppOnly) {
	} else {
		settingValue ??= context.configStringValue(settingName);
		console.log('Get setting value: ' + settingName + ', ' + settingValue);
	}
	return settingValue;
};
*/

// convert time in hhmm format to javascript date object
function convertDateTime( hhmm ) {
	let returnValue: Date = null;
	if (hhmm) {
		const now = new Date();
		// const tzOffset = now.getUTCHours() - now.getHours();
		const tzOffset = now.getUTCHours() - parseInt(now.toLocaleString("en-US", {timeZone: "America/Denver", hour12: false, hour: "numeric"}), 10);
		const localDate: string = new Date().toLocaleString("en-US", {timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"});
		const localTime: any = new Date(parseInt(localDate.substr(6, 4), 10), parseInt(localDate.substr(0, 2), 10)-1, parseInt(localDate.substr(3, 2), 10),
			parseInt(hhmm.substr(0, 2), 10), parseInt(hhmm.substr(2, 2), 10));
		console.log('Local time: ' + localTime + " " + localDate + ', time zone offset: ' + tzOffset);
		const returnValue: Date = new Date(localTime.valueOf() + (tzOffset>0 ? tzOffset : 24+tzOffset)*60*60*1000);
		console.log('Converted date/time: ' + returnValue.toLocaleString("en-US", {timeZone: "America/Denver"}));
	}
	return returnValue;
};

/*
// schedule activities for current end time
async function scheduleEndHandler(context) {
	// Schedule endTime activities based on specified endBehavior setting
	const endTime = getSettingValue(context, 'endTime');
	if (endTime) {
		const endDateTime = convertDateTime(endTime);
		const endBehavior = getSettingValue(context, 'endBehavior') ?? 'checkNext';
		console.log('Run end time handler at: ' + endDateTime.toLocaleString("en-US", {timeZone: "America/Denver"}) + ', behavior: ' + endBehavior);
		SmartState.putState(context, 'endBehavior', endBehavior);
		await context.api.schedules.runOnce('endTimeHandler', endDateTime);
	}
};
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
		section.deviceSetting('offGroup').capabilities(['switch'])
			.required(false).multiple(true).permissions('rx');
	});

	// specify next (second) options page
	page.nextPageId('optionsPage');
})

.page('optionsPage', (context, page, configData) => {
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
	page.section('behavior', section => {
		section.enumSetting('offBehavior').options(['group','speakers', 'all','none'])
			.defaultValue('both').required('true');
		section.numberSetting('offDelay').required(false).min(0).defaultValue(0);
	});
	
	// specify next (third) options page
	page.nextPageId('timePage');

})

.page('timePage', (context, page, configData) => {
	
	// pointer to previous (second) configuration page
	page.prevPageId('optionsPage');
	
	// time window and days of week
	page.section('time', section => {
		section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
			defaultValue('everyday').required(true);
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
	});
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log("Installed/Updated - start creating subscriptions");
	
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
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.on', 'roomSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomSwitch,
		    'switch', 'switch.off', 'roomSwitchOffHandler');
		
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
		// await scheduleEndHandler(context);
		
	}	
	// console.log('RoomControl: END CREATING SUBSCRIPTIONS');
	console.log('End creating subscriptions');
})


// Turn on the lights/outlets in the on group when room switch is turned on
.subscribedEventHandler('roomSwitchOnHandler', async (context, event) => {
	console.log('ENTRY roomSwitchOnHandler', 'ENTRY');
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
			console.log('Switch(es) in on group already on, do not turn on group')
		} else {
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
		}
	}
})


// Turn off the lights in the offGroup when room switch is turned off
.subscribedEventHandler('roomSwitchOffHandler', async (context, event) => {
	// Turn on the lights in off group based on behavior setting
	console.log('ENTRY roomSwitchOffHandler', 'ENTRY');

/*
	// get app settings from room settings table, if specified
	const offBehavior = getSettingValue(context, 'offBehavior');
	const offDelay: number = parseInt(getSettingValue(context, 'offDelay'), 10);
	// const mainList = ['main', 'both'];
	// const groupList = ['group', 'both'];
	console.log('Turn off lights based on off behavior: ' + offBehavior);
*/
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
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('groupOnHandler', async (context, event) => {
	console.log('ENTRY groupOnHandler', 'ENTRY');

	// indicate main switch was NOT manually pressed
	// stateVariable.putState( context.event.appId, 'roomSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('groupOffHandler', async (context, event) => {
	console.log('ENTRY groupOffHandler', 'ENTRY');

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

	// If we get here, turn off the main switch and reset roomSwitchPressed state variable
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
	// stateVariable.putState( context.event.appId, 'roomSwitchPressed', 'true' );
})


// Turn on lights when motion occurs during defined times if dependent lights are on
// TODO: turn off handler once lights are turned on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	console.log('ENTRY motionStartHandler', 'ENTRY');
	// Get motion behavior setting
	// appSettings = await getCurrentSettings(context);
	// const motionBehavior = getSettingValue(context, 'motionBehavior');
	const motionBehavior = config.getStringValue('motionBehavior');

	// Determine if ANY of the switch(es) to check are on
	var bCheckSwitch = true;
	/*
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
	*/
	
	// turn on light if in time window and check switch(es) are on
	console.log('Checking motionBehavior and check switch values: ' + motionBehavior);
	if ( motionBehavior==='occupancy' && bCheckSwitch ) {
		console.log('Turning light(s) on');
		await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'on');
		// console.log('Unsubscribe from room motion sensor: ', context);
		// await context.api.subscriptions.unsubscribe('motionStartHandler');
	}
	
	// Cancel delayed off switch handler
	// await context.api.schedules.delete('delayedSwitchOff');
})


// Turn off the lights only when all motion sensors become inactive
// TODO: Turn on motion handler handler if being used to turn on lights
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	console.log('ENTRY motionStopHandler', 'ENTRY');

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
	// appSettings = await getCurrentSettings(context);
	// const delay = getSettingValue(context, 'motionDelay');
	const delay = context.getStringValue('motionDelay');
	console.log("Turn off lights after specified delay: " + delay);
	

	/*
	if (delay) {
		// Schedule turn off if delay is set
		console.log("Subscribing to delayedSwitchOff routine after specified delay: ", delay);
		await context.api.schedules.runIn('delayedSwitchOff', delay)
	} else {
		// Turn off immediately if no delay
		// await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
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
	if ( SmartSensor.getSwitchState( context, context.config.roomSwitch[0] ) ) {
		console.log('Turning room switch(es) on since main switch already on');
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
	}
})
*/

// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	console.log('ENTRY endTimeHandler', 'ENTRY');
	const endBehavior = SmartState.getValue(context, 'endBehavior');

	if ( endBehavior.includes('checkMain') ) {
		// Turn on room switch(es) if main switch already turned on
		if ( SmartSensor.getSwitchState( context, context.config.roomSwitch[0] ) ) {
			console.log('Turning room switch(es) on since main switch already on');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		}
	} else if ( endBehavior.includes('offMain') ) {

		// Turn off room switch(es) when end time reached
		console.log('Turning off main switch at specified end time');
		await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	} else if ( endBehavior.includes('onMain') ) {

		// Turn on room switch(es) when end time reached
		console.log('Turning on main switch at specified end time');
		await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		
	}
	
	// Schedule next endTime activities based on endBehavior(s) ('checkMain', 'offMain', 'offGroup', 'onGroup, 'motionOn', 'checkNext')	
	// appSettings = await getCurrentSettings(context);
	await scheduleEndHandler(context);
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
	console.log('ENTRY delayedGroupOff', 'ENTRY');
	await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
})

// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedSwitchOff', async (context, event) => {
	console.log('ENTRY delayedSwitchOff', 'ENTRY');
	await context.api.devices.sendCommands(context.config.roomSwitch, 'switch', 'off');
});

// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
const SmartUtils  = require('@katesthings/smartutils');
// const SmartState  = require('@katesthings/smartstate');

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

async function getAppSettings(appId) {
	var docClient = new aws.DynamoDB.DocumentClient();
	const params = {
  		TableName: 'smartapp-control-settings',
  		KeyConditionExpression: 'appId = :key',
		ExpressionAttributeValues: {
    			':key': appId
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
	// initialize variables
	// var stateData: any = null;
	// var bFound = false;
	// let settings: any = null;
	
	// check to see if settings database key specified
	const keyName: string = context.configStringValue('keyName');
	console.log('Key specified: ', keyName);
	if (keyName) {
		// find settings from database for current app
		const items: any = await getAppSettings(keyName);
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

function getSettingValue(context, settingName) {
	// declare variable to return stateVariables
	let settingValue: string;
	
	// see if settings found in smartapp DynamoDB database
	if (appSettings) {
		settingValue = appSettings[settingName];
	} else {
		settingValue ??= context.configStringValue(settingName);
	}
	return settingValue;
};
/*
function getSettingValue(context, settingName, bAppOnly) {
	// declare variable to return stateVariables
	let settingValue: string;
	
	// see if settings found in smartapp DynamoDB database
	if (appSettings) {
		settingValue = appSettings[settingName];
	}

	if (!bAppOnly) {
		settingValue ??= context.configStringValue(settingName);
	}
	return settingValue;
};
*/

// convert time in hhmm format to javascript date object
function convertDateTime( hhmm ) {
	const localToday: any = new Date().toLocaleString("en-US", {timeZone: "America/Denver", year: "numeric", month: "numeric", day: "numeric"});
	console.log('Formatted date to convert: ', localToday);
	/*
	localToday.setHours(parseInt(hhmm.substr(0,2), 10), parseInt(hhmm.substr(2,2), 10));
	console.log('Converted date/time: ', localToday);
	return localToday;
	*/
}


/* Define the SmartApp */
module.exports = new SmartApp()

.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// separate page for options that aren't needed if states set in DynamoDB (specified by keyName)
	page.nextPageId('optionsPage');

	// enable/disable control, key name for state machine
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true);
		section.textSetting('keyName').required(false);
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
	// page.prevPageId('mainPage');
	page.nextPageId('timePage');

	// room motion sensor(s) and door/window contact(s)
	page.section('sensors', section => {
		section.deviceSetting('roomMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		section.numberSetting('motionDelay').required(false).min(0);
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactMode').options(['allOpen', 'allClosed', 'anyOpen', 'anyClosed']);
	});

	// behavior at turn switch off and delay, if applicable
	page.section('behavior', section => {
		section.enumSetting('offBehavior').options(['off','delay','end','none'])
			.defaultValue('off').required('true');
		section.numberSetting('offDelay').required(false).min(0).defaultValue(0);
	});
})

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


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log("RoomControl: Installed/Updated");
	
	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('roomOnHandler');
	await context.api.schedules.delete('roomOffHandler');

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.delayGroup, 'switch', 'off');
	} else {

		// Get current appSettings to determine which devices need subscriptions 
		appSettings = await getCurrentSettings(context);
		console.log("App settings found: ", appSettings);

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.on', 'mainSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.off', 'mainSwitchOffHandler');
		
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.on', 'onGroupOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.off', 'onGroupOffHandler');

		const motionBehavior = getSettingValue(context, 'motionBehavior');
		console.log('Motion behavior: ', motionBehavior);
		if (motionBehavior==='occupancy') {
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
			    'motionSensor', 'motion.active', 'motionStartHandler');
		}
		if (motionBehavior==='occupancy' || motionBehavior==='vacancy') {
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
			    'motionSensor', 'motion.inactive', 'motionStopHandler');
		}

		await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
		    'contactSensor', 'contactSensor.open', 'contactOpenHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
		    'contactSensor', 'contactSensor.closed', 'contactClosedHandler');

		// TODO: Change scheduled activities to run once at appropriate (end) time
		// Schedule next activities for these settings end time and upcoming start time
		// appSettings = await getCurrentSettings(context);
		// console.log("App settings found: ", appSettings);
		
		// check to see if light was turned on before start time
		const startTime = getSettingValue(context, 'startTime');
		console.log('Start time: ', startTime);
		if (startTime) {
			await context.api.schedules.runDaily('roomOnHandler', new Date(startTime));
		}
		const endTime = convertDateTime( getSettingValue(context, 'endTime') );
		console.log('End time: ', endTime, new Date(endTime) );
		if (endTime) {
			const offBehavior = context.configStringValue('offBehavior');
			if (getSettingValue(context, 'offBehavior') === 'end') {
				// await context.api.schedules.runDaily('roomOffHandler', new Date(endTime));
				await context.api.schedules.runOnce('roomOffHandler', new Date(endTime));
			}
		}
	}	
	console.log('RoomControl: END CREATING SUBSCRIPTIONS')
})


// Turn on the lights/outlets in the on group when main switch is pressed
.subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
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
	console.log("Turn off all lights in on and off groups");
	const offGroupSwitches = context.config.offGroup;
	if (offGroupSwitches) {
		switch (context.configStringValue('offBehavior')) {
			case 'off':
				// await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
				await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
				break;
			case 'delay':
				const offDelay = context.configNumberValue('offDelay');
				await context.api.schedules.runIn('roomOffHandler', offDelay);
				break;
		}
	}
})


// Turn ON main switch if ANY of the on group lights are turned on separately
.subscribedEventHandler('onGroupOnHandler', async (context, event) => {
	console.log("Turn on the main switch when a light in the on group is turned on");

	// indicate main switch was NOT manually pressed
	// stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'false' );

	// Turn on the main switch when a light in the on group is turned on
	await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
})


// Turn OFF main switch if ALL of the on group lights are turned off separately
.subscribedEventHandler('onGroupOffHandler', async (context, event) => {
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
	if ( motionBehavior==='on' && bCheckSwitch ) {
		console.log('Turning light(s) on');
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
	}
})


// Turn off the lights only when all motion sensors become inactive
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
	console.log("Turn off lights after specified delay");

	// const delay = context.configNumberValue('motionDelay')
	appSettings = await getCurrentSettings(context);
	const delay = getSettingValue(context, 'motionDelay');

	// TODO: REMOVE... included here just for testing purposes
	const endTime = getSettingValue(context, 'endTime');
	console.log('End time: ', endTime, new Date(endTime));

	if (delay) {
		// Schedule turn off if delay is set
		await context.api.schedules.runIn('motionStopped', delay)
	} else {
		// Turn off immediately if no delay
		await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
	}
})


// Check to see if control switch was turned on prior to start time
.scheduledEventHandler('roomOnHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( SmartSensor.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) on since main switch already on');
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
	}
})


// Turns off room switch(es) at end time
.scheduledEventHandler('roomOffHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( !SmartSensor.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) off since main switch already off');
		// await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	}
})


// Turns off lights after delay elapses
.scheduledEventHandler('motionStopped', async (context, event) => {
	await context.api.devices.sendCommands(context.config.lightSwitch, 'switch', 'off');
});

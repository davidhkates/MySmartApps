// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
const SmartUtils  = require('@katesthings/smartutils');
// const SmartState  = require('@katesthings/smartstate');


// state machine routines
var aws = require('aws-sdk');
aws.config.update({region: 'us-west-2'});

async function getStateData( appId, sequence ) {
	// var stateData = null;
	var docClient = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
	const params = {
  		TableName: 'smartapp-state-machine',
  		Key: {
    			appId: appId ,
			sequence: sequence
  		}
	};

	/*
	await docClient.get(params, function(err, data) {
		if (err) {
			console.log("Error", err);
			return undefined;
		} else {
			// if (data.Item===undefined) {
			if (Object.keys(data).length>0) {
				console.log("State found", data.Item);
				return data.Item;
			}
		}
	});
	*/

	try {
		const data = await docClient.get(params).promise();
		console.log("Success");
		console.log(data);
		return data.Item;
	} catch (err) {
		console.log("Failure", err.message);
		return undefined;
	}
};

async function getCurrentState( appId ) {
	var sequence = 1;
	var stateData = null;
	var offBehavior = null;
	do {
		stateData = await getStateData(appId, sequence);
		console.log('State data: ', stateData);
		
		// get day of week character for today
		const today = new Date();
		const nDayOfWeek = today.getDay();
		const daysOfWeek = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
		const strDayOfWeek = daysOfWeek[nDayOfWeek];
		
		// check to see if current date and time included in state data
		if (stateData) {
			if (stateData.daysofweek.includes(strDayOfWeek)) {
				offBehavior = stateData.behavior;
				console.log('Day of week found in current state: ', nDayOfWeek);
		}
		sequence++;
	} while (stateData && !offBehavior && sequence<5);
	return stateData;
};



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
			.required(false).multiple(true).permissions('rx');
		section.enumSetting('offBehavior').options(['off','delay','end'])
			.defaultValue('off').required('true');
		/*
		section.deviceSetting('delayGroup').capabilities(['switch'])
			.required(false).multiple(true).permissions('rx');
		*/
		section.decimalSetting('delayOff').required(false).min(0).defaultValue(0);
	});

	/*
	// room contacts
	page.section('controls', section => {
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactMode').options(['allOpen', 'allClosed','anyClosed']);
	});
	*/

	// time window and days of week
	page.section('time', section => {
		section.enumSetting('daysOfWeek').options(['everyday','weekend','weekdays']).
			defaultValue('everyday').required(true);
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
		// section.booleanSetting('offAtEnd').defaultValue(false);
	});
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log("RoomControl: Installed/Updated");
	await getCurrentState('front-office');

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('checkOnHandler');
	await context.api.schedules.delete('roomOffHandler');

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	console.log('Control enabled value: ', controlEnabled);
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.delayGroup, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.on', 'mainSwitchOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
		    'switch', 'switch.off', 'mainSwitchOffHandler');
		
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.on', 'onGroupOnHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
		    'switch', 'switch.off', 'onGroupOffHandler');

		/*
		// motion sensor handlers
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.active', 'motionStartHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.motion,
		    'motionSensor', 'motion.inactive', 'motionStopHandler');
		*/

		// check to see if light was turned on before start time
		const startTime = context.configStringValue('startTime');
		if (startTime) {
			await context.api.schedules.runDaily('checkOnHandler', new Date(startTime));
		}
		const endTime = context.configStringValue('endTime');
		if (endTime) {
			const offBehavior = context.configStringValue('offBehavior');
			if (offBehavior == 'end') {
				await context.api.schedules.runDaily('roomOffHandler', new Date(endTime));
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

		const states = await Promise.all(onGroupStates)
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
		const states = await Promise.all(stateRequests);
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


// Check to see if control switch was turned on prior to start time
.scheduledEventHandler('checkOnHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( SmartSensors.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) on since main switch already on');
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
	}
})


// Turns off room switch(es) at end time
.scheduledEventHandler('roomOffHandler', async (context, event) => {
	// Turn on room switch(es) if control switch turned on already
	if ( !SmartSensors.getSwitchState( context, context.config.mainSwitch[0] ) ) {
		console.log('Turning room switch(es) off since main switch already off');
		// await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
		await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
	}
});

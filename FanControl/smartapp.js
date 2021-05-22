// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');


// Utility functions
function inTimeWindow( startDateTime, endDateTime ) {
	
	// initialize return value
	var inTimeWindow = true;
	
	if (startDateTime != endDateTime) {
		// apply current date to start and end date/time
		const currentDate = new Date();
		startDateTime.setFullYear( currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() );
		endDateTime.setFullYear( currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() );

		// check to see if span midnight, if so, adjust basec on current time
		if ( startDateTime > endDateTime ) {
			if (currentDate > startDateTime) {
				endDateTime.setDate(endDateTime.getDate()+1);
			} else {
				startDateTime.setDate(startDateTime.getDate()-1)
			}
		}
				
		// check to see if current time is between start and end time		
		inTimeWindow = ( (currentDate >= startDateTime) && (currentDate <= endDateTime) );
	}
	return inTimeWindow;
}



/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// operating switch and interval for checking temperature
	page.section('parameters', section => {
		section
			.booleanSetting('fanEnabled')
			.required(false);
		section
			.numberSetting('tempTarget')
			.required(true);
		section
			.numberSetting('humidityTarget')
			.required(false);
		section
			.numberSetting('checkInterval')
			.defaultValue(300)
			.required(false);
	});

	// get controls and sensors
	page.section('controls', section => {
		section
			.deviceSetting('fanSwitch')
			.capabilities(['switch'])
			.required(true)
			.permissions('rx');
		section
			.deviceSetting('contacts')
			.capabilities(['contactSensor'])
			.required(false)
			.multiple(true)
			.permissions('r');
		section
			.deviceSetting('tempSensor')
			.capabilities(['temperatureMeasurement'])
			.required(true)		
			.permissions('r');
		section
			.deviceSetting('weather')
			.capabilities(['temperatureMeasurement', 'relativeHumidityMeasurement'])
			.required(false)
			.permissions('r');
	});

	// get start and end time
	page.section('time', section => {
		section
			.timeSetting('startTime')
			.required(false);
		section
			.timeSetting('endTime')
			.required(false);
	});
})


// Handler called whenever app is installed or updated (unless separate .installed handler)
.updated(async (context, updateData) => {
	console.log("FanControl: Installed/Updated");

	// get fan enabled setting and turn off fan if not
	const fanEnabled = context.configBooleanValue('fanEnabled');
	console.log('Fan enabled value: ', fanEnabled);
	if (!fanEnabled) {
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
	}

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

/*
	// create subscriptions for relevant devices
	await context.api.subscriptions.subscribeToDevices(context.config.contacts,
		'contactSensor', 'contactSensor.open', 'contactOpenHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.contacts,
		'contactSensor', 'contactSensor.closed', 'contactClosedHandler');
*/
	
	// set start and end time event handlers
	const startTime = context.configStringValue("startTime");
	const endTime   = context.configStringValue("endTime");
	if (startTime) {
		console.log('Setting start time');
		await context.api.schedules.runDaily('checkTemperature', new Date(startTime))
		if (endTime) {
			console.log('Setting end time');
			await context.api.schedules.runDaily('stopFanHandler', new Date(endTime));
		}
		
	}		
	console.log('Start and end time set');

	// start fan if in time window (including if no start/end time specified)
	if (inTimeWindow(new Date(startTime), new Date(endTime))) {
		// const checkInterval = context.configNumberValue("checkInterval");
		// await context.api.schedules.runIn('checkTemperature', checkInterval);
		console.log('In time window');
		await context.api.schedules.runIn('checkTemperature', 0);
	}
	
	console.log('Fan Control: END CREATING SUBSCRIPTIONS')
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log("Contact open");

	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (inTimeWindow(startTime, endTime)) {
		await context.api.schedules.runIn('checkTemperature', 0);
	}
})


// If contact is closed, see if they're all closed in which case stop fan
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log("Contact closed");

	// See if there are any other contact sensors defined
	const otherSensors =  context.config.contactSensors
	    .filter(it => it.deviceConfig.deviceId !== event.deviceId)

	if (otherSensors) {
		// Get the current states of the other contact sensors
		const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'contactSensor'
		));

		// Quit if there are other sensors still open
		const states = await Promise.all(stateRequests)
		if (states.find(it => it.motion.value === 'open')) {
			return
		}
	}
	console.log("Turn off lights after specified delay");

	// If we got here, no other contact sensors are open so turn off fan 
	await context.api.schedules.runIn('stopFanHandler', 0);
})


// Handle end time if specified
.scheduledEventHandler('stopFanHandler', async(context, event) => {
	console.log("Turn off fan handler");

	// turn off fan
	await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
	// cancel any upcoming temperature check calls
	await context.api.schedules.delete('checkTemperature');
	// reschedule fan start at specified time (which must have been set if there's an end/stop time)
	const startTime = new Date(context.configStringValue('startTime'));
	await context.api.schedules.runDaily('checkTemperature', startTime);
})


// Check temperature and turn on/off fan as appropriate
.scheduledEventHandler('checkTemperature', async (context, event) => {		
	console.log("Check temperature");

	// determine if fan is enabled and within time window
	const fanEnabled = context.configBooleanValue('fanEnabled');
	console.log('Fan enabled: ', fanEnabled);

	if ( fanEnabled ) {
		// Get the the current temperature
		// const indoorTemp = await getTemperature( context, context.config.tempSensor[0] );
		const indoorTemp = await SmartSensor.getTemperature( context, context.config.tempSensor[0] );
		const outsideTemp = await SmartSensor.getTemperature( context, context.config.weather[0] );
		const targetTemp = context.configNumberValue('tempTarget');
		console.log('Indoor: ', indoorTemp, ', outside: ', outsideTemp, ', target: ', targetTemp);

		// determine if any contact sensor is open
		// var contactSensors = 'open';
		
		// Compare current temperature to target temperature
		// const fanState = ( (indoorTemp>targetTemp && outsideTemp<indoorTemp && contactSensors=='open') ? 'on' : 'off' );
		const fanState = ( (indoorTemp>targetTemp && outsideTemp<indoorTemp ) ? 'on' : 'off' );
		console.log('Turning fan ', fanState);
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', fanState);

		// call next temperature check after interval (in seconds) until end time (if specified)
		console.log('Recursive call to check interval again');
		const checkInterval = context.configNumberValue('checkInterval');
		await context.api.schedules.runIn('checkTemperature', checkInterval);	
	}
});

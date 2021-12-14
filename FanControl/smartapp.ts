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

// Remove console log and console error outputs when not debugging
// console.log = function () {};
// console.error = function () {};

// Utility functions for this automation
async function controlFan(context) {
	// Initialize fan state variable
	console.log('controlFan - starting control fan routine, initialize variables');

	// Get indoor conditions and target values
	const indoorTemp = await SmartDevice.getTemperature(context, 'tempSensor');
	const indoorHumidity = await SmartDevice.getHumidity(context, 'humiditySensor');
	const targetTemp = context.configNumberValue('targetTemp');
	const targetHumidity = context.configNumberValue('targetHumidity');
	console.log('controlFan - indoor conditions: temp - ', indoorTemp, ', humidity - ', indoorHumidity);

	// If outdoor weather sensor specified, see if conditions warrant turning fan on
	let enableFan: boolean = true;
	// const weatherSensor = context.config.weather;
	if (context.config.weather) {
		// Check outside temperature to see if fan should be turned on/off	
		// const tempSensor = context.config.tempSensor;
		if (context.config.tempSensor) {
			const outsideTemp = await SmartDevice.getTemperature( context, 'weather' );
			// const indoorTemp = await SmartDevice.getTemperature(context, 'tempSensor');
			// allow for outside temp to be slightly higher than inside by specified offset
			const tempOffset = context.configNumberValue('tempOffset') ?? 0;
			console.log('controlFan - outside temp: ', outsideTemp, ', offset: ', tempOffset);
			enableFan = (outsideTemp<=indoorTemp+tempOffset);
		}
		
		if (enableFan) {
			// Check outside humidity to see if fan should be turned on/off	
			const maxHumidity = context.configNumberValue('maxHumidity');
			if (maxHumidity) {
				const outsideHumidity = await SmartDevice.getHumidity( context, 'weather' );
				console.log('controlFan - outside humidity: ', outsideHumidity, ', max: ', maxHumidity);
				enableFan = (outsideHumidity<=maxHumidity);
			}
		}
	}

	// Determine if ANY of the switch(es) to check are on
	if (enableFan) {
		const bCheckSwitch = ( await SmartDevice.getSwitchState(context, 'checkSwitches') != 'off');
		enableFan = bCheckSwitch;
	}

	// If designated, check that contacts are open as specified.  TODO: remove this since contactsHandler will take care of it
	/*
	if (enableFan) {
		const roomContacts = context.config.roomContacts;
		if (roomContacts) {
			const contactsState = await SmartDevice.getContact( context, 'roomContacts' );
			const contactsOpenClosed = context.configStringValue('contactsOpenClosed');
			console.log('controlFan - contacts state: ', contactsState, ', open/closed: ', contactsOpenClosed);
			enableFan = ((contactsState=='open' && contactsOpenClosed!='allClosed') || 
				(contactsState=='mixed' && contactsOpenClosed=='anyOpen') ||
				(contactsState=='closed' && contactsOpenClosed=='allClosed'));
		}
	}	
	*/

	// Get current fan state
	let setFanState;  // variable for defining new fan state
	// let setFanState = currentFanState;  // default fan state to current state
	const currentFanState = await SmartDevice.getSwitchState(context, 'fanSwitch');
	console.log('controlFan - setting setFanState: ', currentFanState, enableFan, indoorTemp, targetTemp, indoorHumidity, targetHumidity);
	// compare temperature with 0.5 degrees of hysteresis (indoor temp has one decimel point of accuracy)
	if (currentFanState=='on') {
		setFanState = ( (!enableFan || (indoorTemp+0.5)<targetTemp || indoorHumidity<targetHumidity) ? 'off' : 'on' );
	} else {
		setFanState = ( (enableFan && ((indoorTemp-0.5)>targetTemp || indoorHumidity>targetHumidity)) ? 'on' : 'off' );
	}
	console.log('controlFan - current fan state: ', currentFanState, ', set fan state: ', setFanState);

	// Change fan state if different than current fan state
	if (setFanState!=currentFanState) {
		console.log('controlFan - turning fan ', setFanState);
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', setFanState);
		SmartState.putState(context, 'fanState', setFanState);
	}
	
	// call next temperature check after interval (in seconds) until end time (if specified)
	console.log('controlFan - recursive call to check interval again');
	const checkInterval = context.configNumberValue('checkInterval');
	await context.api.schedules.runIn('checkTemperature', checkInterval);	

	// return the state of the fan
	return setFanState;
}

async function stopFan(context) {
	// turn off fan
	await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
	// set fan state to 'off'
	SmartState.putState(context, 'fanState', 'off');
	// cancel any upcoming temperature check calls
	await context.api.schedules.delete('checkTemperature');
	// reschedule fan start at specified time, if specified
	const startTime = context.configStringValue('startTime');
	if (startTime) {
		await context.api.schedules.runDaily('checkTemperature', new Date(startTime));
	}
}

async function checkTimeContacts(context) {
	// let returnValue = true;
	let bStartStop = false;
	const startTime = context.configStringValue('startTime');
	const endTime = context.configStringValue('endTime');
	
	if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
		console.log('checkTimeContacts - in time window, check that contacts are in correct state');
		bStartStop = true;
		const roomContacts = context.config.roomContacts;
		if (roomContacts) {
			const contactsState = await SmartDevice.getContactState( context, 'roomContacts' );
			const contactsSetting = context.configStringValue('contactsOpenClosed');
		
			bStartStop = ( (contactsState=='open'&&contactsSetting!='allClosed') ||
				(contactsState=='mixed'&&contactsSetting=='anyOpen') ||
				(contactsState=='closed'&&contactsSetting!='allOpen') );
		}
	}
	
	// restart or stop controlling fan based on time and contacts state
	if (bStartStop) {
		controlFan(context);
	} else {
		stopFan(context);
	}
	
	// return returnValue;
	return bStartStop;
}


// Define the SmartApp
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {
	// separate page for weather information
	page.nextPageId('optionsPage');
	
	// operating switch and interval for checking temperature
	page.section('targets', section => {
		section.booleanSetting('fanEnabled').defaultValue(true);
		section.numberSetting('targetTemp').required(false);
		section.numberSetting('targetHumidity').required(false);
	});

	// controls and temperature/humidity sensors
	page.section('controls', section => {
		section.deviceSetting('fanSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('tempSensor').capabilities(['temperatureMeasurement'])
			.required(false).permissions('r');
		// section.enumSetting('tempAboveBelow').options(['Above','Below']);
		section.deviceSetting('humiditySensor').capabilities(['relativeHumidityMeasurement'])
			.required(false).permissions('r');
		// section.enumSetting('humidityAboveBelow').options(['Above','Below']);
		section.deviceSetting('checkSwitches').capabilities(['switch'])
			.required(false).multiple(true).permissions('r');
	});	
})

.page('optionsPage', (context, page, configData) => {
	// separate page for weather information
	// page.prevPageId('mainPage');
	page.section('weather', section => {
		section.deviceSetting('weather').capabilities(['temperatureMeasurement', 'relativeHumidityMeasurement'])
			.required(false).permissions('r');
		section.numberSetting('maxHumidity').required(false);
		section.numberSetting('tempOffset').defaultValue(0).min(-5).max(5);
	});	
	
	// OPTIONAL: contact sensors
	page.section('contactSensors', section => {		     
		section.deviceSetting('roomContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactsOpenClosed').options(['allOpen','allClosed','anyOpen'])
			.defaultValue('allOpen').required(false);
	});

	// OPTIONAL: start and end time, outside weather, temp offset
	page.section('time', section => {
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
		section.numberSetting('checkInterval').defaultValue(300).required(false);
	});

})

// Handler called whenever app is installed or updated (unless separate .installed handler)
.updated(async (context, updateData) => {
	console.log('FanControl - installed/updated');

	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete();	

	/*
	try {
		await context.api.schedules.delete('checkTemperature');	
		await context.api.schedules.delete('stopFanHandler');
	} catch(err) {
		console.error('FanControl - error deleting schedules: ', err);
	}
	*/
	
	// get fan enabled setting and turn off fan if not
	const fanEnabled = context.configBooleanValue('fanEnabled');
	console.log('FanControl - fan enabled value: ', fanEnabled);
	if (!fanEnabled) {
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
	} else {

		// initialize state variable with current state of fan switch
		SmartState.putState( context, 'fanState', 'off' );

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.fanSwitch,
			'switch', 'switch.off', 'fanSwitchOffHandler');
		if (context.config.roomContacts) {
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.open', 'contactOpenHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.closed', 'contactClosedHandler');
		}

		// set start and end time event handlers
		const startTime = context.configStringValue('startTime');
		const endTime   = context.configStringValue('endTime');
		if (startTime) {
			console.log('FanControl - set start time for fan: ', new Date(startTime), ', current date/time: ', new Date());
			await context.api.schedules.runDaily('checkTemperature', new Date(startTime))
			if (endTime) {
				await context.api.schedules.runDaily('stopFanHandler', new Date(endTime));
			}
		}
		
		// start controlling fan if in time window and contacts in correct state
		checkTimeContacts(context);
		
		/*
				if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
					console.log('FanControl - in time window, check that contacts are in correct state');
					const bContactsOK = await checkContacts(context);
					if (bContactsOK) {
						controlFan(context);
					}
				} else {
					// if outside time window, turn fan off
					await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');		
				}
			}		
		} else {
			console.log('FanControl - no start time set, start controlling fan based on temperatures');
			controlFan(context);
		}
		*/
	}
	// console.log('FanControl - list of current api schedules: ', context.api.schedules.list());
	console.log('FanControl - END CREATING SUBSCRIPTIONS')
})


// If fan manually turned off, cancel subsequent check temperature calls to control fan
.subscribedEventHandler('fanSwitchOffHandler', async (context, event) => {
	console.log('fanSwitchOffHandler - started, fan switch manually turned off');
	
	// get fan state previously set by SmartApp
	const fanState = SmartState.getState(context, 'fanState');
	if (fanState === 'on') {
		console.log('fanSwitchOffHandler - manually turned off after previously set on by this control; stop until next start time');
		stopFan(context);
	}
	console.log('fanSwitchOffHandler - finished');
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - contact(s) opened, check to see if in time window');
	checkTimeContacts(context);
	
	/*
	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (SmartUtils.inTimeWindow(startTime, endTime)) {		
		console.log('contactOpenHandler - in time window, check that contacts comply with setting');		
		const bContactsOK = await checkContacts(context);
		if (bContactsOK) {
			controlFan(context);
		}
	}
	*/
})


// If contact is closed, see if they're all closed in which case stop fan
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - check whether or not contacts comply with setting');
	checkTimeContacts(context);

	/*
	if (!checkControls(context)) {
		console.log('contactClosedHandler - contacts do NOT comply with settings; stop fan immediately');
		stopFan(context);
	}
	*/

	/*
	// TODO: add logic to determine whether ANY or ALL of the contact sensors need to be open
	const contactsOpenClosed = context.configStringValue('contactsOpenClosed');
	if (contactsOpenClosed !== 'allOpen') {

		// See if there are any other contact sensors defined
		const otherSensors =  context.config.roomContacts
			.filter(it => it.deviceConfig.deviceId !== event.deviceId);

		console.log('contactClosedHandler - other sensors: ', otherSensors);
		if (otherSensors) {
			// Get the current states of the other contact sensors
			const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
				it.deviceConfig.deviceId,
				it.deviceConfig.componentId,
				'contactSensor'
			));

			// Quit if there are other sensors still open
			const states: device = await Promise.all(stateRequests)
			console.log('contactClosedHandler - state requests: ', states);
			if (states.find(it => it.contact.value === 'open')) {
				return
			}
		}
	}

	// If we got here, no other contact sensors are open so turn off fan 
	console.log('contactClosedHandler - if we got here, turn off fan immediately');
	stopFan(context);
	*/	
})


// Handle end time if specified
.scheduledEventHandler('stopFanHandler', async(context, event) => {
	console.log('stopFanHandler - turn off fan handler');
	stopFan(context);
})


// Check temperature and turn on/off fan as appropriate
.scheduledEventHandler('checkTemperature', async (context, event) => {		
	console.log('checkTemperature - call controlFan');
	controlFan(context);
});

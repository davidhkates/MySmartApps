// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevices = require('@katesthings/smartdevices');
const SmartUtils   = require('@katesthings/smartutils');
const SmartState   = require('@katesthings/smartstate');


// Utility functions for this automation
async function controlFan( context ) {
	// Initialize fan state variable
	var fanState = 'off';

	// Get temperature(s) and set fan state
	const tempSensor = context.config.tempSensor;
	if (tempSensor) {
		const targetTemp = context.configNumberValue('tempTarget');
		const indoorTemp = await SmartDevices.getTemperature( context, context.config.tempSensor[0] );

		console.log('Indoor temperature: ', indoorTemp, ', target temperature: ', targetTemp);
		if (indoorTemp>targetTemp) {
			console.log('Default fan state to ON');
			fanState = 'on';

			// If weather sensor defined, make sure it's cooler outside
			const weatherSensor = context.config.weather;
			// console.log('Weather sensor: ', weatherSensor);
			if (weatherSensor) {
				console.log('Weather sensor specified');
				const outsideTemp = await SmartDevices.getTemperature( context, weatherSensor[0] );
				console.log('Outside temp: ', outsideTemp);
				
				// allow for outside temp to be slightly higher than inside by specified offset
				var tempOffset = context.configNumberValue('tempOffset');
				if (!tempOffset) {
					tempOffset = 0
				}
				if (indoorTemp<=outsideTemp-tempOffset) {
					fanState = 'off';
				} else {

					// If humidity setting specified, make sure it's below that outside
					const maxHumidity = context.configNumberValue('maxHumidity');
					if (maxHumidity) {
						const outsideHumidity = await SmartDevices.getHumidity( context, context.config.weather[0] );
						if (maxHumidity<outsideHumidity) { 
							fanState = 'off'
						}
					}
				}
			}
		}
	}
	
	// If room humidity sensor specified
	const humiditySensor = context.config.humiditySensor;
	if (humiditySensor) {
		const targetHumidity = context.configNumberValue('humidityTarget');
		if (targetHumidity) {
			const indoorHumidity = await SmartDevices.getRelativeHumidity( context, context.config.humiditySensor[0] );

			console.log('Indoor humidity: ', indoorHumidity, ', target humidity: ', targetHumidity);
			if (indoorHumidity>targetHumidity) {
				fanState = 'on';
				// TODO - think about how to deal with temperature and outside weather conditions
			}
		}
	}
	
	// Control fan based on determined fan state, set state variable
	console.log('Turning fan ', fanState);
	await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', fanState);
	SmartState.putState(context, 'fanState', fanState);

	// call next temperature check after interval (in seconds) until end time (if specified)
	console.log('Recursive call to check interval again');
	const checkInterval = context.configNumberValue('checkInterval');
	await context.api.schedules.runIn('checkTemperature', checkInterval);	

	// return the state of the fan
	return fanState;
}

async function stopFan( context ) {
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
		section.numberSetting('tempTarget').required(false);
		section.numberSetting('humidityTarget').required(false);
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
	});
	
	page.section('weather', section => {
		section.deviceSetting('weather').capabilities(['temperatureMeasurement', 'relativeHumidityMeasurement'])
			.required(false).permissions('r');
		section.numberSetting('maxHumidity').required(false);
		section.numberSetting('tempOffset').defaultValue(0).min(-5).max(5);
	});	
})

.page('optionsPage', (context, page, configData) => {
	// separate page for weather information
	// page.prevPageId('mainPage');
	
	// OPTIONAL: contact sensors
	page.section('contactSensors', section => {		     
		section.deviceSetting('doorContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactsOpenClosed').options(['Open','Closed']);
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
	console.log("FanControl: Installed/Updated");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('checkTemperature');
	await context.api.schedules.delete('stopFanHandler');

	// get fan enabled setting and turn off fan if not
	const fanEnabled = context.configBooleanValue('fanEnabled');
	console.log('Fan enabled value: ', fanEnabled);
	if (!fanEnabled) {
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
	} else {

		// initialize state variable with current state of fan switch
		SmartState.putState( context, 'fanState', 'off' );

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.fanSwitch,
			'switch', 'switch.off', 'fanSwitchOffHandler');
		if (context.config.doorContacts) {
			await context.api.subscriptions.subscribeToDevices(context.config.doorContacts,
				'contactSensor', 'contact.open', 'contactOpenHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.doorContacts,
				'contactSensor', 'contact.closed', 'contactClosedHandler');
		}

		// check contact(s) state and turn off if all are closed
		/*
		var contactOpen = false;
		const contactSensors =  context.config.doorContacts;
		if (contactSensors) {
			// Get the current states of the contact sensors
			const stateRequests = contactSensors.map(it => context.api.devices.getCapabilityStatus(
				it.deviceConfig.deviceId,
				it.deviceConfig.componentId,
				'contactSensor'
			));

			// Set contactOpen to true if at least one contact is open
			const states = await Promise.all(stateRequests);
			if (states.find(it => it.motion.value === 'open')) {
				contactOpen = true;
			}
		} else {
			contactOpen = true;
		}
		*/
		
		// set start and end time event handlers
		const startTime = context.configStringValue("startTime");
		const endTime   = context.configStringValue("endTime");
		if (startTime) {
			console.log('Set start time for fan: ', new Date(startTime), ', current date/time: ', new Date());
			await context.api.schedules.runDaily('checkTemperature', new Date(startTime))
			if (endTime) {
				await context.api.schedules.runDaily('stopFanHandler', new Date(endTime));
				if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
					console.log('Start controlling fan based on temperatures');
					controlFan(context);
				} else {
					// if outside time window, turn fan off
					await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');		
				}
			}		
		} else {
			console.log('No start time set, start controlling fan based on temperatures');
			controlFan(context);
		}
	}
	
	console.log('Fan Control: END CREATING SUBSCRIPTIONS')
})


// If fan manually turned off, cancel subsequent check temperature calls to control fan
.subscribedEventHandler('fanSwitchOffHandler', async (context, event) => {
	console.log('fanSwitchOffHeandler - started, fan switch manually turned off');
	
	// get fan state previously set by SmartApp
	const fanState = SmartState.getState(context, 'fanState');
	if (fanState === 'on') {
		console.log('fanSwitchOffHandler - previously set on by SmartApp, stop until next start time');
		stopFan(context);
	}
	console.log('fanSwitchOffHeandler - finished');
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log("Contact open");

	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (SmartUtils.inTimeWindow(startTime, endTime)) {
		// await context.api.schedules.runIn('checkTemperature', 0);
		controlFan(context);
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
	stopFan(context);
})


// Handle end time if specified
.scheduledEventHandler('stopFanHandler', async(context, event) => {
	console.log("Turn off fan handler");
	stopFan(context);
})


// Check temperature and turn on/off fan as appropriate
.scheduledEventHandler('checkTemperature', async (context, event) => {		
	console.log("Check temperature");
	controlFan(context);
});

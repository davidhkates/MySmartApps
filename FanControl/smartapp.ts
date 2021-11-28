// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');
// const {SmartThingsClient} = require('@smartthings/core-sdk');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}

// Utility functions for this automation
async function controlFan(context) {
	// Initialize fan state variable
	console.log('controlFan - starting control fan routine, initialize variables');
	let fanState = 'off';

	const currentFanState = await SmartDevice.getSwitchState(context, 'fanSwitch');
	console.log('controlFan - current fan state: ', currentFanState);

	// Get temperature(s) and set fan state
	const tempSensor = context.config.tempSensor;
	if (tempSensor) {
		const targetTemp = context.configNumberValue('tempTarget');
		const indoorTemp = await SmartDevice.getTemperature( context, context.config.tempSensor[0] );

		console.log('controlFan - indoor temperature: ', indoorTemp, ', target temperature: ', targetTemp);
		if (indoorTemp>targetTemp) {
			console.log('Default fan state to ON');
			fanState = 'on';

			// If weather sensor defined, make sure it's cooler outside
			const weatherSensor = context.config.weather;
			// console.log('Weather sensor: ', weatherSensor);
			if (weatherSensor) {
				console.log('controlFan - weather sensor specified');
				const outsideTemp = await SmartDevice.getTemperature( context, weatherSensor[0] );
				console.log('controlFan - outside temp: ', outsideTemp);
				
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
						const outsideHumidity = await SmartDevice.getHumidity( context, context.config.weather[0] );
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
			const indoorHumidity = await SmartDevice.getRelativeHumidity( context, context.config.humiditySensor[0] );

			console.log('controlFan - indoor humidity: ', indoorHumidity, ', target humidity: ', targetHumidity);
			if (indoorHumidity>targetHumidity) {
				fanState = 'on';
				// TODO - think about how to deal with temperature and outside weather conditions
			}
		}
	}
	
	// Control fan based on determined fan state, set state variable
	console.log('controlFan - turning fan ', fanState);
	await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', fanState);
	SmartState.putState(context, 'fanState', fanState);

	// call next temperature check after interval (in seconds) until end time (if specified)
	console.log('controlFan - recursive call to check interval again');
	const checkInterval = context.configNumberValue('checkInterval');
	await context.api.schedules.runIn('checkTemperature', checkInterval);	

	// return the state of the fan
	return fanState;
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

	// unsubscribe all previously established subscriptions
	const tmStart = context.configStringValue("startTime");
	await context.api.schedules.runDaily('checkTemperature', new Date(tmStart))	
	console.log('FanControl - context.api: ', context.api);
	console.log('FanControl - context.api.schedules: ', context.api.schedules);
	console.log('FanControl - context.api.subscriptions.schedules: ', context.api.subscriptions.schedules);

	await context.api.subscriptions.unsubscribeAll();
	try {
		await context.api.schedules.delete('checkTemperature');	
		await context.api.schedules.delete('stopFanHandler');
	} catch(err) {
		console.error('FanControl - error deleting schedules: ', err);
	}
	
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
		const startTime = context.configStringValue("startTime");
		const endTime   = context.configStringValue("endTime");
		if (startTime) {
			console.log('Set start time for fan: ', new Date(startTime), ', current date/time: ', new Date());
			await context.api.schedules.runDaily('checkTemperature', new Date(startTime))
			if (endTime) {
				await context.api.schedules.runDaily('stopFanHandler', new Date(endTime));
				if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
					console.log('FanControl - start controlling fan based on temperatures');
					controlFan(context);
				} else {
					// if outside time window, turn fan off
					await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');		
				}
			}		
		} else {
			console.log('FanControl - no start time set, start controlling fan based on temperatures');
			controlFan(context);
		}
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
		console.log('fanSwitchOffHandler - previously set on by SmartApp, stop until next start time');
		stopFan(context);
	}
	console.log('fanSwitchOffHandler - finished');
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - contact(s) opened, restart fan control');

	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (SmartUtils.inTimeWindow(startTime, endTime)) {
		
		controlFan(context);
	}
})


// If contact is closed, see if they're all closed in which case stop fan
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - if all contacts closed, turn off fan');

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

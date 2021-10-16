// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartSensor = require('@katesthings/smartcontrols');
const SmartUtils  = require('@katesthings/smartutils');


// Utility functions for this automation
async function controlHeater( context ) {
	// Get temperature(s) and set heater state
	const targetTemp = context.configNumberValue('tempTarget');
	const indoorTemp = await SmartSensor.getTemperature( context, context.config.tempSensor[0] );

	console.log('controlHeater - indoor temperature: ', indoorTemp, ', target temperature: ', targetTemp);
	const heaterState = ( indoorTemp>targetTemp ? 'on' : 'off' );
	
	// Control fan based on determined fan state
	console.log('controlHeater - turning heater ', heaterState);
	await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', heaterState);

	// call next temperature check after interval (in seconds) until end time (if specified)
	console.log('Recursive call to check interval again');
	const checkInterval = context.configNumberValue('checkInterval');
	await context.api.schedules.runIn('checkTempHandler', checkInterval);	

	// return the state of the fan
	return heaterState;
}

async function stopHeater( context ) {
	// turn off fan
	await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', 'off');
	// cancel any upcoming temperature check calls
	await context.api.schedules.delete('checkTempHandler');
	// reschedule fan start at specified time, if specified
	const startTime = context.configStringValue('startTime');
	if (startTime) {
		await context.api.schedules.runDaily('checkTempHandler', new Date(startTime));
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
		section.booleanSetting('heaterEnabled').defaultValue(true);
		section.numberSetting('tempTarget').required(true);
	});

	// controls and temperature/humidity sensors
	page.section('controls', section => {
		section.deviceSetting('heaterSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('tempSensor').capabilities(['temperatureMeasurement'])
			.required(true).permissions('r');
	});
	
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
	console.log("Installed/Updated - start creating subscriptions");

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete('checkTempHandler');
	await context.api.schedules.delete('stopHeaterHandler');

	// get fan enabled setting and turn off fan if not
	const heaterEnabled = context.configBooleanValue('heaterEnabled');
	console.log('Installed/Updated - heater enabled value: ', heaterEnabled);
	if (!heaterEnabled) {
		await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', 'off');
	} else {

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.heaterSwitch,
			'switch', 'switch.off', 'heaterSwitchOffHandler');
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
			console.log('Installed/Updated - set start time for fan: ', new Date(startTime), ', current date/time: ', new Date());
			await context.api.schedules.runDaily('checkTempHandler', new Date(startTime))
			if (endTime) {
				await context.api.schedules.runDaily('stopHeaterHandler', new Date(endTime));
				if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
					console.log('Installed/Updated - start controlling heater based on temperatures');
					controlHeater(context);
				} else {
					// if outside time window, turn fan off
					await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', 'off');		
				}
			}		
		} else {
			console.log('Installed/Updated - no start time set, start controlling heater immediately');
			controlHeater(context);
		}
	}
	
	console.log('Installed/Updated - end creating subscriptions')
})


// If fan manually turned off, cancel subsequent check temperature calls to control fan
.subscribedEventHandler('heaterSwitchOffHandler', async (context, event) => {
	console.log('heaterSwitchOffHandler - started, heater switch turned off manually');
	await context.api.schedules.delete('checkTempHandler');
	await context.api.schedules.delete('stopHeaterHandler');	
	console.log('heaterSwitchOffHandler - finished, subsequent temperate check calls cancelled');
})


// If one or more contacts open, resuming checking temperature to control fan
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - started');

	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (SmartUtils.inTimeWindow(startTime, endTime)) {
		// await context.api.schedules.runIn('checkTempHandler', 0);
		controlFan(context);
	}
	console.log('contactOpenHandler - finished');
})


// If contact is closed, see if they're all closed in which case stop fan
.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - started');

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
	console.log('contactClosedHandler - finished');
})


// Handle end time if specified
.scheduledEventHandler('stopHeaterHandler', async(context, event) => {
	console.log('stopHeaterHandler - started');
	stopFan(context);
	console.log('stopHeaterHandler - finished');
})


// Check temperature and turn on/off fan as appropriate
.scheduledEventHandler('checkTempHandler', async (context, event) => {		
	console.log('checkTempHandler - started');
	controlHeater(context);
	console.log('checkTempHandler - finished');
});

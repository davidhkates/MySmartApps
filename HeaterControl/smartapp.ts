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


// Utility functions for this automation
async function controlHeater( context ) {
	// Check home status if specified
	/*
	var homeMode = 'awake';
	const homeName = context.configStringValue('homeName');
	if (homeName) {
		homeMode = await SmartState.getHomeMode(homeName, 'occupancy');
		console.log('controlHeater - current mode for home occupancy: ', homeName, ' = ', homeMode);
	}
	*/
	const bHomeActive: boolean = await SmartState.isHomeActive(context.configStringValue('homeName'));
	console.log('controlHeater - home is active: ', bHomeActive);

	// Determine if ANY of the switch(es) to check are on
	var bCheckSwitch = true;
	const checkSwitches = context.config.checkSwitches;
	console.log('controlHeater - check switches: ', checkSwitches);
	if (checkSwitches) {
		const stateRequests = checkSwitches.map(it => context.api.devices.getCapabilityStatus(
			it.deviceConfig.deviceId,
			it.deviceConfig.componentId,
			'switch'
		));
		
		//set check switch to true if any switch is on
		const switchStates: any = await Promise.all(stateRequests);
		bCheckSwitch = ( switchStates.find(it => it.switch.value === 'on') );		
		console.log('controlHeater - are any of check switch(es) on?: ', bCheckSwitch);
	}
		
	// Get temperature(s) and set heater state, default heater state to off
	var heaterState = 'off';	
	const targetTemp = context.configNumberValue('tempTarget');
	// console.log('controlHeater - target temperature: ', targetTemp, ' home mode: ', homeMode);
	// if (targetTemp && (homeMode==='awake')) 
	if (targetTemp && bHomeActive && bCheckSwitch) {
		const indoorTemp = await SmartDevice.getTemperature( context, context.config.tempSensor[0] );
		if (indoorTemp) {
			console.log('controlHeater - indoor temperature: ', indoorTemp, ', target temperature: ', targetTemp);
			if ( indoorTemp<targetTemp ) {
				heaterState = 'on';
				// heaterState = ( indoorTemp>targetTemp ? 'off' : 'on' );
			}
		}
	}
	
	// Control heater based on determined heater state
	console.log('controlHeater - turning heater ', heaterState);
	await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', heaterState);

	// call next temperature check after interval (in seconds) if target temp set until end time (if specified)
	// const endTime = context.configStringValue('endTime');
	// if (endTime && targetTemp) {
	if (targetTemp) {
		console.log('controlHeater - recursive call to check temperature');
		const checkInterval = context.configNumberValue('checkInterval');
		await context.api.schedules.runIn('checkTempHandler', checkInterval);	
	}

	// return the state of the heater
	return heaterState;
}

async function stopHeater( context ) {
	// turn off heater
	console.log('stopHeater - turn off heater switch');
	await context.api.devices.sendCommands(context.config.heaterSwitch, 'switch', 'off');
	// cancel any upcoming temperature check calls
	try {
		await context.api.schedules.delete('checkTempHandler');
		console.log('stopHeater - cancelled next temperature handler check');
	} catch(err) {
		console.error('stopHeater - no pending temperature handler checks: ', err);
	}
	
	/*
	// reschedule heater start at specified time, if specified
	const startTime = context.configStringValue('startTime');
	if (startTime) {
		console.log('stopHeater - reschedule handler to check temperature at next start time');
		await context.api.schedules.runDaily('checkTempHandler', new Date(startTime));
	}
	*/
}


// Define the SmartApp
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {
	// separate page for weather information
	page.nextPageId('optionsPage');
	
	// 
	// operating switch and interval for checking temperature
	page.section('controls', section => {
		section.booleanSetting('heaterEnabled').defaultValue(true);
		section.numberSetting('tempTarget').required(false);
		section.deviceSetting('heaterSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('tempSensor').capabilities(['temperatureMeasurement'])
			.required(false).permissions('r');
		section.textSetting('homeName').required(false);
		// section.modeSetting('homeMode').multiple(true).style('COMPLETE');
		section.deviceSetting('checkSwitches').capabilities(['switch'])
			.required(false).multiple(true).permissions('r');
	});
})

.page('optionsPage', (context, page, configData) => {
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
	await context.api.schedules.delete('startHeaterHandler');
	await context.api.schedules.delete('stopHeaterHandler');

	// test the new isOccupied function
	/*
	const homeName = context.configStringValue('homeName');
	const bOccupied: boolean = await SmartState.isHomeActive(homeName);
	console.log('Test isOccupied: ', bOccupied);	
	
	// debug statements
	const homeMode = context.configStringValue('homeMode');
	console.log('Current home mode: ', homeMode);	
	*/
	
	// get heater enabled setting and turn off heater if not
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
		const startTime = context.configStringValue('startTime');
		const endTime   = context.configStringValue('endTime');
		if (startTime) {
			console.log('Installed/Updated - set start time for heater: ', new Date(startTime), ', current date/time: ', new Date());
			await context.api.schedules.runDaily('startHeaterHandler', new Date(startTime))
			if (endTime) {
				await context.api.schedules.runDaily('stopHeaterHandler', new Date(endTime));
				if (SmartUtils.inTimeWindow(new Date(startTime), new Date(endTime))) {
					console.log('Installed/Updated - start controlling heater based on temperatures');
					controlHeater(context);
				} else {
					// if outside time window, turn heater off
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


// If heater manually turned off, cancel subsequent check temperature calls to control heater
.subscribedEventHandler('heaterSwitchOffHandler', async (context, event) => {
	console.log('heaterSwitchOffHandler - started, heater switch turned off manually');
	await context.api.schedules.delete('checkTempHandler');
	console.log('heaterSwitchOffHandler - finished, subsequent temperate check calls cancelled');
})


// If one or more contacts open, resuming checking temperature to control heater
.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - started');

	const startTime = new Date(context.configStringValue('startTime'));
	const endTime   = new Date(context.configStringValue('endTime'));
	if (SmartUtils.inTimeWindow(startTime, endTime)) {
		// await context.api.schedules.runIn('checkTempHandler', 0);
		controlHeater(context);
	}
	console.log('contactOpenHandler - finished');
})


// If contact is closed, see if they're all closed in which case stop heater
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
		const states: device = await Promise.all(stateRequests);
		if (states.find(it => it.contact.value === 'open')) {
			return
		}
	}

	// If we got here, no other contact sensors are open so turn off heater 
	console.log('contactClosedHandler - one or more contacts closed, turn off heater');
	stopHeater(context);
	console.log('contactClosedHandler - finished');
})

// Check temperature and turn on/off heater as appropriate
.scheduledEventHandler('startHeaterHandler', async (context, event) => {		
	console.log('startTempHandler - start controlling heater');
	controlHeater(context);
})

// Handle end time if specified
.scheduledEventHandler('stopHeaterHandler', async(context, event) => {
	console.log('stopHeaterHandler - turn off heater');
	stopHeater(context);
})

// Check temperature and turn on/off heater as appropriate
.scheduledEventHandler('checkTempHandler', async (context, event) => {		
	console.log('checkTempHandler - start controlling heater');
	controlHeater(context);
});

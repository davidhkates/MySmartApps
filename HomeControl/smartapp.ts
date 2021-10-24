// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
// const SmartUtils  = require('@katesthings/smartutils');
const SmartState  = require('@katesthings/smartstate');

// SmartApp type definitions
interface device {
	[value: string]: any
}

// Utility functions for this automation
async function controlHome( context ) {
}


// Define the SmartApp
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {
	// separate page for additional options
	// page.nextPageId('optionsPage');
	
	// operating switch and controls to set home status
	page.section('controls', section => {
		// section.booleanSetting('controlEnabled').defaultValue(true);
		section.deviceSetting('homeSwitch').capabilities(['switch'])
			.required(true).permissions('rx');
		section.deviceSetting('homeMotion').capabilities(['motionSensor'])
			.required(false).multiple(true).permissions('r');
		section.deviceSetting('doorContacts').capabilities(['contactSensor'])
			.required(false).multiple(true).permissions('r');
		section.enumSetting('contactsOpenClosed').options(['Open','Closed']);
	});

	// OPTIONAL: start and end time
	page.section('time', section => {
		section.timeSetting('startTime').required(false);
		section.timeSetting('endTime').required(false);
		section.numberSetting('onDuration').defaultValue(60).required(false);
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
			const states: device = await Promise.all(stateRequests);
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
		const states: device = await Promise.all(stateRequests)
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

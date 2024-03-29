//---------------------------------------------------------------------------------------
// Trigger Control - control virtual switch based on real switches and sensors
//---------------------------------------------------------------------------------------


// Load SmartApp SDK APIs
const SmartApp = require('@smartthings/smartapp');

// Install relevant SmartApp utilities
const SmartDevice = require('@katesthings/smartdevice');
const SmartUtils  = require('@katesthings/smartutils');

// SmartApp type definitions
interface device {
	[value: string]: any
}


/* Define the SmartApp */
module.exports = new SmartApp()
.enableEventLogging()  // logs requests and responses as pretty-printed JSON
.configureI18n()       // auto-create i18n files for localizing config pages

// Configuration page definition
.page('mainPage', (context, page, configData) => {

	// main options page with room controls and behaviors

	// enable/disable control, room name for dyanamodb settings table
	page.section('parameters', section => {
		section.booleanSetting('controlEnabled').defaultValue(true).submitOnChange(true);
	});

	// set control enabled flag to control other settings prompts
	/*
	let bControlEnabled: boolean = context.configBooleanValue('controlEnabled');

	if (bControlEnabled) {
	*/
	if (context.configBooleanValue('controlEnabled')) {	
		// controls
		page.section('controls', section => {
			// trigger switch
			section.deviceSetting('triggerSwitch').capabilities(['switch'])
				.required(true).permissions('rx');		
			// motion and contact switches 
			section.deviceSetting('roomMotion').capabilities(['motionSensor'])
				.required(false).multiple(true).permissions('r');
			section.deviceSetting('roomContacts').capabilities(['contactSensor'])
				.required(false).multiple(true).permissions('r');
		});		
		
		// next page for additional options/controls
		page.nextPageId('optionsPage');
	}
})

.page('optionsPage', (context, page, configData) => {
	page.section('delays', section => {
		section.numberSetting('motionDelay').required(false).min(0).defaultValue(60);
		section.numberSetting('openDelay').required(false).min(0).defaultValue(15);
		section.numberSetting('closeDelay').required(false).min(0).defaultValue(30);
		section.numberSetting('openWait').required(false).min(0).defaultValue(0);
		section.numberSetting('closeWait').required(false).min(0).defaultValue(0);
	});
	
	page.section('behavior', section => {
		section.enumSetting('contactTriggerOn').options(['open', 'closed'])
			.required(true).defaultValue('open');
		section.enumSetting('contactTriggerOpen').options(['all', 'any'])
			.required(true).defaultValue('all');
		section.enumSetting('contactTriggerClosed').options(['all', 'any'])
			.required(true).defaultValue('any');
	});
	
	page.section('modes', section => {
		section.modeSetting('targetMode').required(false).multiple(true);
	});
})


// Handler called for both INSTALLED and UPDATED events if no separate installed() handler
.updated(async (context, updateData) => {
	console.log('targetControl - start install/update');
	
	// unsubscribe all previously established subscriptions and scheduled events
	await context.api.subscriptions.unsubscribeAll();
	await context.api.schedules.delete();

	// if control is not enabled, turn off switch
	const controlEnabled = context.configBooleanValue('controlEnabled');
	if (!controlEnabled) {
		await context.api.devices.sendCommands(context.config.triggerSwitch, 'switch', 'off');
	} else {
		// create subscriptions for relevant devices
		console.log('targetControl - create subscriptions');

		// initialize motion behavior
		if (context.config.roomMotion) {
			console.log('targetControl - setting up handlers for room motion sensor(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.active', 'motionStartHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomMotion,
				'motionSensor', 'motion.inactive', 'motionStopHandler');
		}

		// initialize contact behaviors
		if (context.config.roomContacts) {
			console.log('targetControl - setting up handlers for room contact(s)');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.open', 'contactOpenHandler');
			await context.api.subscriptions.subscribeToDevices(context.config.roomContacts,
				'contactSensor', 'contact.closed', 'contactClosedHandler');
		}
	}	
	console.log('targetControl - end creating subscriptions');
})


// Turn on trigger switch when motion occurs during defined times if dependent lights are on
// TODO: turn off handler once lights are turned on
.subscribedEventHandler('motionStartHandler', async (context, event) => {
	console.log('motionStartHandler - start');

	const motionEnabled = context.configBooleanValue('motionEnabled');
	console.log('motionStartHandler - motionEnabled: ', motionEnabled);
	if (motionEnabled) {

		// check to see if current mode matches designated mode
		const targetMode = context.configStringValue('modeName');
		const currentMode = context.configCurrentMode();
		console.log('motionStartHandler - target mode name: ', targetMode, ', current mode: ', currentMode);

		// turn on light if in time window and check switch(es) are on
		if (currentMode==targetMode) {
			await SmartDevice.setSwitchState(context, 'triggerSwitch', 'on');
		}
	}	
	console.log('motionStartHandler - finished');
})


// Turn off the trigger switch when all motion sensors become inactive
.subscribedEventHandler('motionStopHandler', async (context, event) => {
	console.log('motionStopHandler - starting');

	const motionSensors = await SmartDevice.getMotionState(context, 'roomMotion');
	if (motionSensors==='inactive') {
		const delay = context.configNumberValue('motionDelay');
		console.log('motionStopHandler - turn off lights after specified delay: ' + delay);	

		if (delay) {
			// Schedule turning off room switch if delay is set
			console.log('motionStopHandler - run delayedSwitchOff after specified delay: ', delay);
			await context.api.schedules.runIn('delayedTriggerOff', delay)
		} else {
			// Turn room switch off immediately if no delay
			console.log('motionStopHandler - turn room switch off immediately');
			await SmartDevice.setSwitchState(context, 'triggerSwitch', 'off');
		}	
	}
})


.subscribedEventHandler('contactOpenHandler', async (context, event) => {
	console.log('contactOpenHandler - set room to entering or leaving');	

	const openWait = context.configNumberValue('openWait');
	if (openWait>0) {
		context.api.schedules.runIn('delayedOpenTrigger', openWait);
	} else {
		const roomContacts = context.config.roomContacts;
		if (roomContacts) {
			const contactsState = await SmartDevice.getContactState(context, 'roomContacts');
			const contactTriggerOn = context.configStringValue('contactTriggerOn');
			const contactTriggerOpen = context.configStringValue('contactTriggerOpen');
		
			if ( (contactsState=='open') || (contactsState=='mixed'&&contactTriggerOn=='anyOpen') ) {
				await SmartDevice.setSwitchState(context, 'triggerSwitch', ( contactTriggerOn=='open' ? 'on' : 'off') );
			}
		}
	}
})	


.subscribedEventHandler('contactClosedHandler', async (context, event) => {
	console.log('contactClosedHandler - set room to occupied or vacant');	
	
	const roomState = 'entering';
	const transientStates = ['entering', 'leaving'];
	if (transientStates.includes(roomState)) {
		console.log('contactClosedHandler - setting room state to VACANT');
		SmartDevice.setSwitchState(context, 'triggerSwitch', 'off');
	} else {
		// turn trigger switch off if motion NOT detected within specified time
		const closeDelay = context.configNumberValue('closeDelay');
		if (closeDelay>0) {
			console.log('contactClosedHandler - check for activity after delay: ', closeDelay);
			await context.api.schedules.delete('delayedSwitchOff');
			context.api.schedules.runIn('delayedSwitchOff', closeDelay);
		}
	}
})


// Schedule activity(ies) to be performed at end time
.scheduledEventHandler('endTimeHandler', async (context, event) => {
	console.log('endTimeHandler - starting');
	
	// check to see if routine should be run based on specified day of week
	const daysOfWeek = context.configStringValue('daysOfWeek');
	if ( SmartUtils.isDayOfWeek(daysOfWeek) ) {
		console.log('endTimeHandler - run end time handler today based on daysOfWeek:', daysOfWeek);
		// Turn off room switch(es) if main switch already turned off
		const isRoomOn = await SmartDevice.getSwitchState(context, 'triggerSwitch');
		console.log('endTimeHandler - isRoomOn state: ', isRoomOn );
		if (isRoomOn!=='on') {
			console.log('endTimeHandler - turning room switch(es) off since main switch already off');
			await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
		}
	}
	console.log('endTimeHandler - finished');
})


// Turn trigger switch on after delay when switch turned off
.scheduledEventHandler('delayedSwitchOn', async (context, event) => {
	// console.log('delayedSwitchOn - starting');
	
	console.log('delayedSwitchOn - turning room switch ON, setting room state to OCCUPIED');
	// await context.api.devices.sendCommands(context.config.triggerSwitch, 'switch', 'off');
	SmartDevice.setSwitchState(context, 'triggerSwitch', 'on');
})


// Turn trigger switch off after delay when switch turned off
.scheduledEventHandler('delayedSwitchOff', async (context, event) => {
	// console.log('delayedSwitchOff - starting');
	
	// save state variable to indicate room switch was turned off by delay
	console.log('delayedSwitchOff - setting room switch mode to delay');
	const triggerSwitchState = await SmartDevice.getSwitchState(context, 'triggerSwitch');
	console.log('delayedSwitchOff - current room switch state: ', triggerSwitchState);
	if (triggerSwitchState==='on') {
		console.log('delayedSwitchOff - turning room switch off');
		SmartDevice.setSwitchState(context, 'triggerSwitch', 'off');
	}
})


// Turns off lights after delay when switch turned off
.scheduledEventHandler('delayedGroupOff', async (context, event) => {
	console.log('delayedGroupOff - starting');
	SmartDevice.setSwitchState(context, 'offGroup', 'off');
});

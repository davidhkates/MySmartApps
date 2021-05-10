const SmartApp = require('@smartthings/smartapp');
// const stateVariable = require('./state-variable');
// const SmartUtils = require('../Utilities/capabilities');

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // get controls and sensors
        page.section('controls', section => {
            section
                .deviceSetting('fanSwitch')
                .capabilities(['switch'])
                .required(true)
                .multiple(false);
            section
                .numberSetting('tempTarget')
                .required(true);
            section
                .deviceSetting('tempSensor')
                .capabilities(['temperatureMeasurement'])
                .required(true);		
            section
                .deviceSetting('contact')
                .capabilities(['contactSensor'])
                .required(false)
                .multiple(true);
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

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
	console.log("FanControl: Installed/Updated");
        
    	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

        // Schedule temperature check in specified time (in seconds)
        await context.api.schedules.runIn('checkTemperature', 300);
	
        console.log('Motion Group: END CREATING SUBSCRIPTIONS')
    })

/*
    // Turn on the lights when main switch is pressed
    .subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	console.log("Checking value of mainSwitchPressed");
	// check value of mainSwitchPressed state variable
	if ( stateVariable.getState( context.event.appId, 'mainSwitchPressed' ) == 'true' ) {
		
		// If we make it here, turn on all lights in onGroup
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
		// start timer to turn off lights if value specified
		const delay = context.configNumberValue('delay')
		if (delay) {
		    // Schedule turn off if delay is set
		    await context.api.schedules.runIn('motionStopped', delay)
		}
	}
        console.log("Turn on all lights on onGroup");
    })
    // Turn off the lights when main switch is pressed
    .subscribedEventHandler('mainSwitchOffHandler', async (context, event) => {
        // Turn on the lights in the on group
        await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'off');
        await context.api.devices.sendCommands(context.config.offGroup, 'switch', 'off');
        console.log("Turn off all lights in on and off groups");
    })
    // Turn on main switch if any of the on group lights are turned on separately
    .subscribedEventHandler('onGroupHandler', async (context, event) => {
        console.log("Turn on the main switch when a light in the on group is turned on");
	// indicate main switch was NOT manually pressed
	stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'false' );
        
	// Turn on the main switch when a light in the on group is turned on
        await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
    })
    // Turn off the lights only when all motion sensors become inactive
    .subscribedEventHandler('motionStopHandler', async (context, event) => {
        // See if there are any motion sensors defined
        const motionSensors =  context.config.motionSensors
            .filter(it => it.deviceConfig.deviceId !== event.deviceId)
        if (motionSensors) {
            // Get the current states of the other motion sensors
            const stateRequests = motionSensors.map(it => context.api.devices.getCapabilityStatus(
                it.deviceConfig.deviceId,
                it.deviceConfig.componentId,
                'motionSensor'
            ));
            
            // Quit if there are other sensor still active
            const states = await Promise.all(stateRequests)
            if (states.find(it => it.motion.value === 'active')) {
                return
            }
        }
        console.log("Turn off lights after specified delay");
        const delay = context.configNumberValue('delay')
        if (delay) {
            // Schedule turn off if delay is set
            await context.api.schedules.runIn('motionStopped', delay)
        } else {
            // Turn off immediately if no delay
            await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
        }
    })
*/
    
    // Check temperature and turn on/off fan as appropriate
    .scheduledEventHandler('checkTemperature', async (context, event) => {
	// compare current temperature to target temperate
	// console.log("Context: ", context);

	// console.log("Control: ", context.config.tempSensor);	
	const sensorTemp =  context.config.tempSensor;

	// Get the current states of the other motion sensors
	const stateRequests = sensorTemp.map(it => context.api.devices.getCapabilityStatus(
		it.deviceConfig.deviceId,
		it.deviceConfig.componentId,
		'temperatureMeasurement'
	));

	// Quit if there are other sensor still active
	const states = await Promise.all(stateRequests);
	const currentTemp = states[0].temperature.value;
	const targetTemp = context.configNumberValue('tempTarget');

	console.log('Temperature: ', currentTemp);

	if (currentTemp>targetTemp) {
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'on')
	} else {
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off')
	}
	
	// call next temperature check
        await context.api.schedules.runIn('checkTemperature', 300);	
		
    });

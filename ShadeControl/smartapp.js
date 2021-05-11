const SmartApp   = require('@smartthings/smartapp');
const stateVariable = require('./state-variable');

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages
    // .contextStore(contextStore)     // context store to persist room state

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // main control switch
        page.section('switch', section => {
            section
                .deviceSetting('controlSwitch')
                .capabilities(['switch'])
                .required(true)
                .permissions('rx');            
        });

        // shade states
        page.section('shades', section => {
            section
                .deviceSetting('shade0')
                .capabilities(['switch'])
		.permissions('rx');
            section
                .deviceSetting('shade1')
                .capabilities(['switch'])
		.permissions('rx');
            section
                .deviceSetting('shade2')
                .capabilities(['switch'])
		.permissions('rx');
            section
                .deviceSetting('shade3')
                .capabilities(['switch'])
		.permissions('rx')
        });
    })

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
	console.log("ShadeControl: Installed/Updated");
        
	// initialize state variable(s)
	stateVariable.putState( context.event.appId, 'shadeState', '0' );

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

	/*
	// create subscriptions for relevant devices
        await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
            'switch', 'switch.on', 'mainSwitchOnHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.mainSwitch,
            'switch', 'switch.off', 'mainSwitchOffHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.onGroup,
            'switch', 'switch.on', 'onGroupHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.active', 'motionStartHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.inactive', 'motionStopHandler');
	*/
        console.log('Shade Control: END CREATING SUBSCRIPTIONS')
    })

/*
    // Turn on the lights when main switch is pressed
    .subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	// console.log("Checking value of mainSwitchPressed");
	console.log("On Switch Pressed");
	console.log("Context: ", context);
	console.log("Event: ", event);

	// check value of mainSwitchPressed state variable
	if ( stateVariable.getState( context.event.appId, 'mainSwitchPressed' ) == 'true' ) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
	} else {
		stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
	}	

	// start timer to turn off lights if value specified
	const delay = context.configNumberValue('delay')
	if (delay) {
	    // Schedule turn off if delay is set
	    await context.api.schedules.runIn('motionStopped', delay)
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

    // Turns off lights after delay elapses
    .scheduledEventHandler('motionStopped', async (context, event) => {
        await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
    });
*/

const SmartApp   = require('@smartthings/smartapp');
// const DynamoDBContextStore = require('../lib/dynamodb-context-store')
// store = new DynamoDBContextStore({client: testDynamoClient, autoCreate: false})
const contextStore = new DynamoDBContextStore({AWSRegion: 'us-west-2'});

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages
    .contextStore(contextStore)     // context store to persist room state

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // lights to control
        page.section('lights', section => {
            section
                .deviceSetting('lights')
                .capabilities(['switch'])
                .required(true)
                .multiple(true)
                .permissions('rx');
        });

        // door contact sensor
        page.section('contact', section => {
            section
                .deviceSetting('contactSensor')
                .capabilities(['contactSensor'])
        });
    
        // motion sensor(s)
        page.section('sensors', section => {
            section
                .deviceSetting('motionSensors')
                .capabilities(['motionSensor'])
                .multiple(true);
        });

        // optional turn-off delay after motions stops
        page.section('delay', section => {
            section
                .numberSetting('delay')
                .required(false)
        });
    })

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
        await context.api.subscriptions.unsubscribeAll()

        await context.api.subscriptions.subscribeToDevices(context.config.contactSensor,
            'contactSensor', 'contact.open', 'contactOpenHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.contactSensor,
            'contactSensor', 'contact.closed', 'contactClosedHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.active', 'motionStartHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.inactive', 'motionStopHandler');

        // initialize context variables
        // contextStore.put( context.appId );
        console.log('END CREATING SUBSCRIPTIONS')
    })

    // Turn on the lights when door contact is closed
    .subscribedEventHandler('contactClosedSensor', async (context, event) => {
        console.log('DOOR CLOSED, TURN ON LIGHTS')
        // Turn on the lights
        await context.api.devices.sendCommands(context.config.lights, 'switch', 'on');

        // Delete any scheduled turn offs
        if (context.configNumberValue('delay')) {
            await context.api.schedules.delete('motionStopped');
        }
    })

    // Turn off the lights when door contact is open
    .subscribedEventHandler('contactOpenSensor', async (context, event) => {
        console.log('DOOR OPEN, TURN OFF LIGHTS')
        // Turn off the lights
        await context.api.devices.sendCommands(context.config.lights, 'switch', 'on');

        const delay = context.configNumberValue('delay')
        if (delay) {
            // Schedule turn off if delay is set
            await context.api.schedules.runIn('motionStopped', delay)
        } else {
            // Turn off immediately if no delay
            await context.api.devices.sendCommands(context.config.lights, 'switch', 'off');
        }
    })

    // Turn on the lights when any motion sensor becomes active
    .subscribedEventHandler('motionStartHandler', async (context, event) => {
        console.log('MOTION DETECTED, TURN ON LIGHTS')
        // Turn on the lights
        await context.api.devices.sendCommands(context.config.lights, 'switch', 'on');

        // Delete any scheduled turn offs
        if (context.configNumberValue('delay')) {
            await context.api.schedules.delete('motionStopped');
        }
    })

    // Turn off the lights when all motion sensors become inactive, unless door(s) are closed
    .subscribedEventHandler('motionStopHandler', async (context, event) => {
        // Leave lights on if door is closed
        // console.log('Checking room contact sensor');
        if ( context.config.contactSensor.contact === 'closed'  ) { 
            return
        }
        console.log('Room door is closed');
    
        // See if there are other motion sensors
        const otherSensors = context.config.motionSensors
            .filter(it => it.deviceConfig.deviceId !== event.deviceId)

        if (otherSensors) {
            // Get the current states of the other motion sensors
            const stateRequests = otherSensors.map(it => context.api.devices.getCapabilityStatus(
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

        const delay = context.configNumberValue('delay')
        if (delay) {
            // Schedule turn off if delay is set
            await context.api.schedules.runIn('motionStopped', delay)
        } else {
            // Turn off immediately if no delay
            await context.api.devices.sendCommands(context.config.lights, 'switch', 'off');
        }
    })

    // Turns off lights after delay elapses
    .scheduledEventHandler('motionStopped', async (context, event) => {
        await context.api.devices.sendCommands(context.config.lights, 'switch', 'off');
    });

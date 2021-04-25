const SmartApp   = require('@smartthings/smartapp');

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // get controls and sensors
        page.section('controls', section => {
            section
                .deviceSetting('fan')
                .capabilities(['switch'])
                .required(true)
                .multiple(false);
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
    
        // prompts user to select one or more contact sensor(s)
        page.section('sensors', section => {
            section
                .deviceSetting('motionSensors')
                .capabilities(['motionSensor'])
                .required(false)
                .multiple(true);
        });

/*
        // prompts users to select one or more switch devices
        page.section('lights', section => {
            section
                .deviceSetting('lights')
                .capabilities(['switch'])
                .required(true)
                .multiple(true)
                .permissions('rx');
        });
*/

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

        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.active', 'motionStartHandler')
        await context.api.subscriptions.subscribeToDevices(context.config.motionSensors,
            'motionSensor', 'motion.inactive', 'motionStopHandler');
            console.log('END CREATING SUBSCRIPTIONS')
    })

    // Turn on the lights when any motion sensor becomes active
    .subscribedEventHandler('motionStartHandler', async (context, event) => {
        // Turn on the lights
        await context.api.devices.sendCommands(context.config.lights, 'switch', 'on');

        // Delete any scheduled turn offs
        if (context.configNumberValue('delay')) {
            await context.api.schedules.delete('motionStopped');
        }
    })

    // Turn off the lights only when all motion sensors become inactive
    .subscribedEventHandler('motionStopHandler', async (context, event) => {
        // See if there are other sensors
        const otherSensors =  context.config.motionSensors
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

/*
    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
        await context.api.subscriptions.delete()
        await context.api.subscriptions.subscribeToDevices(context.config.contactSensor,
            'contactSensor', 'contact', 'openCloseHandler');
    })

    // Handler called when the configured open/close sensor opens or closes
    .subscribedEventHandler('openCloseHandler', (context, event) => {
        const value = event.value === 'open' ? 'on' : 'off';
        context.api.devices.sendCommands(context.config.lights, 'switch', value);
    });
*/

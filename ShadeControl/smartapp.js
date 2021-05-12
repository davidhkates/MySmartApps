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
                .deviceSetting('shadeControl')
                .capabilities(['button'])
                .required(true)
                .permissions('r');
	    section
	    	.deviceSetting('shadeDirection')
		.capabilities(['switch'])
		.required(true)
		.permissions('r');
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

	// create subscriptions for relevant devices
	await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
            'button', 'button.pushed', 'shadeUpHandler');
	await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
            'switch', 'switch', 'shadeDirectionHandler');
/*
	await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
            'button', 'button.up', 'shadeUpHandler');
        await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
            'button', 'button.down', 'shadeDownHandler');
*/
	
	console.log('Shade Control: END CREATING SUBSCRIPTIONS')
    })


    // Update shade state in response to switch being pressed
    .subscribedEventHandler('shadeUpHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	// console.log("Checking value of mainSwitchPressed");
	console.log("On Switch Pressed");
	console.log("Context: ", context);
	console.log("Event: ", event);

/*
	// check value of mainSwitchPressed state variable
	if ( stateVariable.getState( context.event.appId, 'mainSwitchPressed' ) == 'true' ) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
	} else {
		stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
	}	
*/
    })


    .subscribedEventHandler('shadeDownHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	// console.log("Checking value of mainSwitchPressed");
	console.log("On Switch Pressed");
	console.log("Context: ", context);
	console.log("Event: ", event);

/*
	// check value of mainSwitchPressed state variable
	if ( stateVariable.getState( context.event.appId, 'mainSwitchPressed' ) == 'true' ) {
		await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on')
	} else {
		stateVariable.putState( context.event.appId, 'mainSwitchPressed', 'true' );
	}	
*/
    })


    .subscribedEventHandler('shadeDirectionHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	// console.log("Checking value of mainSwitchPressed");
	console.log("On Switch Pressed");
	console.log("Context: ", context);
	console.log("Event: ", event);
    });


/*
    .subscribedEventHandler('switchHandler', async (ctx, event) => {
	console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
    })
*/


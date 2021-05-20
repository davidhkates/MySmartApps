// import required node packages
const SmartApp   = require('@smartthings/smartapp');
const SmartState = require('@katesthings/smartstate');
// const SmartSensor = require('@katesthings/smartcontrols');


// get the state of specified switch
async function getSwitchState( context, sensor ) {
	try {
		const sensorDevice = sensor.deviceConfig;
		const sensorState = await context.api.devices.getCapabilityStatus( sensorDevice.deviceId, sensorDevice.componentId, 'switch');
		return sensorState.switch.value;
	} catch (err) {
		console.log("Error", err);
	}	
};


// define shared functions
async function buttonPush(context) {
	// create shade array
	const shade_array = [context.config.shade0, context.config.shade1, context.config.shade2, context.config.shade3];

	// determine number of shade states specified
	var maxState = 0;
	while ( shade_array[maxState] ) {
		maxState++;
	}

	// get shade direction
	// const shadeControl = await SmartSensor.getSwitchState( context, context.config.shadeControl[0] );
	const shadeControl = await getSwitchState( context, context.config.shadeControl[0] );
	const shadeDirection = ( shadeControl == 'on' ? 'up' : 'down' );
	// const shadeDirection = await SmartState.getState( context.event.appId, 'shadeDirection' );
	const oldShadeState = parseInt( await SmartState.getState( context.event.appId, 'shadeState' ));
	var newShadeState = oldShadeState;
	if ( shadeDirection == "up" ) {
		newShadeState = Math.min( oldShadeState+1, maxState ); 
	} else {
		newShadeState = Math.max( oldShadeState-1, 0 );
	}

	// set shade to new state and save in state settings if changed
	if (newShadeState!=oldShadeState) {
		console.log('Pressing switch for shade state: ', newShadeState);
		await context.api.devices.sendCommands(shade_array[newShadeState], 'switch', 'on');
		SmartState.putState( context.event.appId, 'shadeState', newShadeState.toString() );
	}	
}

/* Define the SmartApp */
module.exports = new SmartApp()
	.enableEventLogging()   // logs requests and responses as pretty-printed JSON
	.configureI18n()        // auto-create i18n files for localizing config pages

	// Configuration page definition
    	.page('mainPage', (context, page, configData) => {

		// main control switch
        	page.section('switch', section => {
			section
				.deviceSetting('shadeControl')
				.capabilities(['button','switch'])
				.required(true)
				.permissions('rx')
			section
				.deviceSetting('shadeDirection')
				.capabilities(['switch'])
				.required(true)
				.permissions('rx')
		});

        	// shade states
		page.section('shades', section => {
			section
				.deviceSetting('shade0')
				.capabilities(['momentary'])
				.permissions('rx');
			section
				.deviceSetting('shade1')
				.capabilities(['momentary'])
				.permissions('rx');
			section
				.deviceSetting('shade2')
				.capabilities(['momentary'])
				.permissions('rx');
			section
				.deviceSetting('shade3')
				.capabilities(['momentary'])
				.permissions('rx')
		});
	})

	// Handler called whenever app is installed or updated
	// Called for both INSTALLED and UPDATED lifecycle events if there is
	// no separate installed() handler
	.updated(async (context, updateData) => {
		console.log("ShadeControl: Installed/Updated");
        
		// initialize state variable(s)
		SmartState.putState( context.event.appId, 'shadeState', '0' );
		SmartState.putState( context.event.appId, 'shadeDirection', 'up' );

		// unsubscribe all previously established subscriptions
		await context.api.subscriptions.unsubscribeAll();

		// create subscriptions for relevant devices
		await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
		    'button', 'button.pushed', 'shadeButtonHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.shadeDirection,
		    'switch', 'switch.on', 'shadeUpHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.shadeDirection,
		    'switch', 'switch.off', 'shadeDownHandler');
/*
		await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
		    'switch', 'switch.on', 'shadeUpHandler');
		await context.api.subscriptions.subscribeToDevices(context.config.shadeControl,
		    'switch', 'switch.off', 'shadeDownHandler');
*/
	
		console.log('Shade Control: END CREATING SUBSCRIPTIONS')
	})


	// Update shade state in response to switch being pressed
	.subscribedEventHandler('shadeButtonHandler', async (context, event) => {
		await buttonPush(context);
	})


	// When on pressed, set shade direction state variable to "up"
    	.subscribedEventHandler('shadeUpHandler', async (context, event) => {
		console.log("On Switch Pressed");
		await SmartState.putState( context.event.appId, 'shadeDirection', 'up' );
		await buttonPush(context);
	})


	// When off pressed, set shade direction state variable to "down"
	.subscribedEventHandler('shadeDownHandler', async (context, event) => {
		console.log("Off Switch Pressed");
		await SmartState.putState( context.event.appId, 'shadeDirection', 'down' );
		await buttonPush(context);
	});


/*
	.subscribedEventHandler('switchHandler', async (ctx, event) => {
		console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
	})
*/

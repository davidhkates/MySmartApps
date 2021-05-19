const SmartApp   = require('@smartthings/smartapp');
const stateVariable = require('@katesthings/smartstate');

/* Define the SmartApp */
module.exports = new SmartApp()
	.enableEventLogging()  // logs requests and responses as pretty-printed JSON
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
		stateVariable.putState( context.event.appId, 'shadeState', '0' );
		stateVariable.putState( context.event.appId, 'shadeDirection', 'down' );

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
		// Get session state variable to see if button was manually pressed
		console.log("Shade Button Pushed");
		// console.log("Event: ", event);

		// create shade array
		const shade_array = [context.config.shade0, context.config.shade1, context.config.shade2, context.config.shade3];

		// determine number of shade states specified
		var maxState = 0;
		while ( shade_array[maxState] ) {
			maxState++;
		}
		console.log("Maximum number of shade states: ", maxState);

		// const oldShadeState = JSON.stringify(await stateVariable.getState( context.event.appId, 'shadeState' )).parseInt();
		const shadeDirection = await stateVariable.getState( context.event.appId, 'shadeDirection' );
		const oldShadeState = parseInt( await stateVariable.getState( context.event.appId, 'shadeState' ));
		var newShadeState = oldShadeState;
		if ( shadeDirection == "up" ) {
			newShadeState = Math.min( oldShadeState+1, maxState ); 
		} else {
		    	newShadeState = Math.max( oldShadeState-1, 0 );
		}
		console.log('Shade state - old: ', oldShadeState, ', new: ', newShadeState);

		// set shade to new state and save in state settings if changed
		if (newShadeState!=oldShadeState) {
			/*
			switch(newShadeState) {
				case 0:
					console.log("Pushing button for shade 0");
					await context.api.devices.sendCommands(context.config.shade0, 'switch', 'on');
					break;
				case "1":
					console.log("Pushing button for shade 1");
					await context.api.devices.sendCommands(context.config.shade1, 'switch', 'on');
					break;
				case "2":
					console.log("Pushing button for shade 2");
					await context.api.devices.sendCommands(context.config.shade2, 'switch', 'on');
					break;
				case "3":
					console.log("Pushing button for shade 3");
					await context.api.devices.sendCommands(context.config.shade3, 'switch', 'on');
					break;		
				default:
					console.log("We shouldn't ever get here... Old Shade State: ", oldShadeState, ", New Shade State: ", newShadeState);
			}
			*/
			await context.api.devices.sendCommands(shade_array[newShadeState], 'switch', 'on');
			stateVariable.putState( context.event.appId, 'shadeState', newShadeState.toString() );
		}	
	})


	// When on pressed, set shade direction state variable to "up"
    	.subscribedEventHandler('shadeUpHandler', async (context, event) => {
		console.log("On Switch Pressed");
		stateVariable.putState( context.event.appId, 'shadeDirection', 'up' );
/*
		// await context.api.devices.sendCommands(context.config.switch0, 'switch', 'on');
		console.log("Set shade to state 2");
		await context.api.devices.sendCommands(context.config.shade2, 'switch', 'on');
		console.log("Shade control button pressed");
*/
	})


	// When off pressed, set shade direction state variable to "down"
	.subscribedEventHandler('shadeDownHandler', async (context, event) => {
		console.log("Off Switch Pressed");
		stateVariable.putState( context.event.appId, 'shadeDirection', 'down' );
	});


/*
	.subscribedEventHandler('switchHandler', async (ctx, event) => {
		console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
	})
*/

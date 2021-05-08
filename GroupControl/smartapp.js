const SmartApp   = require('@smartthings/smartapp');
import { getState, putState } from './state-variable.js';

/*
// const DynamoDBContextStore = require('@smartthings/dynamodb-context-store');

// Import required AWS SDK clients and commands for establishing DynamoDBClient
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const REGION = 'us-west-2'; //e.g. "us-east-1"
const dbclient = new DynamoDBClient({ region: REGION });
*/

/*
const appId = process.env.APP_ID
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const tableName = process.env.DYNAMODB_TABLE || 'smartapp-context-store'
if (!process.env.AWS_REGION && !process.env.AWS_PROFILE) {
	console.log('\n***************************************************************************')
	console.log('*** Please add AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY ***')
	console.log('*** entries to the .env file to run the server                          ***')
	console.log('***************************************************************************')
	return
}
// const contextStore = new DynamoDBContextStore();
// const contextStore = new DynamoDBContextStore({AWSRegion: 'us-west-2'});
const contextStore = new DynamoDBContextStore({
        table: {
            name: tableName,
            hashKey: 'id', 
            // sortKey: 'sk'
        },
	AWSRegion: 'us-west-2',
	autoCreate: false
});
*/

/*
  Store the value of the specified state variable stored in DynamoDB as string
  */
/*
async function putState( appId, variableName, value ) {
	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Item: {
    			appId: { S: appId },
			name: { S: variableName },
			value: { S: value },
  		},
	};
	
	try {
    		const data = await dbclient.send(new PutItemCommand(params));
    		console.log(data);
  	} catch (err) {
    		console.error(err);
  	}
};

//  Get the value of the specified state variable stored in DynamoDB, returned as string
async function getState( appId, variableName ) {
	console.log("Calling DynamoDB application context store to get state variable value");

	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Key: {
    			appId: { S: appId },
			name: { S: variableName },
  		},
  		ProjectionExpression: 'value',
	};
  	
	// Return the requested state variable
	try {
		const data = await dbclient.send(new GetItemCommand(params));
		console.log("Success - state variable value = ", data.Item);
		return data.Item;
	} catch (err) {
		console.log("Error", err);
	}	
};	
*/

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages
    // .contextStore(contextStore)     // context store to persist room state

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // main control switch
        page.section('switches', section => {
            section
                .deviceSetting('mainSwitch')
                .capabilities(['switch'])
                .required(true)
                .permissions('rx');            
            section
                .deviceSetting('onGroup')
                .capabilities(['switch'])
                .required(true)
                .multiple(true)
                .permissions('rx');            
            section
                .deviceSetting('offGroup')
                .capabilities(['switch'])
                .multiple(true)
                .permissions('rx');            
        });

        // prompts user to select a contact sensor
        page.section('sensors', section => {
            section
                .deviceSetting('motionSensors')
                .capabilities(['motionSensor'])
                .multiple(true);
            section
                .numberSetting('delay')
                .required(false)
        });
    })

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
	console.log("MotionGroup: Installed/Updated");
        
	// initialize state variable(s)
	let putState( context.event.appId, 'mainSwitchPressed', 'true' );

	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

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
        console.log('Motion Group: END CREATING SUBSCRIPTIONS')
    })

    // Turn on the lights when main switch is pressed
    .subscribedEventHandler('mainSwitchOnHandler', async (context, event) => {
	// Get session state variable to see if button was manually pressed
	console.log("Calling DynamoDB store");

	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Key: {
    			appId: { S: context.event.appId },
			name: { S: 'mainSwitchPressed' },
  		},
  		ProjectionExpression: 'value',
	};
  	
	// Get the requested state variable
	try {
		const data = await dbclient.send(new GetItemCommand(params));
		console.log("Success - main switch pressed value = ", data.Item);
	} catch (err) {
		console.log("Error", err);
	}	
	console.log("Context object: ", context);
		
/*
        // Turn on the lights in the on group if they are all off
        const roomSwitches = onGroup.map(it => context.api.devices.getCapabilityStatus(
            it.deviceConfig.deviceId,
            it.deviceConfig.componentId,
            'switch'));
        // Quit if any of the switches in the on group are off
        const states = await Promise.all(stateSwitches)
        if (states.find(it => it.switch.value === 'off')) {
            return
        }
*/
    
        // If we make it here, turn on all lights in onGroup
        await context.api.devices.sendCommands(context.config.onGroup, 'switch', 'on');
    
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
        // Turn on the main switch when a light in the on group is turned on
        // await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'on');
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

/*
    .subscribedEventHandler('switchHandler', async (ctx, event) => {
	console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
    })
*/

    // Turns off lights after delay elapses
    .scheduledEventHandler('motionStopped', async (context, event) => {
        await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
    });

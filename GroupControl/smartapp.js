
const SmartApp   = require('@smartthings/smartapp');
// const DynamoDBStore = require('dynamodb-store');
// const DynamoDBContextStore = require('@smartthings/dynamodb-context-store');

// Import required AWS SDK clients and commands for establishing DynamoDBClient
// const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
// const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { DynamoDBClientGet, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBClientPut, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const REGION = 'us-west-2'; //e.g. "us-east-1"
// const dynamodb = new DynamoDB({ region: REGION });
const dbclientGet = new DynamoDBClientGet({ region: REGION });
const dbclientPut = new DynamoDBClientPut({ region: REGION });

// Set the parameters
const params = {
  TableName: 'smartapp-context-store',
  Key: {
    id: { S: '1' },
  },
  ProjectionExpression: 'mainSwitchPressed',
};

/*
/ Set the parameters
const params = {
  TableName: "TABLE_NAME",
  // Convert the key JavaScript object you are deleting to the required DynamoDB format. The format of values
  // specifies the datatype. The following list demonstrates different datatype formatting requirements:
  // HashKey: "hashKey",
  // NumAttribute: 1,
  // BoolAttribute: true,
  // ListAttribute: [1, "two", false],
  // MapAttribute: { foo: "bar" },
  // NullAttribute: null
  Key: marshall({
    primaryKey: VALUE, // For example, "Season: 2"
    sortKey: VALUE, // For example,  "Episode: 1" (only required if table has sort key)
  }),
  // Define expressions for the new or updated attributes
  UpdateExpression: "set ATTRIBUTE_NAME_1 = :t, ATTRIBUTE_NAME_2 = :s", // For example, "'set Title = :t, Subtitle = :s'"
  // Convert the attribute JavaScript object you are deleting to the required DynamoDB format
  ExpressionAttributeValues: marshall({
    ":t": NEW_ATTRIBUTE_VALUE_1, // For example "':t' : 'NEW_TITLE'"
    ":s": NEW_ATTRIBUTE_VALUE_2, // For example " ':s' : 'NEW_SUBTITLE'"
  }),
};
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
	// initialize context variable(s)
/*
	console.log("Adding new state variable to context object");
	context.mainSwitchPressed = true;
	console.log("SUCCESS - added new state variable to context object");

	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
		Item: {
			id: { N: 2 },
			appId: { S: context.event.appId },
		}
	};
    	const data = await dbclient.send(new PutItemCommand(params));
    	console.log("PutItemCommand response: ",data);
*/
	
/*
	const input = {
    		id: '2'
		// appId: context.event.appId     // ${event.deviceId}
	};
	
	// Marshall util converts then JavaScript object to DynamoDB format
	const Item = marshall(input);
	
	// write to DynamoDB table
	try {
	        const data = await dynamodb.putItem({ 'smartapp-context-store', Item });
        	console.log('Success - put')
	} catch(err) {
		console.log('Error', err)
	}
*/
	
	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Item: {
	    		id: { S: "2" },		// N: "2"
    			appId: { S: context.event.appId },
  		},
	};
	
	try {
    		const data = await dbclientPut.send(new PutItemCommand(params));
    		console.log(data);
  	} catch (err) {
    		console.error(err);
  	}
	
	// await context.put(contextRecord);
	// context.put(context.config.
	
	// console.log("MotionGroup: Installed/Updated");
        await context.api.subscriptions.unsubscribeAll();

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
  	const data = await dbclientGet.send(new GetItemCommand(params));
	
	/*
	try {
    		const { Item } = await client.updateItem(params);
    		console.log("Success - updated");
  	} catch (err) {
    		console.log("Error", err);
  	}
	*/
	
  	console.log("Success (dbClient): ", data.Item);
	// console.log("Context object: ", JSON.stringify(context, censor(context)));
	console.log("Context object: ", context);
	console.log("appId: ", context.event.appId);
	
	// data = await contextStore.get(context.appId);
	// console.log("Success (context store): ", data.Item);
	
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

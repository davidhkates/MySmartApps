/*

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});
const stateDB = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

var params = {
 TableName: 'smartapp-state-variables',
 Key: {'KEY_NAME': VALUE}
};

docClient.get(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data.Item);
  }
});

*/

const SmartApp   = require('@smartthings/smartapp');

// Import required AWS SDK clients and commands for Node.js
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");

// Set the AWS Region
const REGION = "us-west-2"; //e.g. "us-east-1"

// Create DynamoDB service object
const dbclient = new DynamoDBClient({ region: REGION });

// Set the parameters
const params = {
  TableName: 'smartapp-context-store',
  Key: {
    ID: { N: 1 },
  },
  ProjectionExpression: 'main-switch-pressed',
};

/*
const DynamoDBStore = require('dynamodb-store');
const DynamoDBContextStore = require('@smartthings/dynamodb-context-store')

const appId = process.env.APP_ID
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const tableName = process.env.DYNAMODB_TABLE || 'smartapp-context-store'
// const serverUrl = process.env.SERVER_URL || `https://${process.env.PROJECT_DOMAIN}.glith.me`
// const redirectUri =  `${serverUrl}/oauth/callback`
// const scope = encodeUrl('r:locations:* r:devices:* x:devices:*');

if (!process.env.AWS_REGION && !process.env.AWS_PROFILE) {
	console.log('\n***************************************************************************')
	console.log('*** Please add AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY ***')
	console.log('*** entries to the .env file to run the server                          ***')
	console.log('***************************************************************************')
	return
}
*/

/*
 * Server-sent events. Used to update the status of devices on the web page from subscribed events
 */
// const sse = new SSE()

/*
 * Persistent storage of session data in DynamoDB. Table will be automatically created if it doesn't already exist.
 */
/*
const sessionStore = new DynamoDBStore({
	table: {
		name: tableName,
		hashKey : "id"
	}
})

// const contextStore = new DynamoDBContextStore();
// const contextStore = new DynamoDBContextStore({AWSRegion: 'us-west-2'});
const contextStore = new DynamoDBContextStore({
	table: {
		name: tableName,
		hashKey : "id"
		sortKey: {
                	AttributeName: 'sk',
                	AttributeType: 'S',
                	AttributeValue: 'context',
                	KeyType: 'RANGE'
            	}
        },
    	AWSRegion: 'us-west-2',
	autoCreate: false
});
*/

/*
smartapp.contextStore(new DynamoDBContextStore(
    {
        table: {
            name: 'custom-table',   // defaults to 'smartapp'
            hashKey: 'key1',        // defaults to 'id'
            prefix: 'context',      // defaults to 'ctx'
            readCapacityUnits: 10,  // defaults to 5, applies to automatic creation only
            writeCapacityUnits: 10  // defaults to 5, applies to automatic creation only
        },
        AWSRegion: 'us-east-2',     // defaults to 'us-east-1'
        autoCreate: true            // defaults to true
    }
))
*/

/*
const contextRecord = JSON.stringify({
  "installedAppId": "27db1e27-1b8b-47e7-a476-b978fb7ebfb5",
  "locationId": "8ea7ab21-932d-4256-80c6-abc53932dd3a",
  "authToken": "f4b3b75c-091f-4b31-9833-7b52fe875ffb",
  "refreshToken": "e980829a-9763-4105-b986-2d94114b1e80",
  "clientId": "b0e85683-4f06-4cfd-8cdf-3ecdda60dbc0",
  "clientSecret": "8ca75fde-9f84-4cf5-ad16-e8b5275fefd1",
  "config": {
    "scenes": [
      {
        "valueType": "STRING",
        "stringConfig": {
          "value": "true"
        }
      }
    ],
    "switches": [
      {
        "valueType": "STRING",
        "stringConfig": {
          "value": "true"
        }
      }
    ],
    "locks": [
      {
        "valueType": "STRING",
        "stringConfig": {
          "value": "true"
        }
      }
    ]
  }
});
*/

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages
    // .contextStore(contextStore)     // context store to persist room state


/*
 * Thew SmartApp. Provides an API for making REST calls to the SmartThings platform and
 * handles calls from the platform for subscribed events as well as the initial app registration challenge.
 */
/*
const apiApp = new SmartApp()
	.appId(appId)
	.clientId(clientId)
	.clientSecret(clientSecret)
	.contextStore(contextStore)
	.redirectUri(redirectUri)
	.subscribedEventHandler('switchHandler', async (ctx, event) => {
		/* Device event handler. Current implementation only supports main component switches */
/*
		if (event.componentId === 'main') {
			sse.send({
				deviceId: event.deviceId,
				switchState: event.value
			})
		}
		console.log(`EVENT ${event.deviceId} ${event.componentId}.${event.capability}.${event.attribute}: ${event.value}`)
	})
*/


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

    // 

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
	// initialize context variable
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
  	const data = await dbclient.send(new GetItemCommand(params));
  	console.log("Success (dbClient): ", data.Item);
	
	// data = await contextStore.get(context.appId);
	console.log("Success (context store): ", data.Item);
	
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

    // Turns off lights after delay elapses
    .scheduledEventHandler('motionStopped', async (context, event) => {
        await context.api.devices.sendCommands(context.config.mainSwitch, 'switch', 'off');
    });

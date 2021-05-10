// Import required AWS SDK clients and commands for establishing DynamoDBClient
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const dbclient = new DynamoDBClient({ region: 'us-west-2' });

/*
  Store the value of the specified state variable stored in DynamoDB as string
  */
async function putState( appId, variableName, value ) {
	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Item: {
    			appId: { S: appId },
			name: { S: variableName },
			value: { S: variableValue },
  		},
	};
	
	try {
    		const data = await dbclient.send(new PutItemCommand(params));
    		console.log(data);
  	} catch (err) {
    		console.error(err);
  	}
};

/*
  Get the value of the specified state variable stored in DynamoDB, returned as string
  */
async function getState( appId, variableName ) {
	console.log("Calling DynamoDB application context store to get state variable value");

	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Key: {
    			appId: { S: appId },
			name: { S: variableName },
  		},
  		ProjectionExpression: 'variableValue',
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

// Export state variable functions
// module.exports { getState, putState };
exports.getState = getState;
exports.putState = putState;

/*-------- Leftover code using DynamoDBContextStore, just in case  ----------*/
// Import required AWS SDK clients and commands for establishing DynamoDBClient
/*
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const REGION = 'us-west-2'; //e.g. "us-east-1"
const dbclient = new DynamoDBClient({ region: REGION });
*/
// const state-variable = require('./state-variable');
// import { getState, putState } from './state-variable.js';
/*
const DynamoDBContextStore = require('@smartthings/dynamodb-context-store');

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

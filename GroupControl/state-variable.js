// Import required AWS SDK clients and commands for establishing DynamoDBClient
/*
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const REGION = 'us-west-2'; //e.g. "us-east-1"
const dbclient = new DynamoDBClient({ region: REGION });
*/

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

// Export state variable functions
// export { getState, putState };

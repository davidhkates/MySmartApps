// Import required AWS SDK clients and commands for establishing DynamoDBClient
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const dbclient = new DynamoDBClient({ region: 'us-west-2' });

/*
  Store the value of the specified state variable stored in DynamoDB as string
  */
async function putState( appId, name, value ) {
	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Item: {
    			appId: { S: appId },
			name: { S: name },
			stateValue: { S: value },
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
async function getState( appId, name ) {
	console.log("Calling DynamoDB application context store to get state variable value");

	// Set the parameters
	const params = {
  		TableName: 'smartapp-context-store',
  		Key: {
    			appId: { S: appId },
			name: { S: name },
  		},
  		ProjectionExpression: 'stateValue',
	};
  	
	// Return the requested state variable
	try {
		const data = await dbclient.send(new GetItemCommand(params));
		// console.log("Success - state variable value = ", data.Item);
		// const returnValue = data.Item.stateValue.S;
		// console.log("Value: ", returnValue);
		return data.Item.stateValue.S;
	} catch (err) {
		console.log("Error", err);
	}	
};	

// Export state variable functions
// module.exports { getState, putState };
exports.getState = getState;
exports.putState = putState;

'use strict'

// Install relevant node packages
const axios = require("axios");
const SmartState = require('@katesthings/smartstate');

/*
const sonosToken = '';
// const sonosRedirect = 'https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const sonosCallbackID = 'r5twrfl7nd';
const sonosRedirect = encodeURI('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/callback');
console.log('Redirect URI: ', sonosRedirect);
const authRedirect = '&redirect_uri=https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosToken + '&redirect_uri=' + sonosRedirect;

async function getURI( uri ) {
	const sonosClientID = await SmartState.getValue( 'smartapp-sonos-speakers', 'clientID' );
	console.log('Client ID: ', sonosClientID);
	
	var responseData = '';
	await axios.get(uri).then(response => {
		console.log('Axios response: ', response.data);
		responseData = response.data;
	});
	return responseData;
};

function postURI( uri, token ) {
	const bodyParameters = {
		key: 'value'
	};

	const config = {
    		headers: { Authorization: 'Bearer ' + token }
	};
	
	axios.post(uri, bodyParameters, config).then(console.log).catch(console.log);
		const randomData = await getURI(uriRandom);
		console.log('Response from web service: ', randomData);
	}
	
	console.log('SonosControl: END CREATING SUBSCRIPTIONS')
})
*/

async function putValue( table, key, value ) {
	// Set the parameters
	const params = {
  		TableName: table,
  		Item: {
    			key: { S: key },
			keyValue: { S: value },
  		},
	};
	
	try {
		console.log('Put value: ', params);
    		const data = await dbclient.send(new PutItemCommand(params));
    		console.log(data);
  	} catch (err) {
    		console.error(err);
  	}
};


// Callback API code
const callback = (event, context, callback) => {

    // var token = event.authorizationToken;
    var token = event.multiValueQueryStringParameters.code[0];
    
    console.log('Sonos API Oauth Callback token: ', token);
    console.log('Event: ', event);
    console.log('Context: ', context);

    // SmartState.putValue( 'smartapp-sonos-speakers', 'bearerToken', token );
    SmartState.putValue( 'smartapp-sonos-speakers', 'bearerToken', token );
    
    const response = {
         statusCode: 200,
         headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': true
         },
         body: JSON.stringify({
              'message': 'Callback!'
         })
    }

  callback(null, response)
}

// export external modules
module.exports.callback = callback

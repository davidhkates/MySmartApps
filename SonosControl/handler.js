'use strict'

// Install relevant node packages
const axios = require("axios");
const SmartState = require('@katesthings/smartstate');
// const SmartUtils = require('@katesthings/smartutils');

/*
const sonosToken = '';
// const sonosRedirect = 'https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const sonosCallbackID = 'r5twrfl7nd';
const sonosRedirect = encodeURI('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/callback');
console.log('Redirect URI: ', sonosRedirect);
const authRedirect = '&redirect_uri=https%3A%2F%2Fm4bm3s9kj5.execute-api.us-west-2.amazonaws.com%2Fdev%2Fcallback';
const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosToken + '&redirect_uri=' + sonosRedirect;
*/


async function getURI( uri ) {
	// const sonosClientID = await SmartState.getValue( 'smartapp-sonos-speakers', 'clientID' );
	const sonosClientID = await getValue( 'smartapp-sonos-speakers', 'clientID' );
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
	/*
	axios.post(uri, bodyParameters, config).then(resp => {
		console.log('Axios response: ', resp.data);
	}.catch(console.log);
	*/
};


// Callback API code
const authCallback = (event, context, callback) => {

	// var token = event.authorizationToken;
	var sonosAuthCode = event.multiValueQueryStringParameters.code[0];
	console.log('Sonos API Oauth Callback authorization code: ', sonosAuthCode);
	// console.log('Event: ', event);
	// console.log('Context: ', context);
	
	// Store sonos authorization code in DynamoDB (at least for now, may ultimately not be needed)
	SmartState.putValue( 'smartapp-sonos-speakers', 'authorization-code', sonosAuthCode );
	
	// Call Sonos create token API
	const sonosCallbackID = 'r5twrfl7nd';
	const sonosTokenRedirect = encodeURI('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/token_callback');	
	const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	// SmartState.putValue( 'smartapp-sonos-speakers', 'bearerToken', token );	
    
	const response = {
		statusCode: 200,
 		headers: {
 			'Access-Control-Allow-Origin': '*',
 			'Access-Control-Allow-Credentials': true
		},
 		body: JSON.stringify({
			// 'message': 'Token value: ' + authToken
			'message': 'Authorization code: ' + sonosAuthCode
		})
	}

	callback(null, response);
}

const authPageStart = '<!DOCTYPE html><html lang="en">
<head><title>A simple HTML document</title></head>
<body><p>Hello World!<p>';
const authPageEnd = '</body></html>'

// Create token response endpoint
const tokenCallback = (event, context, callback) => {

	// var token = event.authorizationToken;
	var sonosBearerToken = event.multiValueQueryStringParameters.code[0];
	console.log('Sonos API Oauth Callback bearer token: ', sonosBearerToken);
	// console.log('Event: ', event);
	// console.log('Context: ', context);
	
	// Store sonos authorization code in DynamoDB (at least for now, may ultimately not be needed)
	SmartState.putValue( 'smartapp-sonos-speakers', 'bearer-token', sonosBearerToken );
	
	/*
	// Call Sonos create token API
	const sonosCallbackID = 'r5twrfl7nd';
	const sonosTokenRedirect = encodeURI('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/token_callback');	
	const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	*/
    
	const response = {
		statusCode: 200,
 		headers: {
 			'Access-Control-Allow-Origin': '*',
 			'Access-Control-Allow-Credentials': true
		},
 		body: authPageStart + 
			JSON.stringify({'message': 'Token value: ' + 
			sonosBearerToken}) + authPageEnd
	}

	callback(null, response);
}


// export external modules
module.exports.authCallback  = authCallback
module.exports.tokenCallback = tokenCallback

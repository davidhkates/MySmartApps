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


/*
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

function getToken( uri, data, token ) {
	const bodyParameters = {
		key: 'value'
	};

	const config = {
    		headers: { Basic: token }
	};
	
	axios.post(uri, bodyParameters, config).then(console.log).catch(console.log);
};

function postURI( uri, token ) {
	const bodyParameters = {
		key: 'value'
	};

	const config = {
    		headers: { Authorization: 'Bearer ' + token }
	};
	
	axios.post(uri, bodyParameters, config).then(console.log).catch(console.log);
	axios.post(uri, bodyParameters, config).then(resp => {
		console.log('Axios response: ', resp.data);
	}.catch(console.log);
};
*/

// Callback API code
const authCallback = (event, context, callback) => {

	// var token = event.authorizationToken;
	var sonosAuthCode = event.queryStringParameters.code;
	console.log('Sonos API Oauth Callback authorization code: ', sonosAuthCode);
	console.log('Event: ', event);
	// console.log('Context: ', context);
	
	// Store sonos authorization code in DynamoDB (at least for now, may ultimately not be needed)
	SmartState.putValue( 'smartapp-sonos-speakers', 'authorization-code', sonosAuthCode );
	
	/*
	// Call Sonos create token API
	// const sonosCallbackID = 'r5twrfl7nd';
	const sonosCallbackID = '00t156cqe1';
	// TODO - store these in environment variables or DynamoDB
	const sonosClientID = 'd313a2a0-960e-481f-9fc7-3c02e4366955';
	const sonosSecret   = '3acfdfd9-27c4-4a74-978d-e27fefa45bd2';
	const sonosAuthToken = Buffer.from(sonosClientID + ':' + sonosSecret).toString('base64');
	console.log('Encoded token: ', sonosAuthToken);
	const sonosTokenRedirect = encodeURIComponent('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/token-callback');
	const uriSonosCreateToken = 'https://api.sonos.com/login/v3/oauth/access?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	// console.log('Posting Sonos create token request: ', uriSonosCreateToken);
	
	/*
	// const uriSonosCreateToken = 'https://api.sonos.com/login/v3/oauth/access';
	const bodyParameters = {
		grant_type: 'authorization_code',
		code: sonosAuthCode,
		redirect_uri: sonosTokenRedirect
	}
	const config = {
    		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
			// 'Authorization': 'Basic ' + sonosAuthToken
			Basic: sonosAuthToken
		}
	}
	// axios.post(uriSonosCreateToken, bodyParameters, config).then(console.log).catch(console.log);
	// axios.post(uriSonosCreateToken, null, config).then(console.log).catch(console.log);


	/*
	const config = {
    		'https://api.sonos.com/login/v3/oauth/access',
		method: 'post',
    		data: '?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect
  	};
	await axios(config);
	// return () => axios(config).then(res => res.data);
	*/
	
	/*
	axios.post(uriSonosCreateToken, {
		headers: {
   			Authorization: 'Basic ' + sonosAuthToken,
			'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
		}
	})
	*/
	
	/*
	axios.get('https://api.openweathermap.org/data/2.5/weather?q=Denver&appid=178796e24e49d001f0999f866eb7eb52')
		.then(resp => {console.log('Axios openweather response: ', resp.data)})
		.catch(console.log);
	*/
	axios.post('https://httpbin.org/post')
		.then(resp => {console.log('Echo post data: ', resp.data)})
		.catch(console.log);
		
	// getToken(uriSonosCreateToken, sonosAuthToken);
	// axios.get(uriSonosCreateToken).then(console.log).catch(console.log);
	// const uriSonosAuth = 'https://api.sonos.com/login/v3/oauth?client_id=d313a2a0-960e-481f-9fc7-3c02e4366955&response_type=code&state=testState&scope=playback-control-all&redirect_uri=https%3A%2F%2Fr5twrfl7nd.execute-api.us-west-2.amazonaws.com%2Fdev%2Fauth-callback';
	// console.log('Sonos auth request: ', uriSonosAuth);
	console.log('Asynchronous request completed');
    
	const response = {
		statusCode: 200,
 		headers: {
 			'Access-Control-Allow-Origin': '*',
 			'Access-Control-Allow-Credentials': true
		},
 		body: JSON.stringify({
			'message': 'Authorization code: ' + sonosAuthCode
		})
	}
	callback(null, response);
}

/*
const authPageStart = '<!DOCTYPE html><html lang="en">
<head><title>A simple HTML document</title></head>
<body><p>Hello World!<p>';
const authPageEnd = '</body></html>'
*/


// Create token response endpoint
const tokenCallback = (event, context, callback) => {

	// var token = event.authorizationToken;
	console.log('Token callback entered with event: ', event);	
	var sonosBearerToken = event.multiValueQueryStringParameters.code[0];
	console.log('Sonos API Oauth Callback bearer token: ', sonosBearerToken);
	console.log('Event: ', event);
	// console.log('Context: ', context);
	
	// Store sonos authorization code in DynamoDB (at least for now, may ultimately not be needed)
	SmartState.putValue( 'smartapp-sonos-speakers', 'bearer-token', sonosBearerToken );
	
	/*
	// Call Sonos create token API
	const sonosCallbackID = 'r5twrfl7nd';
	const sonosTokenRedirect = encodeURI('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/token_callback');	
	const uriSonosCreateToken = 'https:///login/v3/oauth/access?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	*/
    
	/*
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
	callback();
}
*/


// export external modules
module.exports.authCallback  = authCallback
module.exports.tokenCallback = tokenCallback

'use strict'

// Install relevant node packages
const axios = require("axios");
const https = require("https");
const SmartState = require('@katesthings/smartstate');


// Callback API code
const authCallback = (event, context, callback) => {

	// var token = event.authorizationToken;
	var sonosAuthCode = event.queryStringParameters.code;
	var sonosRequestID = event.requestContext.requestId;
	console.log('Sonos API Oauth Callback authorization code: ', sonosAuthCode);
	console.log('Sonos API Oauth Callback request ID: ', sonosRequestID);
	// console.log('Event: ', event);
	// console.log('Context: ', context);
	
	// Store sonos authorization code in DynamoDB (at least for now, may ultimately not be needed)
	SmartState.putValue( 'smartapp-sonos-speakers', 'authorization-code', sonosAuthCode );
	

	// Call Sonos create token API
	const sonosCallbackID = '00t156cqe1';
	// TODO - store these in environment variables or DynamoDB
	const sonosClientID = 'd313a2a0-960e-481f-9fc7-3c02e4366955';
	const sonosSecret   = '3acfdfd9-27c4-4a74-978d-e27fefa45bd2';
	const sonosAuthToken = Buffer.from(sonosClientID + ':' + sonosSecret).toString('base64');
	// const sonosAuthToken = Buffer.from(sonosClientID + sonosSecret).toString('base64');
	// const sonosAuthToken = Buffer.from(sonosClientID).toString('base64') + sonosSecret;

	const sonosTokenRedirect = encodeURIComponent('https://' + sonosCallbackID + '.execute-api.us-west-2.amazonaws.com/dev/token-callback');
	// const uriSonosCreateToken = 'https://api.sonos.com/login/v3/oauth/access?grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	// const uriSonosCreateToken = 'https://api.sonos.com/login/v3/oauth/access?grant_type=authorization_code&code=' + sonosRequestID + '&redirect_uri=' + sonosTokenRedirect;
	const uriSonosCreateToken = 'https://api.sonos.com/login/v3/oauth/access';
	
	/*
	axios.get('https://api.openweathermap.org/data/2.5/weather?q=Denver&appid=178796e24e49d001f0999f866eb7eb52')
		.then(resp => {console.log('Axios openweather response: ', resp.data)})
		.catch(console.log);
	*/

	const postData = 'grant_type=authorization_code&code=' + sonosAuthCode + '&redirect_uri=' + sonosTokenRedirect;
	// const postData = 'grant_type=authorization_code&code=' + sonosRequestID + '&redirect_uri=' + sonosTokenRedirect;
	// console.log('Post Data: ', postData);
	const postHeaders = {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
   			'Authorization': 'Bearer ' + sonosAuthToken,
		}
	};

/*
const data = postData;
const options = {
  hostname: 'api.sonos.com',
  port: 443,
  path: '/login/v3/oauth/access',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    'Content-Length': data.length,
    'Authorization': 'Basic ' + sonosAuthToken
  }
}
const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`)
  res.on('data', d => {
    process.stdout.write(d)
  })
})
req.on('error', error => {
  console.error(error)
})
req.write(data)
req.end()
*/
	

	// axios.post(uriSonosCreateToken + '&' + postData, null, postHeaders)
	axios.post(uriSonosCreateToken, postData, postHeaders)
		.then(resp => {console.log('Echo post data: ', resp.data)})
		.catch(console.log);
	console.log('Asynchronous create token POST request completed');
	
	// create response option to pass back from callback
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
	*/
	callback();
}


// export external modules
module.exports.authCallback  = authCallback
module.exports.tokenCallback = tokenCallback

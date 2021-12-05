'use strict'

// Install relevant node packages
const axios = require("axios");
// const base64 = require("base64-js");

// Sonos authorization callback
exports.authCallback = (event, context, callback) => {
	const authCode = event.queryStringParameters.code;
	const requestId = event.requestContext.requestId;
	console.log('Event: ', event);
	console.log('Code: ', authCode);
	console.log('Context: ', context);

	const message = {'message': 'Auth Code: ' + authCode};
	const keyName = 'd313a2a0-960e-481f-9fc7-3c02e4366955';

	/*
	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
	*/
	
	const uriAuth = 'https://api.sonos.com/login/v3/oauth/access';
	const request = 'grant_type=authorization_code&code=' + authCode + '&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
	// const request = 'grant_type=authorization_code&code=' + requestId + '&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
	// const request = 'grant_type=authorization_code&code=' + keyName + '&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
	console.log('Request: ', request);
	// const request = 'grant_type=authorization_code&code=d37cca67-d509-4c04-9df4-49f8c6f0004b&redirect_uri=https%3A%2F%2FACME.example.com%3A7443%2Foauth%2Fv2%2Fclient%2Fauthcode';
	const headers = { 
		'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg==',
		'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
	};
	
	/*
	axios.post(uriAuth, article, { headers })
		.then(response => element.innerHTML = response.data.id);	
	*/
	console.log('Making call to get token');
	const response = axios.post(uriAuth, request, headers);
	console.log('Response data: ', response.data);
};

/*
exports.authCallback = async function(event, context) {
	console.log('Code: ', event.queryStringParameters.code);
	return context.logStreamName;
};
	
/*
exports.handler =  async function(event, context) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2))
  return context.logStreamName
}

function authCallback(event, context, callback) {
	// console.log('Auth made it: Event: ', event, '\nContext: ', context, '\nCallback: ', callback);
	console.log('Code: ', event.queryStringParameters.code);
    callback('success', 'error');
	// return "Auth made it";
};

function authCallback(event, context) {
	// console.log('Auth made it: Event: ', event, '\nContext: ', context, '\nCallback: ', callback);
	console.log('Code: ', event.queryStringParameters.code);
    // callback('success', 'error');
	return context.logStreamName;
};
*/

// Sonos authorization callback
exports.tokenCallback = (event, context, callback) => {
	// const token = event.queryStringParameters.code;
	console.log('Event: ', event);

	const message = {'message': 'Token received'};

	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
};

/*
exports.handler = (event, context, callback) => {
      mqfunc1(callback);
};

var mqfunc1 = function(callback) {
    callback({'result': 'success'});
};
*/

// export external modules
// module.exports.authCallback  = authCallback
// module.exports.tokenCallback = tokenCallback

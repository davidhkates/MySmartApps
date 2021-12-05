'use strict'

// Install relevant node packages
const axios = require("axios");

// Sonos authorization callback
exports.authCallback = (event, context, callback) => {
	const authCode = event.queryStringParameters.code;
	console.log('Code: ', authCode);

	const message = {'message': 'Auth Code: ' + authCode};

	/*
	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
	*/
	
	const uriAuth = 'https://api.sonos.com/login/v3/oauth/access';
    const request = 'client_id=d313a2a0-960e-481f-9fc7-3c02e4366955&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
	// const request = 'grant_type=authorization_code&code=d37cca67-d509-4c04-9df4-49f8c6f0004b&redirect_uri=https%3A%2F%2FACME.example.com%3A7443%2Foauth%2Fv2%2Fclient%2Fauthcode';
	const headers = { 
		'Authorization': 'Basic my-token',
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
module.exports.tokenCallback = tokenCallback

'use strict'

// Install relevant node packages
const axios = require("axios");
// const base64 = require("base64-js");

// Sonos authorization callback
exports.authCallback = (event, context, callback) => {
	const authCode = event.queryStringParameters.code;
	console.log('Event: ', event);
	console.log('Code: ', authCode);

	const message = {'message': 'Auth Code: ' + authCode};

	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
	
	if (authCode) {
		const formBody = 'grant_type=authorization_code&code=' + authCode + '&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
		
		fetch('https://example.com/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg=='
			},
			body: formBody
		}).then(function(res) {
			console.log('Success!  Results: ', res);
		}).else(function(err) {
			error.log('Error: ', err);
		})
		
		/*
		axios.post('https://api.sonos.com/login/v3/oauth/access',
			{grant_type: 'authorization_code',
			 code: authCode,
			 redirect_uri: 'https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Fauth-callback'
			}, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
					'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg=='
				}
			}
		);
	
		/*
		const uriAuth = 'https://api.sonos.com/login/v3/oauth/access';
		// const request = 'grant_type=authorization_code&code=' + authCode + '&redirect_uri=https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Ftoken-callback';
		// console.log('Request: ', request);
		// const request = 'grant_type=authorization_code&code=d37cca67-d509-4c04-9df4-49f8c6f0004b&redirect_uri=https%3A%2F%2FACME.example.com%3A7443%2Foauth%2Fv2%2Fclient%2Fauthcode';
		
		const postData = {
			'grant_type': 'authorization_code',
			'code': authCode,
			'redirect_uri': 'https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Fauth-callback'
		};

		const postHeaders = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg=='
			}
		};

		console.log('Making call to get token, headers:', postHeaders, ', data: ', postData);
		axios.post(uriAuth, postData, postHeaders)
			.then((res) => {
				console.log("Response received: ", res);
		})
		.catch((err) => {
			console.log("Error: ", err);
		})
		*/
	}
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

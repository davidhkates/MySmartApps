'use strict'

// Install relevant node packages
const axios = require("axios");
const qs = require("qs");

// Sonos authorization callback
exports.authCallback = (event, context, callback) => {
	const authCode = event.queryStringParameters.code;
	console.log('Event: ', event);
	console.log('Code: ', authCode);

	const message = {'message': 'Auth Code: ' + authCode};

	/*
	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
	*/
	
	if (authCode) {
		const url = 'https://api.sonos.com/login/v3/oauth/access';

		const params = new URLSearchParams();
		params.append('grant_type', 'authorization_code');
		params.append('code', authCode);
		params.append('redirect_uri', 'https%3A%2F%2F00t156cqe1.execute-api.us-west-2.amazonaws.com%2Fdev%2Fauth-callback');
	
		const config = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				'Authorization': 'Basic ZDMxM2EyYTAtOTYwZS00ODFmLTlmYzctM2MwMmU0MzY2OTU1OjNhY2ZkZmQ5LTI3YzQtNGE3NC05NzhkLWUyN2ZlZmE0NWJkMg=='
			}
		}
		
		axios.post(url, params, config).then((result) => {
			console.log('Success!  Data: ', result.data);
		}).catch((err) => {
			console.log('Error: ', err);
		})		
	}
};


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


// export external modules
// module.exports.authCallback  = authCallback
// module.exports.tokenCallback = tokenCallback

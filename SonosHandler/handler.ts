//---------------------------------------------------------------------------------------
// Sonos Handler - get sonos household device information and keep token refreshed
//---------------------------------------------------------------------------------------
'use strict'

// Install relevant utilities
const SmartState  = require('@katesthings/smartstate');

// Install relevant node packages
const axios = require("axios");
const qs = require("qs");

// Local functions
/*
async function callSonosAPI( token_data, endpoint ) {
	
	const sonosControl = axios.create({
		baseURL: 'https://api.ws.sonos.com/control/api/v1',
		timeout: 1000,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': token_data.token_type + ' ' + token_data.access_token
		}
	});
			
	sonosControl.get(endpoint).then((result) => {
		console.log('callSonosAPI: ', result);
		return result;
	}).catch((err) => {
		console.log('Error: ', err);
	})		
}
*/

async function putSonosData( key, value ) {
	console.log('putSonosData - key: ', key, ', value: ', value);
	await SmartState.putHomeMode('niwot', 'sonos-' + key, value);
}


// Sonos authorization callback
async exports.authCallback = (event, context, callback) => {
	const authCode = event.queryStringParameters.code;
	// console.log('Event: ', event);
	// console.log('Code: ', authCode);

	/*
	const message = {'message': 'Auth Code: ' + authCode};

	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});
	*/
	
	// if (authCode) {
	
		const urlToken = 'https://api.sonos.com/login/v3/oauth/access';

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
		
		axios.post(urlToken, params, config).then((result) => {
			console.log('Success!  Data: ', result.data);
			
			const sonosControl = axios.create({
				baseURL: 'https://api.ws.sonos.com/control/api/v1',
				timeout: 1000,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': result.data.token_type + ' ' + result.data.access_token
				}
			});
			
			// store tokens in DynamoDB home settings file
			const token_data = result.data;
			putSonosData( 'access-token', token_data.access_token );
			putSonosData( 'refresh-token', token_data.refresh_token );

			/*
			const households: any = getSonosData( sonosControl, 'households' );
			const idHousehold = households.data.households[0].id;
			const devices: any = getSonosData( sonosControl, 'households/' + idHousehold + '/groups');

			callback(null, {
				statusCode: 200,
				body: JSON.stringify({'Households': idHousehold}),
				headers: {'Content-Type': 'application/json'}
			});
			*/
			
			/*
			const householdPromise = callSonosAPI( token_data, 'households' );
			console.log('Households: ', householdPromise);
			const householdList = async () => {
				const listValue = await householdPromise;
				console.log('Households: ', listValue);
			};
			*/
			
			sonosControl.get('households').then((result) => {
				const idHousehold = result.data.households[0].id;
				console.log('Households: ', result.data);
				
				
				sonosControl.get('households/' + idHousehold + '/groups').then((result) => {
					console.log('Groups: ', result.data.groups);
					console.log('Stringified: ', JSON.stringify(result.data.groups));
					await putSonosData( 'groups-json', 'test' );
				});

				// callback(null, {body: JSON.stringify({'Households': idHousehold})});
				callback(null, {body: 'Success!  Tokens and groups stored in DynamoDB smartapp-home-settings'});
				/*
				callback(null, {
					statusCode: 200,
					body: JSON.stringify({'Households': idHousehold}),
					headers: {'Content-Type': 'application/json'}
				});
				*/
			})
			
		}).catch((err) => {
			console.log('Error: ', err);
		})		
	// }
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

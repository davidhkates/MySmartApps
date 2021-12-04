'use strict'

exports.authCallback = (event, context, callback) => {
	console.log('Code: ', event.queryStringParameters.code);

	const message = {'message': 'Execution started successfully!'};

	callback(null, {
		statusCode: 200,
		body: JSON.stringify(message),
		headers: {'Content-Type': 'application/json'}
	});	
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

function tokenCallback(callback) {
	console.log('Token made it', callback);
	return "Token made it";
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

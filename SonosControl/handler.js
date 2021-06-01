'use strict'

const callback = (event, context, callback) => {

  var token = event.authorizationToken;
  console.log('Token from Sonos API Oauth callback: ', token);
  console.log('Event: ', event);
  console.log('Context: ', context);

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

module.exports.callback = callback

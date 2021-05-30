'use strict'

const callback = (event, context, callback) => {
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

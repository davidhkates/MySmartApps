'use strict'

exports.handler = (event, context, callback) => {
            // TODO implement

          mqfunc1(func2);

};

var func2 = function(data) {
            console.log('got data: '+data);

};

var mqfunc1 = function(callback) {
        var myCallback = function(data) {
        console.log('got data: '+data);
        };

        var usingItNow = function(callback) {
        callback('get it?');
        };
};

function authCallback(callback) {
	return "Auth made it";
};

function tokenCallback(callback) {
	return "Token made it";
};

// export external modules
module.exports.authCallback  = authCallback
module.exports.tokenCallback = tokenCallback

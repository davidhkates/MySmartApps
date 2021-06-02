const fetch = require('node-fetch');

exports.handler = async (event) => {
  const res = await fetch('https://swapi.co/api/people/1');
  const myApiKey = "12345678";
  const sonosAPI = 'https://api.sonos.com/login/v3/oauth?client_id=' + myApiKey +
    '&response_type=code&state=testState&scope=playback-control-all' +
    '&redirect_uri=https%3A%2F%2Facme.example.com%2Flogin%2Ftestclient%2Fauthorized.html    
  
  const res = await fetch('https://api.sonos.com/login/v3/oauth?client_id=YourAPIKeyGoesHEre&response_type=code&state=testState&scope=playback-control-all&redirect_uri=https%3A%2F%2Facme.example.com%2Flogin%2Ftestclient%2Fauthorized.html'
  const json = await res.json();
  return json;
};

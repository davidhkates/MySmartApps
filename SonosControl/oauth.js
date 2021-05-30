const fetch = require('node-fetch');

exports.handler = async (event) => {
  const res = await fetch('https://swapi.co/api/people/1');
  const json = await res.json();
  return json;
};

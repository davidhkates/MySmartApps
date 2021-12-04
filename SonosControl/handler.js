'use strict'

// Install relevant node packages
const axios = require("axios");
// const simple-oauth2 = require("simple-oauth2");
// const SmartState = require('@katesthings/smartstate');

/*
// Sonos Oauth2 parameters
const oauth2 = simpleOauthModule.create({
	client: {
    		id: process.env.SONOS_CLIENT_ID,
    		secret: process.env.SONOS_CLIENT_SECRET,
	},
	auth: {
		tokenHost: 'https://api.sonos.com',
		tokenPath: '/login/v3/oauth/access',
		authorizePath: '/login/v3/oauth',
  	},
});
 
// Authorization uri definition
const authorizationUri = oauth2.authorizationCode.authorizeURL({
	redirect_uri: 'https://' + process.env.LAMBDA_API_CALLBACK + '.execute-api.us-west-2.amazonaws.com/dev/token-callback',
	scope: 'playback-control-all',
  	state: 'kateshallsonos'
})

// Get our token set up
let token; // This'll hold our token, which we'll use in the Auth header on calls to the Sonos Control API
let authRequired = false; // We'll use this to keep track of when auth is needed (first run, failed refresh, etc) and return that fact to the calling app so it can redirect

// This is a function we run when we first start the app. It gets the token from the local store, or sets authRequired if it's unable to
async function getToken() {
	const currentToken = await storage.getItem('token');
  	if (currentToken === undefined) {
    		authRequired = true;
    		return;
	}
	token = oauth2.accessToken.create(currentToken.token);

	if (token.expired()) {
		try {
			token = await token.refresh();
			await storage.setItem('token',token); // And save it to local storage to capture the new access token and expiry date
		} catch (error) {
			authRequired = true;
			console.log('Error refreshing access token: ', error.message);
		}
	}
}
getToken();
*/

// Initial page redirecting to Sonos
app.get('/auth', async (req, res) => {
	console.log('Request: ', req, ', Response: ', res);
	res.redirect(authorizationUri);
});

// redirect service parsing the authorization token and asking for the access token
app.get('/redirect', async (req, res) => {
	console.log('Request: ', req, ', Response: ', res);
	const code = req.query.code;
	const redirect_uri = 'http://localhost:3001/redirect';

	const options = {
		code,redirect_uri,
	};

	/*
	try {
		const result = await oauth2.authorizationCode.getToken(options);
		console.log('The resulting token: ', result);
		token = oauth2.accessToken.create(result); // Save the token for use in Sonos API calls

		await storage.setItem('token',token); // And save it to local storage for use the next time we start the app
		authRequired = false; // And we're all good now. Don't need auth any more
		res.redirect('http://localhost:3000'); // Head back to the main app
	} catch(error) {
		console.error('Access Token Error', error.message);
		return res.status(500).json('Authentication failed');
	}
	*/
});


/*
// This section services the front end.

// This route handler returns the available households for the authenticated user
app.get('/api/households', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (authRequired) {
    res.send(JSON.stringify({'success':false,authRequired:true}));
    return;
  }
  let hhResult;

  try {
    hhResult = await fetch(`https://api.ws.sonos.com/control/api/v1/households`, {
     method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.token.access_token}` },
    });
  }
  catch (err) {
    res.send(JSON.stringify({'success':false,error: err.stack}));
    return;
  }

// We convert to text rather than JSON here, since, on some errors, the Sonos API returns plain text
  const hhResultText = await hhResult.text();

// Let's try to immediately convert that text to JSON,
  try  {
    const json = JSON.parse(hhResultText);
    if (json.households !== undefined) { // if there's a households object, things went well, and we'll return that array of hhids
      res.send(JSON.stringify({'success': true, 'households':json.households}));
    }
    else {
      res.send(JSON.stringify({'success': false, 'error':json.error}));
    }
  }
  catch (err){
    res.send(JSON.stringify({'success':false, 'error': hhResultText}));
  }
});


// Here we'll get the list of speakers that are capable of playing audioClips
// Note that the AUDIO_CLIP capability flag isn't implemented on the Sonos platform yet, so we have
// to simply return all speakers for right now, and let the user figure out which ones work
app.get('/api/clipCapableSpeakers', async (req, res) => {
  const household = req.query.household;

  res.setHeader('Content-Type', 'application/json');
  if (authRequired) {
    res.send(JSON.stringify({success:false,authRequired:true}));
    return;
  }

  let groupsResult;

  try {
    groupsResult = await fetch(`https://api.ws.sonos.com/control/api/v1/households/${household}/groups`, {
     method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.token.access_token}` },
    });
  }
  catch (err) {
    res.send(JSON.stringify({'success':false,error: err.stack}));
    return;
  }

  const groupsResultText = await groupsResult.text();

  let groups;
  try  {
    groups = JSON.parse(groupsResultText);
    if (groups.groups === undefined) { // If there isn't a groups object, the fetch didn't work, and we'll let the caller know
      res.send(JSON.stringify({'success': false, 'error':groups.error}));
      return;
    }
  }
  catch (err){
    res.send(JSON.stringify({'success':false, 'error': groupsResultText}));
    return;
  }

  const players = groups.players; // Let's get all the clip capable players
  const clipCapablePlayers = [];
  for (let player of players) {
    if (player.capabilities.includes('AUDIO_CLIP')) {
      clipCapablePlayers.push({'id':player.id,'name':player.name});
    }
  }
  res.send(JSON.stringify({'success':true, 'players': clipCapablePlayers}));
});

// This is where we finally speak the text. The URL variables include the playerId and the text to speak
app.get('/api/speakText', async (req, res) => {
  const text = req.query.text;
  const playerId = req.query.playerId;

  const speakTextRes = res;
  speakTextRes.setHeader('Content-Type', 'application/json');
  if (authRequired) {
    res.send(JSON.stringify({'success':false,authRequired:true}));
  }

  if (text == null || playerId == null) { // Return if either is null
    speakTextRes.send(JSON.stringify({'success':false,error: 'Missing Parameters'}));
    return;
  }

  let speechUrl;

  try { // Let's make a call to the google tts api and get the url for our TTS file
    speechUrl = await googleTTS(text, 'en-US', 1);
  }
  catch (err) {
    speakTextRes.send(JSON.stringify({'success':false,error: err.stack}));
    return;
  }

  const body = { streamUrl: speechUrl, name: 'Sonos TTS', appId: 'com.me.sonosspeech' };

  let audioClipRes;

  try { // And call the audioclip API, with the playerId in the url path, and the text in the JSON body
    audioClipRes = await fetch(`https://api.ws.sonos.com/control/api/v1/players/${playerId}/audioClip`, {
     method: 'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.token.access_token}` },
    });
  }
  catch (err) {
    speakTextRes.send(JSON.stringify({'success':false,error: err.stack}));
    return;
  }

  const audioClipResText = await audioClipRes.text(); // Same thing as above: convert to text, since occasionally the Sonos API returns text

  try  {
    const json = JSON.parse(audioClipResText);
    if (json.id !== undefined) {
      speakTextRes.send(JSON.stringify({'success': true}));
    }
    else {
      speakTextRes.send(JSON.stringify({'success': false, 'error':json.errorCode}));
    }
  }
  catch (err){
    speakTextRes.send(JSON.stringify({'success':false, 'error': audioClipResText}));
  }
});

app.listen(3001, () =>
  console.log('Express server is running on localhost:3001')
);
*/

// export external modules
module.exports.authCallback  = authCallback
module.exports.tokenCallback = tokenCallback

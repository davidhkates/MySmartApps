/*
  Various functions to get sensor value
  */

function getTemp( sensor ) {
  
  // const currentTemp =  context.config.tempSensor;

	// Get the current states of the other motion sensors
	const stateRequests = sensor.map(it => context.api.devices.getCapabilityStatus(
		it.deviceConfig.deviceId,
		it.deviceConfig.componentId,
		'temperatureMeasurement'
	));

	const states = await Promise.all(stateRequests);
	console.log('Device State: ', states); 

  return states;
}

exports capabilities.getTemp;

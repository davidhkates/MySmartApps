const SmartApp = require('@smartthings/smartapp');
// const SmartUtils = require('../Utilities/capabilities');
const checkInterval = 60;  // number of seconds between checking fan status

/* Define the SmartApp */
module.exports = new SmartApp()
    .enableEventLogging()  // logs requests and responses as pretty-printed JSON
    .configureI18n()        // auto-create i18n files for localizing config pages

    // Configuration page definition
    .page('mainPage', (context, page, configData) => {

        // get controls and sensors
        page.section('controls', section => {
            section
                .deviceSetting('fanSwitch')
                .capabilities(['switch'])
                .required(true)
                .multiple(false)
                .permissions('rx');           
	    section
                .numberSetting('tempTarget')
                .required(true);
            section
                .deviceSetting('tempSensor')
                .capabilities(['temperatureMeasurement'])
                .required(true);		
            section
                .deviceSetting('contact')
                .capabilities(['contactSensor'])
                .required(false)
                .multiple(true);
        });
        
        // get start and end time
        page.section('time', section => {
            section
                .timeSetting('startTime')
                .required(false);
            section
                .timeSetting('endTime')
                .required(false);
	    section
		.booleanSetting('fanEnabled')
		.required('false')
        });
    })

    // Handler called whenever app is installed or updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is
    // no separate installed() handler
    .updated(async (context, updateData) => {
	console.log("FanControl: Installed/Updated");
	
	const fanEnabled = context.configBooleanValue('fanEnabled');
	console.log('Fan enabled value: ', fanEnabled);
        
    	// unsubscribe all previously established subscriptions
	await context.api.subscriptions.unsubscribeAll();

        // Schedule temperature check in specified time (in seconds)
        await context.api.schedules.runIn('checkTemperature', checkInterval);
	
        console.log('Motion Group: END CREATING SUBSCRIPTIONS')
    })

    
    // Check temperature and turn on/off fan as appropriate
    .scheduledEventHandler('checkTemperature', async (context, event) => {
	// compare current temperature to target temperate
	// console.log("Context: ", context);

	// console.log("Control: ", context.config.tempSensor);	
	const sensorTemp =  context.config.tempSensor;

	// Get the current states of the other motion sensors
	const stateRequests = sensorTemp.map(it => context.api.devices.getCapabilityStatus(
		it.deviceConfig.deviceId,
		it.deviceConfig.componentId,
		'temperatureMeasurement'
	));
	console.log("State Requests Map: ", stateRequests);
	
	// Quit if there are other sensor still active
	const states = await Promise.all(stateRequests);
	const currentTemp = states[0].temperature.value;
	const targetTemp = context.configNumberValue('tempTarget');
	const fanEnabled = context.configBooleanValue('fanEnabled');

	console.log('Current temp: ', currentTemp, ', target temp: ', targetTemp, ', variance: ', currentTemp-targetTemp);
	console.log('Fan enabled: ', fanEnabled);

	if ((currentTemp>targetTemp) && fanEnabled) {
		console.log('Trying to turn ON fan');
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'on')
	} else {
		console.log('Trying to turn OFF fan');
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off')
	}
	
	// call next temperature check
        console.log('Recursive call to check interval again');
	await context.api.schedules.runIn('checkTemperature', checkInterval);	
		
    });

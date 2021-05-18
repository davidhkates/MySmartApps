const SmartApp = require('@smartthings/smartapp');
// const SmartUtils = require('../Utilities/capabilities');
// const defaultInterval = 300;  // number of seconds between checking fan status

/* Define the SmartApp */
module.exports = new SmartApp()
	.enableEventLogging()  // logs requests and responses as pretty-printed JSON
	.configureI18n()        // auto-create i18n files for localizing config pages

	// Configuration page definition
	.page('mainPage', (context, page, configData) => {

		// operating switch and interval for checking temperature
		page.section('parameters', section => {
			section
				.booleanSetting('fanEnabled')
				.required('false');
			section
				.numberSetting('tempTarget')
				.required(true);
			section
				.numberSetting('checkInterval')
				.defaultValue(300)
				.required(false)
		});
		
		// get controls and sensors
		page.section('controls', section => {
			section
				.deviceSetting('fanSwitch')
				.capabilities(['switch'])
				.required(true)
				.multiple(false)
				.permissions('rx');
			section
				.deviceSetting('tempSensor')
				.capabilities(['temperatureMeasurement'])
				.required(true);		
			section
				.deviceSetting('contact')
				.capabilities(['contactSensor'])
				.required(false)
				.multiple(true)
		});

		// get start and end time
		page.section('time', section => {
			section
				.timeSetting('startTime')
				.required(false);
			section
				.timeSetting('endTime')
				.required(false)
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

		// Schedule fan start time, if specifies; else begin temperature check at specified interval (in seconds)
		const startTime = context.configStringValue("startTime");
		const endTime   = context.configStringValue("endTime");
		const currentTime = new Date();
		console.log("Start time: ", startTime, ", end time: ", endTime, ", current time: ", currentTime);
		if (startTime) {
			context.schedules.runDaily(startTime, 'checkTemperature')
			if (endTime) {
				context.schedules.runDaily('fanStopHandler', endTime)
			}
		} else {
			const checkInterval = context.configNumberValue("checkInterval");
			await context.api.schedules.runIn('checkTemperature', checkInterval);
		}
		console.log('Motion Group: END CREATING SUBSCRIPTIONS')
	})


	// Handle end time if specified
	.scheduledEventHandler('fanStopHandler', async(context, event) => {
		// turn off fan
		await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off');
		// cancel any upcoming temperature check calls
		await context.api.schedules.delete('checkTemperature');
	})

    
	// Check temperature and turn on/off fan as appropriate
	.scheduledEventHandler('checkTemperature', async (context, event) => {
	
		// determine if fan is enabled and within time window
		const fanEnabled = context.configBooleanValue('fanEnabled');
		console.log('Fan enabled: ', fanEnabled);
		if ( fanEnabled ) {
	
			// compare current temperature to target temperate
			const sensorTemp =  context.config.tempSensor;

			// Get the the current temperature
			const stateRequests = sensorTemp.map(it => context.api.devices.getCapabilityStatus(
				it.deviceConfig.deviceId,
				it.deviceConfig.componentId,
				'temperatureMeasurement'
			));
			const states = await Promise.all(stateRequests);
	
			const currentTemp = states[0].temperature.value;
			const targetTemp = context.configNumberValue('tempTarget');
			console.log('Current temp: ', currentTemp, ', target temp: ', targetTemp, ', variance: ', currentTemp-targetTemp);

			if (currentTemp>targetTemp) {
				console.log('Trying to turn ON fan');
				await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'on')
			} else {
				console.log('Trying to turn OFF fan');
				await context.api.devices.sendCommands(context.config.fanSwitch, 'switch', 'off')
			}
	
			// call next temperature check after interval (in seconds) until end time (if specified)
        		console.log('Recursive call to check interval again");
			const checkInterval = context.configNumberValue("checkInterval");
			await context.api.schedules.runIn('checkTemperature', checkInterval);	
		}	
	});

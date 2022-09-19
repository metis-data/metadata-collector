/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
const process = require('process');
const { client, v1 } = require('@datadog/datadog-api-client');

const { DATADOG_API_KEY, DATADOG_APP_KEY } = process.env;
const configuration = client.createConfiguration({
  authMethods: { apiKeyAuth: DATADOG_API_KEY, appKeyAuth: DATADOG_APP_KEY, baseServer: 'datadoghq.com' },
});
const apiInstance = new v1.MonitorsApi(configuration);

// Examples:
createLogMonitor('abcd', (monitorID) => { console.log(monitorID); });
deleteMonitor(87021762);

/*
 * Code to create a new log monitor.
 * The second parameter is a callback that is called for saving the monitor ID.
 * The alerts are connected to the alerts slack channel.
 */
function createLogMonitor(apiKey, processCreatedDatadogMonitorID) {
  const monitorJSON = {
    name: `Log guard for ${apiKey}`,
    type: 'log alert',
    query: `logs("host:${apiKey}").index("*").rollup("count").last("5h") < 1`,
    message: `{{#is_alert}}${apiKey} seems to be not active (no logs for 5 hours)\n@slack-Metis-alerts \n{{/is_alert}}`,
    tags: [],
    options: {
      thresholds: {
        critical: 1,
        period: {
          name: '5 hour average',
          value: 'last_5h',
          text: '5 hours',
          no_data_timeframe: 600,
          seconds: 18000,
          digit: 5,
          unit: 'hours',
          tense: 'last',
          timeString: '5h',
          unitAbbreviation: 'h',
        },
        timeAggregator: 'avg',
        comparison: '>',
      },
      enable_logs_sample: false,
      notify_audit: false,
      restriction_query: null,
      on_missing_data: 'default',
    },
  };

  const params = {
    body: monitorJSON,
  };

  apiInstance.createMonitor(params).then((data) => {
    console.log(`API called successfully. Returned data: ${JSON.stringify(data)}`);
    processCreatedDatadogMonitorID(data.id);
  }).catch((error) => console.error(error));
}

/*
 * Code to delete a monitor. E.g., dataDoogAlertID = 87021762.
 */
function deleteMonitor(datadogMonitorID) {
  apiInstance.deleteMonitor({ monitorId: datadogMonitorID }).then((data) => {
    console.log(`API called successfully. Returned data: ${JSON.stringify(data)}`);
  }).catch((error) => console.error(error));
}

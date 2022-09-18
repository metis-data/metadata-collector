/**
 * Installation:
 *
 * npm install @datadog/datadog-api-client
 *
 * Usage: node get_user_logs.js
 *
 */
/* eslint-disable no-console */

const { client, v2 } = require('@datadog/datadog-api-client');

const configuration = client.createConfiguration({ authMethods: { apiKeyAuth: 'd28ebbe2a8ed81f30663e6c5711a70e5', appKeyAuth: '0f67fdaaa099cde9a86df3745b3bf50bf33f04a5', baseServer: 'datadoghq.com' } });
const apiInstance = new v2.LogsApi(configuration);

async function getDatadogLogs(apiKey, startTimeString, endTimeString) {
  const params = {
    body: {
      filter: {
        query: `@host:${apiKey}`,
        from: startTimeString,
        to: endTimeString,
      },
      sort: '-timestamp',
      page: {
        limit: 100,
      },
    },
  };

  try {
    let logs = [];
    let response = await apiInstance.listLogs(params);
    while (response.data.length) {
      logs = logs.concat(response.data);
      params.body.page.cursor = response.meta.page.after;
      // eslint-disable-next-line no-await-in-loop
      response = await apiInstance.listLogs(params);
    }
    return logs;
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Examples:
getDatadogLogs('Q2ZSZjyCBp3M2VQ5QkpLH1iRiQt867Jm9FBbubSr', '2022-09-11T13:00:00+03:00', '2023-09-17T12:48:36+03:00')
  .then((logs) => { console.log(logs); });

// Or:
const day = new Date();
const previousDay = new Date(day);
previousDay.setDate(day.getDate() - 1);
getDatadogLogs('Q2ZSZjyCBp3M2VQ5QkpLH1iRiQt867Jm9FBbubSr', previousDay.getTime().toString(), day.getTime().toString())
  .then((logs) => { console.log(logs); });

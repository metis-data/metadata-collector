const { randomUUID } = require('crypto');
const { makeInternalHttpRequest } = require('./http');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

// databaseConnection: PostgresDatabase 
async function processRows(databaseConnection: any, rows: any, timestamp: any, fake: any) {
  const metricsData: any= [];
  rows.forEach((row: any) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r: any = {};
      r.id = randomUUID();
      r.timestamp = timestamp;
      r.metricName = valueName;
      r.value = parseFloat(row[valueName]);
      if (fake) {
        const isInt = Number.isInteger(r.value);
        r.value *= 0.6 * Math.random() + 0.7;
        if (isInt) {
          r.value = Math.round(r.value);
        }
      }
      TAGS.forEach((tag: any) => { if (row[tag]) r[tag] = row[tag]; });
      r.db = databaseConnection.database;
      r.host = databaseConnection.host;
      r.version = COLLECTOR_VERSION;
      metricsData.push(r);
    });
  });
  return await makeInternalHttpRequest(metricsData, HTTPS_REQUEST_OPTIONS);
}

async function processResults(connection: any, results: any, timestamp: any, fake: any) {
  return await Promise.all(results.map(async (result: any) => await processRows(connection, result.rows, timestamp, fake)))
}

export  {
  processResults,
};

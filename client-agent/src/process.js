const { randomUUID } = require('crypto');
const { makeInternalHttpRequest } = require('./http');
const { createSubLogger } = require('./logging');
const logger = createSubLogger('process_queries');
const connectionMetricInit = require('./metrics/connections_metric');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

async function processRows(dbConfig, rows, timestamp, fake) {
  const metricsData = [];
  rows.forEach((row) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r = {};
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
      TAGS.forEach((tag) => { if (row[tag]) r[tag] = row[tag]; });
      r.db = dbConfig.database;
      r.host = dbConfig.host;
      r.version = COLLECTOR_VERSION;
      metricsData.push(r);
    });
  });
  const res = await makeInternalHttpRequest(metricsData, HTTPS_REQUEST_OPTIONS);
  logger.info(`Sent query results for ${dbConfig.host}`, { res });
  return res;
}

async function processResults(dbConfig, results, timestamp, fake) {
  await Promise.all(
    [connectionMetricInit(dbConfig), ...results.map(async (result) => await processRows(dbConfig, result.rows, timestamp, fake))]
  )
}

module.exports = {
  processResults,
};

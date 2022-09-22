const { randomUUID } = require('crypto');

const { logger } = require('./logging');
const { directHttpsSend } = require('./http');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

async function processRows(dbConfig, rows, timestamp) {
  const metricsData = [];
  const now = Date.now().toString();
  rows.forEach((row) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r = {};
      r.id = randomUUID();
      r.timestamp = timestamp.toString();
      r.metricName = valueName;
      r.value = parseFloat(row[valueName]);
      TAGS.forEach((tag) => { if (row[tag]) r[tag] = row[tag]; });
      r.db = dbConfig.database;
      r.host = dbConfig.host;
      r.version = COLLECTOR_VERSION;
      metricsData.push(r);
    });
  });
  await directHttpsSend(metricsData, HTTPS_REQUEST_OPTIONS);
  logger.info('Sent query results.');
  logger.debug(`Metrics data is ${JSON.stringify(metricsData)}`);
}

async function processResults(dbConfig, results, timestamp) {
  await Promise.all(
    results.map(async (result) => { await processRows(dbConfig, result.rows, timestamp); }),
  );
}

module.exports = {
  processResults,
};

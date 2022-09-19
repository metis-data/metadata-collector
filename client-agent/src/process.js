const { randomUUID } = require('crypto');

const { logger } = require('./logging');
const { directHttpsSend } = require('./http');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

async function processRows(dbConfig, rows) {
  const metricsData = [];
  const now = Date.now().toString();
  rows.forEach((row) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r = {};
      r.id = randomUUID();
      r.timestamp = now;
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

async function processResults(queries, dbConfig, results) {
  if (queries.length === 0 || !results) {
    logger.info(queries.length === 0 ? 'No queries are scheduled for this hour.' : 'Queries returned no results');
    return;
  }
  if (queries.length === 1) {
    await processRows(dbConfig, results.rows);
    return;
  }
  await Promise.all(
    results.map(async (r) => { await processRows(dbConfig, r.rows); }),
  );
}

module.exports.processResults = processResults;

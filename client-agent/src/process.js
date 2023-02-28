const { randomUUID } = require('crypto');
const { makeInternalHttpRequest } = require('./http');
const { createSubLogger } = require('./logging');
const logger = createSubLogger('process_queries');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

const IGNORE_PROPS = ['name', 'last', ...TAGS];

async function processRows(dbConfig, rows, timestamp, fake) {
  const metricsData = [];

  rows.forEach((row) => {
    const columnsName = Object.keys(row);
    const metricColumn = columnsName.filter(
      (propName) => !IGNORE_PROPS.some(ignored_column => propName.includes(ignored_column))
    );

    metricColumn.forEach((propName) => {
      const r = {};
      r.id = randomUUID();
      r.timestamp = timestamp;
      r.metricName = propName;
      r.value = parseFloat(row[propName]);
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
  logger.info('Sent query results.', { res });
  logger.debug(`Metrics data is ${JSON.stringify(metricsData)}`);
  return res;
}

async function processResults(dbConfig, results, timestamp, fake) {
  await Promise.all(
    results.map(async (result) => await processRows(dbConfig, result.rows, timestamp, fake)));
}

module.exports = {
  processResults,
};

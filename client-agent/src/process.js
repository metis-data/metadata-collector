const { randomUUID } = require('crypto');

const { logger } = require('./logging');
const { directHttpsSend } = require('./http');
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');
const { isError } = require('./utilities/http-util');

async function processRows(dbConfig, rows, timestamp, fake) {
  try {
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
    logger.debug(`${HTTPS_REQUEST_OPTIONS.method}ing ${metricsData.length} records to: `, HTTPS_REQUEST_OPTIONS);
    return directHttpsSend(metricsData, HTTPS_REQUEST_OPTIONS);
  }
  catch (error) {
    logger.error("processRows throw an error", {error});
  }
}

async function processResults(dbConfig, results, timestamp, fake) {
  try {
    const data = results
      .filter(el => el?.rows?.length > 0)
      .map((result) => processRows(dbConfig, result.rows, timestamp, fake))
    const res = await Promise.allSettled(data);
    res.map(el => {
      const {reason} = el.reason;
      const statusCode = reason?.statusCode;
      const httpRequestOptions = reason?.httpRequestOptions;
      const error = el.status === 'rejected' || isError(statusCode);

      if (error) {
        logger.error("processResults throw an error", { success: false, httpRequestOptions, ...(reason || {}) });
      }
      else {
        logger.debug("Finished to processResults", { success: true, httpRequestOptions });
      }
    });
    return;
  }
  catch (e) {
    logger.error("processResults throw an error", e);
  }
}

module.exports = {
  processResults,
};

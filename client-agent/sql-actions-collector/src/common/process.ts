//need to replace that shit to uuid npm package
import { randomUUID } from 'crypto';
import { logger } from './logging';
import directHttpsSend from './http';
const { COLLECTOR_VERSION, TAGS, HTTPS_REQUEST_OPTIONS } = require('./consts');

const processRows = async (dbConfig, rows, timestamp, fake) => {
  try {
    const metricsData = [];
    rows.forEach((row) => {
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
        TAGS.forEach((tag) => {
          if (row[tag]) r[tag] = row[tag];
        });
        r.db = dbConfig.database;
        r.host = dbConfig.host;
        r.version = COLLECTOR_VERSION;
        metricsData.push(r);
      });
    });
    await directHttpsSend(metricsData, HTTPS_REQUEST_OPTIONS);
    logger.info('Sent query results.');
    // logger.debug(`Metrics data is ${JSON.stringify(metricsData)}`);
  } catch (error) {
    console.log(error);
  }
};

const processResults = async (dbConfig, results, timestamp, fake) => {
  await Promise.all(
    results.map(async (result) => {
      await processRows(dbConfig, result.rows, timestamp, fake);
    })
  );
};

export { processResults };

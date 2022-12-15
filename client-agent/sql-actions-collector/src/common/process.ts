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
      valueNames.forEach((valueName: string) => {
        let metricValue;
        let tagValue;
        metricValue = parseFloat(row[valueName]);
        if (fake) {
          const isInt = Number.isInteger(metricValue);
          metricValue *= 0.6 * Math.random() + 0.7;
          if (isInt) {
            metricValue = Math.round(metricValue);
          }
        }
        TAGS.forEach((tag) => {
          if (row[tag]) {
            tagValue = row[tag];
          }
        });
        metricsData.push({
          id: randomUUID(),
          timestamp: timestamp,
          metricName: valueName,
          value: metricValue,
          tag: tagValue,
          db: dbConfig.database,
          host: dbConfig.host,
          version: COLLECTOR_VERSION,
        });
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

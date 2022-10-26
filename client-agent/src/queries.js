const fs = require('fs');
const process = require('process');
const pg = require('pg');
const yaml = require('js-yaml');

const { logger } = require('./logging');
const { processResults } = require('./process');
const { relevant } = require('./utils');
const { QUERIES_FILE } = require('./consts');

const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES = yaml.load(queriesFileContents);
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

function getQueries(fakeHoursDelta) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.keys(QUERIES)
      .filter((key) => relevant(QUERIES[key].times_a_day, currentHour, currentMinutes))
      .map((key) => QUERIES[key]);
  }
  const qs = [];
  process.argv.slice(2).forEach((q) => { if (q in QUERIES) { qs.push(QUERIES[q]); } });
  if (qs.length < process.argv.length - 2) {
    const nonEligableQueries = process.argv.slice(2).filter((q) => !(q in QUERIES));
    throw Error(`Error running the CLI. The following are not eligible queries: ${nonEligableQueries}`);
  }
  return qs;
}

const results = {};

async function collectQueries(fakeHoursDelta, dbConfigs) {
  if (dbConfigs.length === 0) {
    logger.error('No connection strings could be parsed');
    return;
  }
  const theQueries = getQueries(fakeHoursDelta);
  if (theQueries.length === 0) {
    logger.info('There are no queries to run for this hour.');
    return;
  }
  const bigQuery = theQueries.map((q) => q.query).join('; ');
  await Promise.allSettled(
    dbConfigs.map(
      async (dbConfig) => {
        let client = null;
        try {
          const dbConfigKey = JSON.stringify(dbConfig) + bigQuery;
          if (!(dbConfigKey in results)) {
            client = new pg.Client(dbConfig);
            logger.info(`Trying to connect to ${dbConfig.database} ...`);
            await client.connect();
            logger.info(`Connected to ${dbConfig.database}`);
            const res = await client.query(bigQuery);
            logger.info('Obtained query results. Processing results ...');
            results[dbConfigKey] = theQueries.length === 1 ? [res] : res;
          }
          const now = new Date();
          now.setHours(now.getHours() - fakeHoursDelta);
          await processResults(dbConfig, results[dbConfigKey], now.getTime(), fakeHoursDelta !== 0);
          logger.info('Processing results done.');
        } catch (err) {
          logger.error(err.message, false, err.context);
        } finally {
          if (client) {
            client.end();
          }
        }
      },
    ),
  ).then((returnedResults) => {
    const allOK = returnedResults.every((result) => result.status === 'fulfilled');
    if (!allOK) {
      logger.error(`Some of the DBs did not get back fine. dbConfigs is: ${dbConfigs} and the results are ${returnedResults}`);
    }
  }).catch((err) => {
    logger.err(`Error "${err}" catched in collect.`);
  });
  logger.info('Collection is done.');
}

module.exports = {
  collectQueries,
};

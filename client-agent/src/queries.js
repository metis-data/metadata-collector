const fs = require('fs');
const process = require('process');
const pg = require('pg');
const yaml = require('js-yaml');

const { createSubLogger } = require('./logging');
const logger = createSubLogger('queries');
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

async function collectQueries(fakeHoursDelta, connections) {
  const theQueries = getQueries(fakeHoursDelta);
  if (theQueries.length === 0) {
    logger.info('There are no queries to run for this hour.');
    return;
  }
  const bigQuery = theQueries.map((q) => q.query).join('; ');
  return await Promise.allSettled(
    connections.map(
      // PostgresDatabase class
      async (connection) => {
        try {
          const dbConfigKey = JSON.stringify(connection.dbConfig);
          if (!(dbConfigKey in results)) {
            for await (const client of connection.clientGenerator()) {
              const res = await client.query(bigQuery);
              results[dbConfigKey] = theQueries.length === 1 ? [res] : res;
              const now = new Date();
              now.setHours(now.getHours() - fakeHoursDelta);
              const response = await processResults(connection, results[dbConfigKey], now.getTime(), fakeHoursDelta !== 0);
              logger.info('Processing results done.', {response, dbConfig: connection.dbConfig});
            }
          }
        } catch (error) {
          const { password, ...dbDetails }= connections;
          logger.error('Couldn\'t run queries', error, dbDetails);
          throw error;
        }
      },
    ),
  );

  logger.info('Collection is done.');
}

module.exports = {
  collectQueries,
};

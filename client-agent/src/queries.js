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

function getQueries(runAll = false) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (runAll) {
    return Object.values(QUERIES);
  }

  return Object.keys(QUERIES)
    .filter((key) => relevant(QUERIES[key].times_a_day, currentMinutes))
    .map((key) => QUERIES[key]);
}

const results = {};

async function collectQueries(runAll, connections) {
  const theQueries = getQueries(runAll);
  if (theQueries.length === 0) {
    logger.info('There are no queries to run for this hour.');
    return;
  }
  const bigQuery = theQueries.map((q) => q.query).join('; ');
  const responses = await Promise.allSettled(
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
              const response = await processResults(
                connection,
                results[dbConfigKey],
                now.getTime(),
              );
              logger.info('Processing results done.', { response, dbConfig: connection.dbConfig });
              return response;
            }
          }
        } catch (error) {
          const { password, ...dbDetails } = connections;
          logger.error("Couldn't run queries", error, dbDetails);
          throw error;
        }
      },
    ),
  );

  logger.info('Collection is done.');

  return responses
    .map((responsePromise) => (responsePromise.status === 'fulfilled' ? responsePromise.value : []))
    ?.flat(Infinity);
}

module.exports = {
  collectQueries,
};

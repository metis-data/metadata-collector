import fs = require('fs');
import process = require('process');
import yaml = require('js-yaml');

import { createSubLogger } from './logging';
const logger = createSubLogger('queries');
import { processResults } from './process';
import { relevant } from './utils';
import { QUERIES_FILE } from './consts';

const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES: any = yaml.load(queriesFileContents);
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

function getQueries(fakeHoursDelta: any) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.keys(QUERIES)
      .filter((key) => relevant(QUERIES[key].times_a_day, currentHour, currentMinutes))
      .map((key) => QUERIES[key]);
  }
  const qs: any = [];
  process.argv.slice(2).forEach((q: any) => {
    if (q in QUERIES) {
      qs.push(QUERIES[q]);
    }
  });
  if (qs.length < process.argv.length - 2) {
    const nonEligableQueries = process.argv.slice(2).filter((q: any) => !(q in QUERIES));
    throw Error(
      `Error running the CLI. The following are not eligible queries: ${nonEligableQueries}`,
    );
  }
  logger.info(qs)
  return qs;
}

const results: any = {};

async function collectQueries(fakeHoursDelta: any, connections: any) {
  const theQueries = getQueries(fakeHoursDelta);
  if (theQueries.length === 0) {
    logger.info('There are no queries to run for this hour.');
    return;
  }
  const bigQuery = theQueries.map((q: any) => q.query).join('; ');
  const responses = await Promise.allSettled(
    connections.map(
      // PostgresDatabase class
      async (connection: any) => {
        try {
          const dbConfigKey = JSON.stringify(connection.dbConfig);
          if (!(dbConfigKey in results)) {
            for await (const client of connection.clientGenerator()) {
              const res = await client.query(bigQuery);
              results[dbConfigKey] = theQueries.length === 1 ? [res] : res;
              const now = new Date();
              now.setHours(now.getHours() - fakeHoursDelta);
              const response = await processResults(
                connection,
                results[dbConfigKey],
                now.getTime(),
                fakeHoursDelta !== 0,
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

export default {
  collectQueries,
};
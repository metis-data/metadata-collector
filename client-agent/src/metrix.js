const process = require('process');
const connectionParser = require('connection-string-parser');

require('dotenv').config();

const { setup } = require('./setup');
const { logger } = require('./logging');
const { getConnectionStrings } = require('./secret');
const { collectActions } = require('./actions');
const { collectQueries } = require('./queries');

const DB_CONNECT_TIMEOUT = 5000;
let DB_CONNECTION_STRINGS = null;

// eslint-disable-next-line max-len
const collectRunner = (fakeHoursDelta, dbConfigs) => (collectFn) => collectFn(fakeHoursDelta, dbConfigs)
  .catch((e) => logger.error('Couldn\'t run collect runner.', e));

async function getDBConfigs() {
  const connectionStringParser = new connectionParser.ConnectionStringParser({
    scheme: 'postgresql',
    hosts: [],
  });

  return DB_CONNECTION_STRINGS.split(';')
    .filter(Boolean)
    .map((dbConnectionString) => {
      const dbConnectionObject = connectionStringParser.parse(dbConnectionString);
      const condition = dbConnectionObject
        && dbConnectionObject.hosts && dbConnectionObject.hosts[0];
      const host = condition ? dbConnectionObject.hosts[0].host : undefined;
      const port = condition ? dbConnectionObject.hosts[0].port : undefined;
      return {
        user: dbConnectionObject.username || dbConnectionObject.options.user,
        password: dbConnectionObject.password || dbConnectionObject.options.password,
        database: dbConnectionObject.endpoint,
        host,
        port: port || 5432,
        connectionTimeoutMillis: DB_CONNECT_TIMEOUT,
      };
    });
}

async function run(fakeHoursDelta = 0) {
  try {
    DB_CONNECTION_STRINGS = await getConnectionStrings();
  } catch (err) {
    logger.error('No connection strings found. Exiting...', err);
    process.exit(1);
  }
  const dbConfigs = await getDBConfigs();

  // eslint-disable-next-line max-len
  const collectingActionPromises = [collectQueries, collectActions].map(collectRunner(fakeHoursDelta, dbConfigs));
  await Promise.all(collectingActionPromises);
}

module.exports.run = run;

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

async function getDBConfigs() {
  const connectionStringParser = new connectionParser.ConnectionStringParser({
    scheme: 'postgresql',
    hosts: [],
  });
  const configs = DB_CONNECTION_STRINGS.split(';').filter(Boolean).map((dbConnectionString) => {
    const dbConnectionObject = connectionStringParser.parse(dbConnectionString);
    const condition = dbConnectionObject && dbConnectionObject.hosts && dbConnectionObject.hosts[0];
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
  return configs;
}

async function run(fakeHoursDelta = 0, runSetup = true) {
  const ok = !runSetup || await setup();
  if (!ok) {
    return;
  }

  try {
    DB_CONNECTION_STRINGS = await getConnectionStrings();
  } catch (err) {
    logger.error('No connection strings found. Exiting...');
    process.exit(1);
  }
  const dbConfigs = await getDBConfigs();

  await collectQueries(fakeHoursDelta, dbConfigs);
  await collectActions(fakeHoursDelta, dbConfigs);
}

run().then(() => {}).catch((err) => { logger.error(err.message); });

module.exports.run = run;

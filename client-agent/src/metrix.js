const process = require('process');
const connectionParser = require('connection-string-parser');
const { makeInternalHttpRequest } = require('./http');
const { WEB_APP_REQUEST_OPTIONS } = require('./consts');

require('dotenv').config();

const { setup } = require('./setup');
const { logger } = require('./logging');
const { getConnectionStrings } = require('./secret');
const { collectActions } = require('./actions');
const { collectQueries } = require('./queries');

const DB_CONNECT_TIMEOUT = 5000;
let DB_CONNECTION_STRINGS = null;

// eslint-disable-next-line max-len
const collectRunner = (fakeHoursDelta, dbConfigs) => {
  return (collectFn) => {
    return collectFn(fakeHoursDelta, dbConfigs).catch((e) => logger.error("Couldn't run collect runner.", e));
  }
}

async function getDBConfigs() {
  const connectionStringParser = new connectionParser.ConnectionStringParser({
    scheme: 'postgresql',
    hosts: [],
  });

  return DB_CONNECTION_STRINGS.split(';')
    .filter(Boolean)
    .map((dbConnectionString) => {
      const dbConnectionObject = connectionStringParser.parse(dbConnectionString);
      const condition = dbConnectionObject && dbConnectionObject.hosts && dbConnectionObject.hosts[0];
      const host = condition ? dbConnectionObject.hosts[0].host : undefined;

      let port;
      try {
        port = condition ? Number.parseInt(dbConnectionObject.hosts[0].port) : undefined;
      } catch (error) {
        port = 5432;
      }

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

  const pmcPingResult = await Promise.allSettled(
    dbConfigs.map(({ database: db_name, host: db_host, port }) => makeInternalHttpRequest(
      {
        db_name,
        db_host,
        port: port.toString(),
        rdbms: 'postgres',
      },
      { ...WEB_APP_REQUEST_OPTIONS, path: '/api/pmc-device' },
    )),
  );

  logger.info('PMC Ping result', { pmcPingResult });
  // eslint-disable-next-line max-len
  const collectingActionPromises = [collectQueries, collectActions].map(
    collectRunner(fakeHoursDelta, dbConfigs),
  );
  
  await Promise.allSettled(collectingActionPromises);
}

module.exports.run = run;

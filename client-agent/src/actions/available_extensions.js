const pg = require('pg');
const { logger } = require('../logging');
const { makeHttpRequest } = require('../http');

const action = async (dbConfig) => {
  let client;
  try {
    client = new pg.Client(dbConfig);
    logger.info(`Trying to connect to ${dbConfig.database} ...`);
    await client.connect();
    logger.info(`Connected to ${dbConfig.database}`);
    const query = `SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
ORDER BY name`;
    const { rows } = await client.query(query);
    return rows;
  }
  finally {
    try {
      await client.end();
      logger.info('connection has been closed.');
    } catch (e) {
      logger.error('connection could not be closed: ', e);
    }
  }
};

const sendResults = async ({ payload, options }) => {
  const data = {
    extensions: payload.data,
    pmcDevice: {
      rdbms: payload.pmcDevice.rdbms,
      db_host: payload.pmcDevice.dbHost,
      db_name: payload.pmcDevice.dbName,
      port: payload.pmcDevice.dbPort,
    }
  };

  return makeHttpRequest(data, options, 0)
};

module.exports = {
  availableExtensions: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

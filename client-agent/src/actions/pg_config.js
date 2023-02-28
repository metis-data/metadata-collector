const pg = require('pg');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

const action = async (dbConfig) => {
  let client;
  try {
    client = new pg.Client(dbConfig);
    logger.info(`Trying to connect to ${dbConfig.database} ...`);
    await client.connect();
    logger.info(`Connected to ${dbConfig.database}`);
    const query = `show all`;
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

const sendResults = async ({ payload, options }) => makeInternalHttpRequest(payload, options, 0);

module.exports = {
  pgConfig: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

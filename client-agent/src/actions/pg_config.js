const pg = require('pg');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

const action = async ({dbConfig, client}) => {
  const query = `show all`;
  const { rows } = await client.query(query);
  return rows; 
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

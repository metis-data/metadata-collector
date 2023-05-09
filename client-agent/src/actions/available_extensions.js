const pg = require('pg');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

const action = async ({ dbConfig, client }) => {
  const query = `SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
ORDER BY name`;
  const { rows } = await client.query(query);
  return rows;
};

const sendResults = async ({ payload, options }) => makeInternalHttpRequest(payload, options, 0);

module.exports = {
  availableExtensions: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

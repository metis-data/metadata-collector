const { dbDetailsFactory } = require('@metis-data/db-details');
const { makeHttpRequest } = require('../http');

const action = async (dbConfig) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  return schemaDetailsObject.getDbDetails(dbConfig);
};

const sendResults = async ({ payload, options }) => makeHttpRequest([payload], options, 0);

module.exports = {
  schemaAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

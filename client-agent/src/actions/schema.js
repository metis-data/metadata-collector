const { dbDetailsFactory } = require('@metis-data/db-details');
const { makeInternalHttpRequest } = require('../http');

const action = async (dbConfig) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  return schemaDetailsObject.getDbDetails(dbConfig);
};

const sendResults = async ({ payload, options }) => makeInternalHttpRequest(payload, options, 0);

module.exports = {
  schemaAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

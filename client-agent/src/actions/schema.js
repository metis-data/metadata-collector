const { dbDetailsFactory } = require('@metis-data/db-details');
const { makeInternalHttpRequest } = require('../http');

const action = async ({dbConfig: _, client}) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  return  await schemaDetailsObject.getDbDetails(client);
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

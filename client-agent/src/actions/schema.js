const { dbDetailsFactory } = require('@metis-data/db-details');
const { makeInternalHttpRequest } = require('../http');

const action = async ({dbConfig: _, client}) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  const res =  await schemaDetailsObject.getDbDetails(client);
  return res;
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

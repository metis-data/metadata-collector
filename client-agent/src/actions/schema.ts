const { dbDetailsFactory } = require('@metis-data/db-details');
const { makeInternalHttpRequest } = require('../http');

const action = async ({dbConfig: _, client}: any) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  return schemaDetailsObject.getDbDetails(client);
};

const sendResults = async ({ payload, options }: any) => makeInternalHttpRequest(payload, options, 0);

export default {
  schemaAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

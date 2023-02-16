const { dbDetailsFactory } = require('@metis-data/db-details');
const { directHttpsSend } = require('../http');

const action = async (dbConfig) => {
  const schemaDetailsObject = dbDetailsFactory('postgres');
  return schemaDetailsObject.getDbDetails(dbConfig);
};

const sendResults = async ({ payload, options }) => directHttpsSend(payload, options, 0);

module.exports = {
  schemaAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

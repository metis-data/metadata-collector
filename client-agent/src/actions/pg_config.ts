const pg = require('pg');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

const action = async ({dbConfig, client}: any) => {
  const query = `show all`;
  const { rows } = await client.query(query);
  return rows; 
};

const sendResults = async ({ payload, options }: any) => makeInternalHttpRequest(payload, options, 0);

export default { 
    fn: action,
    exporter: {
      sendResults,
    } 
};

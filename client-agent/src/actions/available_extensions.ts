

import { makeInternalHttpRequest } from '../http';
const action = async ({ dbConfig, client }: any) => {
  const query = `SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
ORDER BY name`;
  const { rows } = await client.query(query);
  return rows;
};

const sendResults = async ({ payload, options }: any) => makeInternalHttpRequest(payload, options, 0);

export default {
  availableExtensions: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};



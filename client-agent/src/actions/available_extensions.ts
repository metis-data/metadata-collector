

import { makeInternalHttpRequest } from '../http';
import { availableExtensionsQuery } from './raw-queries';

const action = async ({ dbConfig, client }: any) => {

  const { rows } = await client.query(availableExtensionsQuery);
  return rows;
};

const sendResults = async ({ payload, options }: any) => makeInternalHttpRequest(payload, options, 0);

export default {
    fn: action,
    exporter: {
      sendResults,
    }
};



import { connectionsQuery } from "./raw-queries";

const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('connections_metric');

const ConnectionState = {
  IDLE: 'idle',
  ACTIVE: 'active',
};

async function fetchData(dbConfig: any, client: any) {
 
  const { rows } = await client.query(connectionsQuery);
  return rows;
}

function shapeData(data: any, dbConfig: any) {
  const idleConnections: any = [];
  const activeConnections: any = [];
  const { database: db, host } = dbConfig;

  data.forEach((row: any) => {
    const timestamp = Date.now();
    const { state, count, ...rest } = row;

    if (row?.state === ConnectionState.ACTIVE) {
      activeConnections.push({
        value: count,
        metricName: 'active_connections',
        tags: { timestamp, db, host, ...rest },
      });
    } else if (row?.state === ConnectionState.IDLE) {
      idleConnections.push({
        value: count,
        metricName: 'idle_connections',
        tags: { timestamp, db, host, ...rest },
      });
    }
  });
  const results: any = [idleConnections, activeConnections];

  logger.debug('shapeData - results: ', results);
  return results;
}

async function sendResults({ payload, options }: any) {
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', data, options);
  return makeInternalHttpRequest(data, options);
}

async function run({ dbConfig, client }: any) {
  logger.debug('run - calling fetchData with: ', dbConfig);
  const data = await fetchData(dbConfig, client);
  logger.debug('run - calling shapeData with: ', { data, dbConfig });
  const results = shapeData(data, dbConfig);
  return results;
}

export default {
    fn: run,
    exporter: {
      sendResults,
    }
};

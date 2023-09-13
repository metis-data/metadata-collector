const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('connections_metric');
const roundTimestampToMinute = require('../utils/round-date-to-minutes');

const ConnectionState = {
  IDLE: 'idle',
  ACTIVE: 'active',
};

async function fetchData(dbConfig, client) {
  const qry = `SELECT state, count(*)::int FROM pg_stat_activity
        where datid is not null
        group by state;`;

  const { rows } = await client.query(qry);
  return rows;
}

function shapeData(data, dbConfig) {
  const idleConnections = [];
  const activeConnections = [];
  const { database: db, host } = dbConfig;

  data.forEach((row) => {
    const timestamp = new Date().getTime() * 1000000;
    const { state, count, ...rest } = row;

    if (row?.state === ConnectionState.ACTIVE) {
      activeConnections.push({
        value: count,
        timestamp,
        metricName: 'active_connections',
        tags: { db, host, ...rest },
      });
    } else if (row?.state === ConnectionState.IDLE) {
      idleConnections.push({
        value: count,
        timestamp,
        metricName: 'idle_connections',
        tags: { db, host, ...rest },
      });
    }
  });
  const results = [idleConnections, activeConnections];

  logger.debug('shapeData - results: ', results);
  return results;
}

async function sendResults({ payload, options }) {
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', data, options);
  return makeInternalHttpRequest(data, options);
}

async function run({ dbConfig, client }) {
  logger.debug('run - calling fetchData with: ', dbConfig);
  const data = await fetchData(dbConfig, client);
  logger.debug('run - calling shapeData with: ', { data, dbConfig });
  const results = shapeData(data, dbConfig);
  return results;
}

module.exports = {
  connectionsMetric: {
    fn: run,
    exporter: {
      sendResults,
    },
  },
};

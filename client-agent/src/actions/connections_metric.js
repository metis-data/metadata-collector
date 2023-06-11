const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('connections_metric');

const ConnectionState = {
    IDLE: 'idle',
    ACTIVE: 'active',
}

async function fetchData(dbConfig, client) {
    try {
        logger.info('fetchData - start');

        const qry = `SELECT state, count(*)::int, application_name FROM pg_stat_activity
        where datid is not null
        and datname = '${dbConfig.database}'
        group by state, application_name;`

        const { rows } = await client.query(qry);
        logger.debug('fetchData - data: ', rows);
        logger.info('fetchData - end');
        return rows;
    }
    catch (e) {
        logger.error('fetchData - error: ', e);
    }
}

function shapeData(data, dbConfig) {
    logger.info('shapeData - start');
    const idleConnections = [];
    const activeConnections = [];
    const { database: db, host } = dbConfig;

    data.forEach(row => {
        const timestamp = Date.now();
        const { state, count, ...rest } = row;

        if (row?.state === ConnectionState.ACTIVE) {
            activeConnections.push({ value: count, metricName: 'active_connections', tags: { timestamp, db, host, ...rest } });
        }
        else if (row?.state === ConnectionState.IDLE) {
            idleConnections.push({ value: count, metricName: 'idle_connections', tags: { timestamp, db, host, ...rest } });
        }
    });
    const results = [
        idleConnections,
        activeConnections
    ];

    logger.debug('shapeData - results: ', results);
    logger.info('shapeData - end');
    return results;
}

async function sendResults({ payload, options }) {
    try {
        logger.info('sendResults - start');
        const { data: _data } = payload;
        const data = _data.flat(Infinity);
        logger.debug('sendResults - calling makeInternalHttpRequest: ', data, options);
        return makeInternalHttpRequest(data, options);
    }
    catch (e) {
        logger.error('sendResults - error: ', e);
    }
}

async function run({ dbConfig, client }) {
    try {
        logger.info('run - start');
        logger.debug('run - calling fetchData with: ', dbConfig);
        const data = await fetchData(dbConfig, client);
        logger.debug('run - calling shapeData with: ', { data, dbConfig });
        const results = shapeData(data, dbConfig);
        return results;
    }
    catch (e) {
        logger.error('run - error: ', e);
    }
}

module.exports = {
    connectionsMetric: {
        fn: run,
        exporter: {
            sendResults,
        },
    },
};

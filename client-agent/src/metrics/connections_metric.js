const pg = require('pg');
const { makeInternalHttpRequest } = require('../http');
const { HTTPS_REQUEST_OPTIONS } = require('../consts');
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

async function transferData(...args) {
    try {
        logger.info('transferData - start');
        const data = args.flat(Infinity);
        const { headers, ...rest } = HTTPS_REQUEST_OPTIONS;
        const options = { ...rest, headers: { ...headers, 'x-api-version': 'v2' } };
        logger.debug('transferData - calling makeInternalHttpRequest: ', data, options);
        await makeInternalHttpRequest(data, options);
        logger.info('transferData - end');
    }
    catch (e) {
        logger.error('transferData - error: ', e);
    }
}

async function run(dbConfig, dbClient) {
    try {
        logger.info('run - start');
        logger.debug('run - calling fetchData with: ', dbConfig);
        const data = await fetchData(dbConfig, dbClient);
        const results = shapeData(data, dbConfig);
        logger.debug('run - calling transferData with: ', results);
        await transferData(...results);
        logger.info('run - end');
        return;
    }
    catch (e) {
        logger.error('run - error: ', e);
    }

}

module.exports = run;
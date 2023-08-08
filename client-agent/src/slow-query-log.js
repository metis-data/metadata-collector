const { createSubLogger } = require('./logging');
const consts = require('./consts');
const crypto = require('crypto');
const fs = require('fs');
const yaml = require('js-yaml');
const MetisSqlCollector = require('@metis-data/slow-query-log').MetisSqlCollector;
const logger = createSubLogger('slow-query-log');

const takeAction = async (connection) => {
    try {
        const results = await connection.metisSqlCollector.run() || true;
        logger.debug('takeAction - results: ', results);
        return results;
    }
    catch (e) {
        logger.error('Slow query log error: ', e);
        return false;
    }
}

async function collectPlans(_, connections) {
    const promiseArr = connections.map(takeAction);
    logger.info('Plan collector is done.');

    const responses = await Promise.allSettled(promiseArr);


    const results = responses
        .map((responsePromise) => (responsePromise.status === 'fulfilled' && responsePromise.value ? responsePromise.value : []));

    return results;
}

module.exports = collectPlans;
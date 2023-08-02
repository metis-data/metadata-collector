const { createSubLogger } = require('./logging');
const consts = require('./consts');
const crypto = require('crypto');
const fs = require('fs');
const yaml = require('js-yaml');
const MetisSqlCollector = require('@metis-data/slow-query-log').MetisSqlCollector;
const logger = createSubLogger('slow-query-log');
const { QUERIES_FILE } = require('./consts');
const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');

const takeAction = async (connectionString, database) => {
    try {
        logger.info('takeAction - start');
        const metisApiKey = consts.API_KEY;
        const metisExportUrl = consts.API_GATEWAY_HOST;
        // TODO: think about a service name convention
        const serviceName = `${database}-pmc`;

        logger.debug('takeAction - calling new MetisSqlCollector');
        const metis = new MetisSqlCollector({
            connectionString,
            metisApiKey,
            metisExportUrl,
            serviceName
        });

        logger.debug('takeAction - calling metis.run');
        const results = await metis.run() || true;

        logger.debug('takeAction - results: ', results);
        logger.info('takeAction - end');
        return results;
    }
    catch (e) {
        logger.error('error: ', e);
        return false;
    }
}

async function collectPlans(_, connections) {
    const promiseArr = connections.map(
        (connection) => {
            const { connectionString, database } = connection;
            return takeAction(connectionString, database);
        }
    );

    const responses = await Promise.allSettled(promiseArr);

    const results = responses
        .map((responsePromise) => (responsePromise.status === 'fulfilled' && responsePromise.value ? responsePromise.value : []));

    return results;
}

module.exports = collectPlans;
const { createSubLogger } = require('./logging');
const consts = require('./consts');
const crypto = require('crypto');
const fs = require('fs');
const yaml = require('js-yaml');
const { relevant } = require('./utils');
const MetisSqlCollector = require('@metis-data/slow-query-log').MetisSqlCollector;
const logger = createSubLogger('slow-query-log');
const { QUERIES_FILE } = require('./consts');
const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES = yaml.load(queriesFileContents);
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

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

function getQueries(fakeHoursDelta) {
    const now = new Date();
    now.setHours(now.getHours() - fakeHoursDelta);
    const currentMinutes = now.getMinutes();
    const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
    if (process.argv.length === 2) {
        return Object.keys(QUERIES)
            .filter((key) => relevant(QUERIES[key].times_a_day, currentHour, currentMinutes))
            .map((key) => QUERIES[key]);
    }
    const qs = [];
    process.argv.slice(2).forEach((q) => {
        if (q in QUERIES) {
            qs.push(QUERIES[q]);
        }
    });
    if (qs.length < process.argv.length - 2) {
        const nonEligableQueries = process.argv.slice(2).filter((q) => !(q in QUERIES));
        throw Error(
            `Error running the CLI. The following are not eligible queries: ${nonEligableQueries}`,
        );
    }
    return qs;
}

async function collectPlans(fakeHoursDelta, connections) {
    const theQueries = getQueries(fakeHoursDelta);
    if (theQueries.length === 0) {
        logger.info('There are no queries to run for this hour.');
        return;
    }

    const promiseArr = connections.map(
        (connection) => {
            const { connectionString, database } = connection;
            return takeAction(connectionString, database);
        }
    );
    logger.info('Collection is done.');

    const responses = await Promise.allSettled(promiseArr);


    const results = responses
        .map((responsePromise) => (responsePromise.status === 'fulfilled' && responsePromise.value ? responsePromise.value : []));

    return results;
}

module.exports = collectPlans;
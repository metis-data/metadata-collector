const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('database_size');


async function fetchData(dbConfig: any, client: any) {
        const qry = `
        SELECT
 oid,
 datname as database_name,
 pg_database_size(datname) as database_size,
 pg_size_pretty(pg_database_size(datname)) as database_size_pretty
FROM pg_database
WHERE datistemplate = false;
        `;

        const { rows } = await client.query(qry);
        return rows;
}

function shapeData(data: any, dbConfig: any) {
    const results: any = [];
    const { database: db, host, port } = dbConfig;
    const timestamp = new Date().getTime() * 1000000;

    data.forEach((row: any) => {
        const { oid, database_name, database_size, database_size_pretty } = row;
        results.push({
            value: database_size,
            metricName: 'DATABASE_SIZE',
            timestamp,
            tags: { db, host, oid, port, database_name, database_size_pretty }
        });
    });
    logger.debug('shapeData has finished');
    return results;
}

async function sendResults({ payload, options }: any) {
    const { data: _data } = payload;
    const data = _data.flat(Infinity);
    logger.debug('sendResults - calling makeInternalHttpRequest: ', { options });
    return makeInternalHttpRequest(data, options);
}

async function run({ dbConfig, client }: any) {
    logger.debug('run - calling fetchData');
    const data = await fetchData(dbConfig, client);
    logger.debug('run - calling shapeData');
    return shapeData(data, dbConfig);
}

 export default {
        fn: run,
        exporter: {
            sendResults,
        }
};




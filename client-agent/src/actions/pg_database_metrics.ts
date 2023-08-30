const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('pgDatabaseMetrics');

async function fetchData(dbConfig: any, client: any) {
    const qry = `
        SELECT 
	datid as dbid, 
  datname as db_name, 
  numbackends as ACTIVE_CONNECTIONS, 
  xact_commit as COMMITED_TRANSACTIONS, 
  xact_rollback as ROLLEDBACK_TRANSACTIONS,
  blks_read as DISC_BLOCKS_READ, 
  blks_hit as CACHE_HITS,
  tup_returned as ROWS_RETURNED, 
  tup_fetched as ROWS_FETCHED, 
  tup_inserted as ROWS_INSERTED, 
  tup_updated as ROWS_UPDATED, 
  tup_deleted as ROWS_DELETED, 
  temp_files as TEMPORARY_FILES_CREATED,
  deadlocks as DEADLOCKS
FROM pg_stat_database;
        `;

    const { rows } = await client.query(qry);
    return rows;
}

function shapeData(data: any, dbConfig: any) {
    const results: any = [];
    const { database: db, host } = dbConfig;
    const timestamp = new Date().getTime() * 1000000;

    data.forEach((row: any) => {
        const {
            db_name, dbid, ...rest
        } = row;

        Object.keys(rest).map((metricName) => {
            results.push({
                value: rest[metricName],
                metricName: metricName.toUpperCase(),
                timestamp,
                tags: { db, host, dbName: db_name, dbid }
            });
        });
    });

    return results;
}

async function sendResults({ payload, options }: any) {
    const { data: _data } = payload;
    const data = _data.flat(Infinity);
    return makeInternalHttpRequest(data, options);
}

async function run({ dbConfig, client }: any) {
    logger.debug('run - calling fetchData with: ', dbConfig);
    const data = await fetchData(dbConfig, client);
    const results = shapeData(data, dbConfig);
    return results;
}

export default {
        fn: run,
        exporter: {
            sendResults,
        }
};
const pg = require('pg');
const { makeInternalHttpRequest } = require('../http');
const { HTTPS_REQUEST_OPTIONS } = require('../consts');

const ConnectionState = {
    IDLE: 'idle',
    ACTIVE: 'active',
}

async function fetchData(dbConfig) {
    try {
        const qry = `SELECT state, count(*)::int, application_name FROM pg_stat_activity
        where datid is not null
        and datname = '${dbConfig.database}'
        group by state, application_name;`

        client = new pg.Client(dbConfig);
        await client.connect();
        const { rows } = await client.query(qry);
        return rows;
    }
    catch (e) {

    }
}

function shapeData(data, dbConfig) {
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

    return [
        idleConnections,
        activeConnections
    ]
}

async function transferData(...args) {
    try {
        const data = args.flat(Infinity);
        const { headers, ...rest } = HTTPS_REQUEST_OPTIONS;
        await makeInternalHttpRequest(data, { ...rest, headers: { ...headers, 'x-api-version': 'v2' } });
    }
    catch (e) {

    }
}

async function run(dbConfig) {
    try {
        const data = await fetchData(dbConfig);
        const results = shapeData(data, dbConfig);
        await transferData(...results);
        return;
    }
    catch (e) {

    }

}

module.exports = run;
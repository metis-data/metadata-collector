const pg = require('pg');
const { PG_STAT_STATEMENTS_ROWS_LIMIT } = require('../consts');
const { logger } = require('../logging');

const stat_statements = async (dbConfig) => {
    let client;
    try {
        client = new pg.Client(dbConfig);
        logger.info(`Trying to connect to ${dbConfig.database} ...`);
        await client.connect();
        logger.info(`Connected to ${dbConfig.database}`);
        const query = `
        select distinct on (queryid ) queryid as query_id,
pgss.calls as calls,
pgss.query,
pgss.rows,
pgss.total_exec_time,
pgss.mean_exec_time,
pgss.dbid as db_id,
pgd.datname as database_name,
blk_read_time + blk_write_time as disk_io_time,
to_jsonb(pgss) - 'userId' - 'dbid' - 'mean_exec_time' - 'total_exec_time' - 'rows' - 'query' - 'queryid' - 'calls' as metadata
 from 
pg_stat_statements as pgss
join pg_database as d  on pgss.dbid = d.oid
join pg_database pgd on pgd.oid = pgss.dbid
where rows > 0 and total_exec_time > 0
order by queryid desc
limit ${PG_STAT_STATEMENTS_ROWS_LIMIT};`;
        const { rows } = await client.query(query);
        return rows;
    }
    catch (e) {
        logger.error(e);
    }
    finally {
        try {
            await client.end();
            logger.info(`connection has been closed.`);
        }
        catch (e) {
            logger.error(`connection could not be closed: `, e);
        }
    }
}

module.exports = stat_statements;
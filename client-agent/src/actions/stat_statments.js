const pg = require('pg');
const astParser = require('node-sql-parser').Parser;
const { PG_STAT_STATEMENTS_ROWS_LIMIT } = require('../consts');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

const action = async (dbConfig) => {
  let client;
  try {
    client = new pg.Client(dbConfig);
    logger.info(`Trying to connect to ${dbConfig.database} ...`);
    await client.connect();
    logger.info(`Connected to ${dbConfig.database}`);
    const query = `
        SELECT table_catalog, table_schema, table_name from information_schema.tables WHERE table_schema NOT IN('pg_catalog', 'information_schema');

        select 
        queryid as query_id,
        pgss.calls as calls,
        query,
        pgss.rows,
        pgss.total_exec_time,
        pgss.mean_exec_time,
        pgss.dbid as db_id,
        pgd.datname as database_name,
        blk_read_time + blk_write_time as disk_io_time,
        to_jsonb(pgss) - 'userId' - 'dbid' - 'mean_exec_time' - 'total_exec_time' - 'rows' - 'query' - 'queryid' - 'calls' as metadata
        from pg_stat_statements as pgss
        join pg_database pgd on pgd.oid = pgss.dbid
        where 
        1=1
        and rows > 0 
        and total_exec_time > 0
        and pgd.datname = '${dbConfig.database}'
        order by total_exec_time desc, calls desc 
        limit ${PG_STAT_STATEMENTS_ROWS_LIMIT};
        `;

    const [{ rows: userTablesArr }, { rows: data }] = await client.query(query);
    await client.end();
    const parser = new astParser();
    const userTables = userTablesArr.map((el) => el.table_name);
    const sanitizedDataPromiseArr = data.map(item => new Promise((res) => {
      try {
        const { ast } = parser.parse(item.query, {
          database: 'PostgresQL',
        });
        const qryTables = ast?.from?.map((el) => el.table);
        const isUserTablesQry = qryTables.every((tableName) =>
          userTables.includes(tableName),
        );

        return isUserTablesQry ? res(item)
          :
          res(null);
      }
      catch (e) {
        return res(null);
      }
    })
    );
    const sanitizedData = await Promise.all(sanitizedDataPromiseArr);
    return sanitizedData.filter(Boolean);
  } catch (e) {
    logger.error('connection could not be closed: ', e);
  }
};

const sendResults = async ({ payload, options }) => makeInternalHttpRequest(payload, options, 0);

module.exports = {
  statStatmentsAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};
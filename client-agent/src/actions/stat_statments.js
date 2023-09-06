const pg = require('pg');
const { parseAsync } = require('pgsql-parser');
const { PG_STAT_STATEMENTS_ROWS_LIMIT } = require('../consts');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');
const { isEmpty } = require('../utils');

function extractTablesInvolved(ast) {
  return [
    ast?.RawStmt?.stmt?.ExplainStmt?.query?.SelectStmt?.fromClause?.length > 0
      ? ast?.RawStmt?.stmt?.ExplainStmt?.query?.SelectStmt?.fromClause?.map(
          (el) => el?.RangeVar?.relname,
        )
      : null,
    ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.JoinExpr?.larg?.JoinExpr?.larg?.RangeVar
      ?.relname,
    ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.JoinExpr?.larg?.JoinExpr?.rarg?.RangeVar
      ?.relname,
    ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.JoinExpr?.rarg?.RangeVar?.relname,
    ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.RangeVar?.relname,
    ast?.RawStmt?.stmt?.InsertStmt?.relation?.relname,
    ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.length > 0
      ? ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.map((el) => el?.RangeVar?.relname)
      : null,
  ]
    .flat(Infinity)
    .filter(Boolean);
}

const action = async ({ dbConfig, client }) => {
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
        and toplevel=true
        order by total_exec_time desc, calls desc 
        limit ${PG_STAT_STATEMENTS_ROWS_LIMIT};
        `;

  const [{ rows: userTablesArr }, { rows: data }] = await client.query(query);

  const userTables = userTablesArr.map((el) => el.table_name);

  const astPromiseArr = data.map((stat) => parseAsync(stat.query));
  const resolvedPromiseArr = await Promise.all(astPromiseArr);
  const sanitizedData = resolvedPromiseArr
    .map((el, ind) => {
      const qryTables = extractTablesInvolved(el?.[0]);
      const isUserTablesQry = qryTables.every((tableName) => userTables.includes(tableName));

      return isUserTablesQry ? { ...data[ind], metadata: {} } : null;
    })
    .filter(Boolean);

  const res = sanitizedData.filter(item => !item.query.includes('/* metis */'));
  return res;
};

const sendResults = async ({ payload, options, error }) => {
  if (error) {
    logger.warn('Stats statements sending data when there is an error for action');
    return;
  }

  if (isEmpty(payload)) {
    logger.warn('Stats statments has empty result');
    return;
  }

  return makeInternalHttpRequest(payload, options, 0);
};

module.exports = {
  statStatmentsAction: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};

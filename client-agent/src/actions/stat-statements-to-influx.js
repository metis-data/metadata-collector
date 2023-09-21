const { parseAsync } = require('pgsql-parser');
const { PG_STAT_STATEMENTS_ROWS_LIMIT } = require('../consts');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');

function extractTablesInvolved(ast) {
    const stmt = ast?.RawStmt?.stmt;
    const JoinExprFromSelect = ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.JoinExpr;
    const ExplainStmtFromSelect = ast?.RawStmt?.stmt?.ExplainStmt?.query?.SelectStmt?.fromClause;
  
    return [
      ExplainStmtFromSelect?.length > 0
        ? ExplainStmtFromSelect?.map(
            (el) => el?.RangeVar?.relname,
          )
        : null,
        JoinExprFromSelect?.larg?.RangeVar
        ?.relname,
        JoinExprFromSelect?.rarg?.RangeVar
        ?.relname,
        JoinExprFromSelect?.rarg?.RangeVar?.relname,
        stmt?.SelectStmt?.fromClause?.[0]?.RangeVar?.relname,
        stmt?.InsertStmt?.relation?.relname,
        stmt?.SelectStmt?.fromClause?.length > 0
        ? stmt?.SelectStmt?.fromClause?.map((el) => el?.RangeVar?.relname)
        : null,
    ]
      .flat(Infinity)
      .filter(Boolean);
  }
  
  async function action({ dbConfig, client })  {
    
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
      
     const res = shapeData(sanitizedData, dbConfig);
    
     return res;
 
};


function shapeData(data, dbConfig) {
  try {
    const results = [];
    const { database: db, host, port } = dbConfig;
    const NANO_SECOND = 0.000001;
    let timestamp = new Date();
    let updatedDate = timestamp.getTime() * 1000000
    
    data.forEach((row, idx) => {
      
        const { calls, rows, total_exec_time, query_id, db_id, query, database_name } = row;
        if(!query.includes('/* metis */')) {
          results.push({
            metricName: 'PG_STAT_STATEMENT',
            timestamp: updatedDate,
            values: { calls, rows, total_exec_time },
            tags: { host, port, db_id, database_name, query_id : query_id + idx }
        });
        }
    });
    
    // let rr = []

    // for(let i=0; i < 20_000; i++) {
    //   rr.push({
    //          metricName: 'PG_STAT_STATEMENT',
    //         timestamp: 1694616598576000000 ,
    //         values: {
    //           calls: "2441",
    //           rows: "2441",
    //           total_exec_time: 8437888.447111003,
    //         },
    //         tags: {
    //           host: "database-2.cofhrj7zmyn4.eu-central-1.rds.amazonaws.com",
    //           port: 5432,
    //           db_id: 620733,
    //           database_name: "platform-v2",
    //           query_id: "3637677908851465130" + i,
    //         }
    //   })
    // }

    return results;
  }
  catch (error) {
    logger.error(error)
  }
}

async function sendResults({ payload, options }) {
  logger.debug('pg_stat_statments - start');
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', data, options);
  logger.debug('pg_stat_statments - end');
  return makeInternalHttpRequest(data, options);
 
}

module.exports = {
  statStatmentsMetric: {
    fn: action,
    exporter: {
      sendResults,
    },
  },
};
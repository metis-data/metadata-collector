const pg = require('pg');
const { parseAsync } = require('pgsql-parser');
const { PG_STAT_STATEMENTS_ROWS_LIMIT } = require('../consts');
const { logger } = require('../logging');
const { makeInternalHttpRequest } = require('../http');
const { isEmpty } = require('../utils');
import axios from 'axios';
import { pgstatstatmentsQuery } from './raw-queries';

function extractTablesInvolved(ast: any) {
  const stmt = ast?.RawStmt?.stmt;
  const JoinExprFromSelect = ast?.RawStmt?.stmt?.SelectStmt?.fromClause?.[0]?.JoinExpr;
  const ExplainStmtFromSelect = ast?.RawStmt?.stmt?.ExplainStmt?.query?.SelectStmt?.fromClause;

  return [
    ExplainStmtFromSelect?.length > 0
      ? ExplainStmtFromSelect?.map(
          (el: any) => el?.RangeVar?.relname,
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
      ? stmt?.SelectStmt?.fromClause?.map((el: any) => el?.RangeVar?.relname)
      : null,
  ]
    .flat(Infinity)
    .filter(Boolean);
}

async function run({ dbConfig, client }: any)  {
  
  const query = pgstatstatmentsQuery(dbConfig.database, PG_STAT_STATEMENTS_ROWS_LIMIT );

  const [{ rows: userTablesArr }, { rows: data }] = await client.query(query);

  const userTables = userTablesArr.map((el: any) => el.table_name);

  const astPromiseArr = data.map((stat: any) => parseAsync(stat.query));
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


function shapeData(data: any, dbConfig: any) {
  const results: any = [];
  const { database: db, host, port } = dbConfig;
  const timestamp = new Date().getTime() * 1000000;
  data.forEach((row: any) => {
      const { calls, rows, total_exec_time, query_id  } = row;
      results.push({
          value: query_id,
          calls: calls,
          total_exec_time: total_exec_time, 
          rows: rows,
          metricName: 'PG_STAT_STATMENT',
          timestamp,
          tags: { db, host, port  }
      });
  });
  logger.debug('shapeData has finished');
  return results;
}

// const sendResults = async ({ payload, options, error }: any) => {
//   console.log('send result from pg_stat')
//   console.log(JSON.stringify(payload))

//   console.log('send result from pg_stat')
//   if (error) {
//     logger.warn('Stats statements sending data when there is an error for action');
//     return;
//   }

//   if (isEmpty(payload)) {
//     logger.warn('Stats statments has empty result');
//     return;
//   }

//   return makeInternalHttpRequest(payload, options, 0);
// };

async function sendResults({ payload, options }: any) {
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', data, options);
  return makeInternalHttpRequest(data, options);
}

export default {
    fn: run,
    exporter: {
      sendResults,
    }
};

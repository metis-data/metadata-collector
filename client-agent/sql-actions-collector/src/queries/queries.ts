import process from 'process';
import pg from 'pg';
import { logger } from '../common/logging';
import { processResults } from '../common/process';
import { relevant } from '../common/utils';
require('dotenv').config();
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

// const configT = [
//   {
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     port: process.env.DB_PORT,
//     connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT_MILLIS,
//   },
// ];

const QUERIES: any = {
  tables_size: {
    query: `SELECT 
                  n.nspname AS schema, c.relname AS table, relpages AS pages, reltuples AS rows,
                  pg_relation_size(c.oid) / 1024 AS relation_size, pg_table_size(c.oid) / 1024 AS table_size, 
                  pg_indexes_size(c.oid) / 1024 AS indexes_size, 
                  (pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid)) / 1024 AS toast_size
            FROM pg_class AS c
                  LEFT JOIN pg_namespace AS n
                        ON (N.oid = c.relnamespace)
            WHERE relkind='r'
            AND n.nspname NOT IN ('pg_catalog', 'information_schema') 
            ORDER BY 1, 2;`,
    times_a_day: 1,
  },
  index_usage: {
    query: `SELECT
                  sui.schemaname AS schema, sui.relid, sui.relname AS table, sui.indexrelid, sui.indexrelname AS index, 
                  sui.idx_scan AS index_scans, sui.idx_tup_read AS index_rows_reads, sui.idx_tup_fetch AS index_rows_writes,
                  sio_ui.idx_blks_read AS pages_read_from_disk, sio_ui.idx_blks_hit AS pages_read_from_buffer
            FROM pg_stat_user_indexes AS sui
                  JOIN pg_statio_user_indexes AS sio_ui
                        ON sui.relid = sio_ui.relid
            AND sui.indexrelid = sio_ui.indexrelid;`,
    times_a_day: 6,
  },
};

const getQueries = (fakeHoursDelta) => {
  try {
    const now = new Date();
    now.setHours(now.getHours() - fakeHoursDelta);
    const currentMinutes = now.getMinutes();
    const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
    if (process.argv.length === 2) {
      return Object.keys(QUERIES)
        .filter((key) => relevant(QUERIES[key].times_a_day, currentHour, currentMinutes, true))
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
      throw Error(`Error running the CLI. The following are not eligible queries: ${nonEligableQueries}`);
    }
    return qs;
  } catch (error) {
    console.log(error);
  }
};

const results = {};

const collectQueries = async (fakeHoursDelta, dbConfigs) => {
  try {
    if (dbConfigs.length === 0) {
      logger.error('No connection strings could be parsed');
      return;
    }
    const theQueries = getQueries(fakeHoursDelta);
    if (theQueries.length === 0) {
      logger.info('There are no queries to run for this hour.');
      return;
    }
    const bigQuery = theQueries.map((q) => q.query).join('; ');
    await Promise.allSettled(
      dbConfigs.map(async (dbConfig) => {
        let client = null;
        try {
          const dbConfigKey = JSON.stringify(dbConfig) + bigQuery;
          if (!(dbConfigKey in results)) {
            client = new pg.Client(dbConfig);
            logger.info(`Trying to connect to ${dbConfig.database} ...`);
            await client.connect();
            logger.info(`Connected to ${dbConfig.database}`);
            const res = await client.query(bigQuery);
            logger.info('Obtained query results. Processing results ...');
            results[dbConfigKey] = theQueries.length === 1 ? [res] : res;
          }
          const now: Date = new Date();
          now.setHours(now.getHours() - fakeHoursDelta);
          await processResults(dbConfig, results[dbConfigKey], now.getTime(), fakeHoursDelta !== 0);
          logger.info('Processing results done.');
        } catch (err) {
          logger.error(err.message);
        } finally {
          if (client) {
            client.end();
          }
        }
      })
    )
      .then((returnedResults) => {
        const allOK = returnedResults.every((result) => result.status === 'fulfilled');
        if (!allOK) {
          logger.error(`Some of the DBs did not get back fine. dbConfigs is: ${dbConfigs} and the results are ${returnedResults}`);
        }
      })
      .catch((err) => {
        logger.error(`Error "${err}" catched in collect.`);
      });
    logger.info('Collection is done.');
  } catch (error) {
    console.log(error);
  }
};

export default collectQueries;

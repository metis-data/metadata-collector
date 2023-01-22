const fs = require('fs');
const pg = require('pg');
const yaml = require('js-yaml');
const process = require('process');
const { dbDetailsFactory } = require('@metis-data/db-details');

const { logger } = require('./logging');
const { relevant } = require('./utils');
const { directHttpsSend } = require('./http');
const { API_KEY, ACTIONS_FILE, WEB_APP_REQUEST_OPTIONS } = require('./consts');

const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';
const actionsFileContents = fs.readFileSync(ACTIONS_FILE, 'utf8');
const ACTIONS_DEF = yaml.load(actionsFileContents);

const ACTIONS = {
  schemas: (dbConfig) => {
    const schemaDetailsObject = dbDetailsFactory('postgres');
    return schemaDetailsObject.getDbDetails(dbConfig);
  },
  stat_statements: async (dbConfig) => {
    try {
      const client = new pg.Client(dbConfig);
      logger.info(`Trying to connect to ${dbConfig.database} ...`);
      await client.connect();
      logger.info(`Connected to ${dbConfig.database}`);
      const query = `select 
pgss.queryid as query_id,
pgss.query,
pgss.calls,
pgss.mean_exec_time,
pgss.dbid as db_id,
json_build_object(
'jit_emission_time', pgss.jit_emission_time,
'toplevel', pgss.toplevel,
'userid', pgss.userid,
'plans', pgss.plans,
'total_plan_time', pgss.total_plan_time,
'min_plan_time', pgss.min_plan_time,
'max_plan_time', pgss.max_plan_time,
'mean_plan_time', pgss.mean_plan_time,
'stddev_plan_time', pgss.stddev_plan_time,
'total_exec_time', pgss.total_exec_time,
'min_exec_time', pgss.min_exec_time,
'max_exec_time', pgss.max_exec_time,
'stddev_exec_time', pgss.stddev_exec_time,
'rows', pgss.rows,
'shared_blks_hit', pgss.shared_blks_hit,
'shared_blks_read', pgss.shared_blks_read,
'shared_blks_dirtied', pgss.shared_blks_dirtied,
'shared_blks_written', pgss.shared_blks_written,
'local_blks_hit', pgss.local_blks_hit,
'local_blks_read', pgss.local_blks_read,
'local_blks_dirtied', pgss.local_blks_dirtied,
'local_blks_written', pgss.local_blks_written,
'temp_blks_read', pgss.temp_blks_read,
'temp_blks_written', pgss.temp_blks_written,
'blk_read_time', pgss.blk_read_time,
'blk_write_time', pgss.blk_write_time,
'temp_blk_read_time', pgss.temp_blk_read_time,
'temp_blk_write_time', pgss.temp_blk_write_time,
'wal_records', pgss.wal_records,
'wal_fpi', pgss.wal_fpi,
'wal_bytes', pgss.wal_bytes,
'jit_functions', pgss.jit_functions,
'jit_generation_time', pgss.jit_generation_time,
'jit_inlining_count', pgss.jit_inlining_count,
'jit_inlining_time', pgss.jit_inlining_time,
'jit_optimization_count', pgss.jit_optimization_count,
'jit_optimization_time', pgss.jit_optimization_time,
'jit_emission_count', pgss.jit_emission_count,
'datacl', d.datacl,
'datconnlimit', d.datconnlimit,
'datfrozenxid', d.datfrozenxid,
'datminmxid', d.datminmxid,
'dattablespace', d.dattablespace,
'oid', d.oid,
'datdba', d.datdba,
'encoding', d.encoding,
'datlocprovider', d.datlocprovider,
'datistemplate', d.datistemplate,
'datallowconn', d.datallowconn,
'datname', d.datname
--'datcollversion', d.datcollversion,
--'datcollate', d.datcollate,
--'datctype', d.datctype,
--'daticulocale', d.daticulocale
) as metadata
from pg_stat_statements as pgss
join pg_database as d  on pgss.dbid = d.oid order by pgss.calls DESC LIMIT 5000;
;`;
      const { rows } = await client.query(query);
      return rows;
    }
    catch (e) {
      console.error(e);
      throw e;
    }
  }
};

function getActions(fakeHoursDelta) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.keys(ACTIONS_DEF)
      .filter((key) => relevant(ACTIONS_DEF[key].times_a_day, currentHour, currentMinutes))
      .map((key) => ACTIONS[key]);
  }
  const actions = [];
  process.argv.slice(2).forEach((q) => {
    if (q in ACTIONS) {
      actions.push(ACTIONS[q]);
    }
  });
  if (actions.length < process.argv.length - 2) {
    const nonEligableActions = process.argv.slice(2).filter((q) => !(q in ACTIONS));
    throw Error(`Error running the CLI. The following are not eligible Actions: ${nonEligableActions}`);
  }
  return actions;
}

async function collectActions(fakeHoursDelta, dbConfigs) {
  const theActions = getActions(fakeHoursDelta);
  if (!theActions.length) return;
  const actionsData = await Promise.all(
    dbConfigs.map((dbConfig) => theActions.reduce(async (result, action) => {
      logger.info(`Running action ${action.name}`);
      let schemaResult = {};
      let errors;
      try {
        const actionResult = await action(dbConfig);
        schemaResult = {
          [action.name]: actionResult,
        };
      } catch (err) {
        errors = {
          [action.name]: {
            error: err.stack,
          },
        };
        logger.error(`Action '${action.name}' failed to run`, err);
      }
      return {
        ...(await result),
        ...schemaResult,
        errors,
      };
    }, {
      apiKeyId: API_KEY,
      dbName: dbConfig.database,
      dbHost: dbConfig.host,
    })),
  );

  await directHttpsSend(actionsData, WEB_APP_REQUEST_OPTIONS, 1);
  logger.info('Sent actions results.');
  logger.debug(`Actions data is ${JSON.stringify(actionsData)}`);
}

module.exports = {
  collectActions,
};

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
      const query = `SELECT st.blk_read_time, st.blk_write_time,st.calls,st.dbid,st.local_blks_dirtied,st.local_blks_hit,st.local_blks_read,st.local_blks_written,st.max_exec_time,st.max_plan_time,st.mean_exec_time,st.mean_plan_time,st.min_exec_time,st.min_plan_time,st.plans,st.query,st.queryid,st.rows,st.shared_blks_dirtied,st.shared_blks_hit,st.shared_blks_read,st.shared_blks_written,st.stddev_exec_time,st.stddev_plan_time,st.temp_blks_read,st.temp_blks_written,st.total_exec_time,st.total_plan_time,st.userid,st.wal_bytes,st.wal_fpi,st.wal_records,d.datacl,d.datallowconn,d.datcollate,d.datconnlimit,d.datctype,d.datdba,d.datfrozenxid,d.datistemplate,d.datlastsysoid,d.datminmxid,d.datname,d.dattablespace,d.encoding,d.oid FROM pg_stat_statements as st join pg_database as d on st.dbid = d.oid order by st.calls DESC LIMIT 5000;`;
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

const fs = require('fs');
const yaml = require('js-yaml');
const process = require('process');
const { dbDetailsFactory } = require('@metis-data/db-details');
const stat_statements = require('./actions/stat_statments');

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
  stat_statements,
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
      apiKey: API_KEY,
      dbName: dbConfig.database,
      dbHost: dbConfig.host,
    })),
  );
  try {
    const [{ stat_statements, ...rest }] = actionsData;
    await Promise.allSettled(
      [
        directHttpsSend(rest, WEB_APP_REQUEST_OPTIONS, 1),
        directHttpsSend(stat_statements, { ...WEB_APP_REQUEST_OPTIONS, path: '/api/pmc/statistics/query' }, 1)
      ]);
    logger.info('Sent actions results.');
    logger.debug(`Actions data is ${JSON.stringify(actionsData)}`);
  }
  catch (e) {
    logger.error(e);
  }
}

module.exports = {
  collectActions,
};

const fs = require('fs');
const yaml = require('js-yaml');
const process = require('process');
const { dbDetailsFactory } = require('@metis-data/db-details');

const stat_statements = require('./stat_statments');

const { createSubLogger } = require('../logging');

const logger = createSubLogger('actions');
const { relevant } = require('../utils');
const { directHttpsSend } = require('../http');

const { API_KEY, ACTIONS_FILE, WEB_APP_REQUEST_OPTIONS } = require('../consts');

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

// bind function to action definition
Object.keys(ACTIONS_DEF).forEach((key) => {
  ACTIONS_DEF[key].fn = ACTIONS[key];
});

function getActions(fakeHoursDelta) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.entries(ACTIONS_DEF).reduce((releavntActions, [actionKey, actionDef]) => {
      if (relevant(actionDef.times_a_day, currentHour, currentMinutes)) {
        releavntActions[actionKey] = actionDef;
      }
      return releavntActions;
    }, {});
  }
  const actions = process.argv.slice(2).reduce((actions, requestedActionName) => {
    if (requestedActionName in ACTIONS_DEF) {
      actions[requestedActionName] = ACTIONS_DEF[requestedActionName];
    }
    return actions;
  }, {});

  if (actions.length < process.argv.length - 2) {
    const nonEligableActions = process.argv.slice(2).filter((q) => !(q in ACTIONS));
    throw Error(
      `Error running the CLI. The following are not eligible Actions: ${nonEligableActions}`,
    );
  }
  return actions;
}

const actionRunnerPerDatabase = (actions) => (dbConfig) => Object.entries(actions).reduce(async (result, [actionKey, actionDef]) => {
  logger.info(`Running action ${actionKey}`);
  let actionResult;
  let errors;
  try {
    actionResult = {
      [actionKey]: {
        actionKey,
        success: true,
        actionDef,
        result: {
          dbName: dbConfig.database,
          dbHost: dbConfig.host,
          data: await actionDef.fn(dbConfig),
        },
      },
    };
  } catch (error) {
    errors = {
      [actionKey]: {
        actionKey,
        success: false,
        actionDef,
        result: {
          dbName: dbConfig.database,
          dbHost: dbConfig.host,
          error,
        },
      },
    };
    logger.error(`Action '${actionKey}' failed to run`, { error });
  }
  return {
    ...(await result),
    ...actionResult,
    ...errors,
  };
}, {});

const sendActionResults = async (actionsResultPerConnection) => {
  const actionsResultsArr = actionsResultPerConnection.flatMap(Object.values);

  const httpRequestsPromises = actionsResultsArr.map(async (actionResult) => {
    const {
      actionKey, success, result, actionDef,
    } = actionResult;
    const options = {
      ...WEB_APP_REQUEST_OPTIONS,
      path: actionDef.export.url,
    };

    logger.debug(`Sending action: ${actionKey}`, { success, result });
    return await directHttpsSend(result, options, 1);
  });

  const settledActionResponse = await Promise.allSettled(httpRequestsPromises);

  logger.info('Sent actions results.', { settledActionResponse });
};

async function collectActions(fakeHoursDelta, dbConfigs) {
  const actionsToRun = getActions(fakeHoursDelta);
  if (!actionsToRun) return;

  const actionRunner = actionRunnerPerDatabase(actionsToRun);
  const actionsResult = await Promise.all(dbConfigs.map(actionRunner));

  await sendActionResults(actionsResult);
}

module.exports = {
  collectActions,
};

const fs = require('fs');
const pg = require('pg');
const yaml = require('js-yaml');
const process = require('process');

const { createSubLogger } = require('./logging');
const { relevant, mergeDeep } = require('./utils');
const { statStatmentsAction } = require('./actions/stat_statments');
const { schemaAction } = require('./actions/schema');
const { availableExtensions } = require('./actions/available_extensions');
const { connectionsMetric } = require('./actions/connections_metric');
const { planCollector } = require('./actions/plan_collector');
const { databaseSize } = require('./actions/database_size');
const { pgConfig } = require('./actions/pg_config');
const ExportersProviderConfig = require('./models').ExportersProviderConfig;
const { ACTIONS_FILE } = require('./consts');
const logger = createSubLogger('actions');

const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';
const actionsFileContents = fs.readFileSync(ACTIONS_FILE, 'utf8');
const ACTIONS_YAML = yaml.load(actionsFileContents);

const ACTIONS_FUNCS = {
  schemas: schemaAction,
  stat_statements: statStatmentsAction,
  available_extensions: availableExtensions,
  pg_config: pgConfig,
  connections_metric: connectionsMetric,
  plan_collector: planCollector,
  database_size: databaseSize,
};

const ACTIONS_DEF = mergeDeep(ACTIONS_YAML, ACTIONS_FUNCS);

function getActions(fakeHoursDelta) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.keys(ACTIONS_DEF)
      .filter((key) => relevant(ACTIONS_DEF[key].times_a_day, currentHour, currentMinutes))
      .map((key) => ACTIONS_DEF[key]);
  }
  const actions = [];
  process.argv.slice(2).forEach((action) => {
    if (action in ACTIONS_DEF) {
      actions.push(ACTIONS_DEF[action]);
    }
  });
  if (actions.length < process.argv.length - 2) {
    const nonEligableActions = process.argv.slice(2).filter((action) => !(action in ACTIONS_DEF));
    throw Error(
      `Error running the CLI. The following are not eligible Actions: ${nonEligableActions}`,
    );
  }
  return actions;
}

async function collectActions(fakeHoursDelta, dbConfigs) {
  const theActions = getActions(fakeHoursDelta);
  if (!theActions.length) return;
  const actionsData = await Promise.all(
    dbConfigs.map(async (dbConfig) => {
      let client;
      try {
        client = new pg.Client(dbConfig);
        logger.debug(`Trying to connect to ${dbConfig.database} ...`);

        await client.connect();

        logger.debug(`connected to ${dbConfig.database}`);

        const results = await theActions.reduce(
          async (result, action) => {
            logger.info(`Running action ${action.name}`);
            const schemaResult = {
              exporter: action.exporter,
              success: true,
              data: undefined,
              error: undefined,
            };
            try {
              const actionResult = await action.fn({ dbConfig, client });
              schemaResult.data = actionResult;
            } catch (err) {
              schemaResult.success = false;
              schemaResult.error = err;
              logger.error(`Action '${action.name}' failed to run`, err);
            }
            const acc = await result;
            logger.info(`Action ${action.name} has been finished successfuly`);
            return {
              ...acc,
              actions: {
                ...acc.actions,
                [action.name]: schemaResult,
              },
              errors: {
                ...acc.errors,
                ...(schemaResult.error && {
                  [action.name]: schemaResult.error,
                }),
              },
            };
          },
          {
            pmcDevice: {
              db_name: dbConfig.database,
              db_host: dbConfig.host,
              port: dbConfig.port?.toString() ?? '5432',
              rdbms: 'postgres',
            },
          },
        );
        return results;
      } finally {
        try {
          if (client) {
            await client.end();
            logger.debug('connection has been closed.');
          }
        } catch (e) {
          logger.error('connection could not be closed: ', e);
        }
      }
    }),
  );

  const requestResults = await Promise.all(
    actionsData.map(async ({ actions, pmcDevice, errors }) => {
      const sendResultPerActionPromises = Object.keys(actions).map(async (action) => {
        const { exporter, data, success, error } = actions[action];

        if (!success) {
          return error;
        }

        if (!exporter.provider) {
          throw new Error(`Unsupported exporter provider for action: ${action}`);
        } else {
          return exporter.sendResults({
            action,
            payload: {
              pmcDevice,
              data,
              error,
            },
            success,
            options: {
              ...ExportersProviderConfig[exporter.provider].httpOptions,
              path: exporter.url,
            },
          });
        }
      });

      return await Promise.allSettled(sendResultPerActionPromises);
    }),
  );

  try {
    requestResults.forEach((db) => {
      db.forEach((actionSetteled) => {
        if (actionSetteled.status === 'rejected') {
          logger.error('Action status', actionSetteled.reason);
        } else {
          logger.info('Action status', actionSetteled.value);
        }
      });
    });
  } catch (error) { }
}

module.exports = {
  collectActions,
};

const fs = require('fs');
const pg = require('pg');
const yaml = require('js-yaml');
const process = require('process');

const { SilentError } = require('./config/error');
const { createSubLogger } = require('./logging');
import { relevant, mergeDeep, isEmpty } from './utils';
const { statStatmentsAction } = require('./actions/stat_statments');
const { schemaAction } = require('./actions/schema');
const { availableExtensions } = require('./actions/available_extensions');
const { connectionsMetric } = require('./actions/connections_metric');
const { planCollector } = require('./actions/plan_collector');
const { dbHostDetails } = require('./actions/db_host_details');
const { databaseSize } = require('./actions/database_size');
const { pgDatabaseMetrics } = require('./actions/pg_database_metrics');
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
  db_host_details: dbHostDetails,
  database_size: databaseSize,
  pg_database_metrics: pgDatabaseMetrics,
};

const ACTIONS_DEF = mergeDeep(ACTIONS_YAML, ACTIONS_FUNCS);

function getActions(fakeHoursDelta: any) {
  const now = new Date();
  now.setHours(now.getHours() - fakeHoursDelta);
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
  if (process.argv.length === 2) {
    return Object.keys(ACTIONS_DEF)
      .filter((key) => relevant(ACTIONS_DEF[key].times_a_day, currentHour, currentMinutes))
      .map((key) => ACTIONS_DEF[key]);
  }
  const actions: any = [];
  process.argv.slice(2).forEach((action: any) => {
    if (action in ACTIONS_DEF) {
      actions.push(ACTIONS_DEF[action]);
    }
  });
  if (actions.length < process.argv.length - 2) {
    const nonEligableActions = process.argv.slice(2).filter((action: any) => !(action in ACTIONS_DEF));
    throw Error(
      `Error running the CLI. The following are not eligible Actions: ${nonEligableActions}`,
    );
  }
  return actions;
}

async function collectActions(fakeHoursDelta: any, connections: any) {
  const theActions: any = getActions(fakeHoursDelta);
  if (!theActions.length) return;
  const actionsData = await Promise.all(
    // PostgresDatabase class
    connections.map(async (connection: any) => {
      const results: any = await theActions.reduce(
        async (result: any, action: any) => {
          logger.debug(`Running action ${action.name}`);
          const schemaResult: any = {
            actionName: action,
            exporter: action.exporter,
            success: true,
            data: undefined,
            error: undefined,
          };
          try {
            for await (const client of connection.clientGenerator()) {
              const actionResult = await action.fn({ dbConfig: connection.dbConfig, client });
              schemaResult.data = actionResult;
            }
          } catch (err: any) {
            schemaResult.success = false;
            schemaResult.error = err;
            if (err && !(err instanceof SilentError)) {
              logger.error(`Action '${action.name}' failed to run`, { error: err });
            }
          }
          const acc: any = await result;
          logger.debug(`Action ${action.name} has been finished successfuly`);
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
            db_name: connection.database,
            db_host: connection.host,
            port: connection.port?.toString() ?? '5432',
            rdbms: 'postgres',
          },
        },
      );
      return results;
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
        }

        if (isEmpty(data)) {
          logger.warn('Action has been finished without data!', { action, data });

          return {
            actionName: action,
            exporterResult: {},
          };
        }

        const exporterResult = await exporter.sendResults({
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

        return {
          actionName: action,
          exporterResult,
        };
      });

      return await Promise.allSettled(sendResultPerActionPromises);
    }),
  );

  try {
    requestResults.forEach((db: any) => {
      db.forEach((actionSetteled: any) => {
        if (actionSetteled.status === 'rejected' || actionSetteled.value instanceof Error) {
          logger.info('Action status is failed', {
            error: actionSetteled?.reason || actionSetteled.value,
          });
        } else {
          logger.info('Action status for fulfilled', actionSetteled.value);
        }
      });
    });

    return {
      actionsData,
      requestResults: requestResults
        .map((prom: any) => (prom.status === 'fulfilled' ? prom.value : []))
        ?.flat(Infinity),
    };
  } catch (error) {}
}

export default {
  collectActions,
};
import fs = require('fs');
import yaml = require('js-yaml');
import process = require('process');

import { SilentError } from './config/error';
import { createSubLogger } from './logging';
import { relevant, mergeDeep, isEmpty } from './utils';
import  statStatmentsAction  from './actions/stat_statments';
import schemaAction  from './actions/schema';
import  availableExtensions  from './actions/available_extensions';
import  connectionsMetric  from './actions/connections_metric';
import  planCollector  from './actions/plan_collector';
import dbHostDetails  from './actions/db_host_details';
import  databaseSize  from './actions/database_size';
import  pgDatabaseMetrics  from './actions/pg_database_metrics';
import  pgConfig  from './actions/pg_config';
import queries from './actions/queries'

const ExportersProviderConfig = require('./models').ExportersProviderConfig;
const { ACTIONS_FILE, DEBUG } = require('./consts');
const logger = createSubLogger('actions');

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
  ...queries,
};

const ACTIONS_DEF = mergeDeep(ACTIONS_YAML, ACTIONS_FUNCS);

function getActions(runAll = false) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (runAll) {
    return Object.values(ACTIONS_DEF);
  }
  return Object.keys(ACTIONS_DEF)
    .filter((key) => relevant(ACTIONS_DEF[key].times_a_day, currentMinutes))
    .map((key) => ACTIONS_DEF[key]);
}

async function collectActions(runAll: any, connections: any) {
  const theActions = getActions(runAll).filter((action) => action.name);

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
              console.log(err)
              logger.error(`Action '${action.name}' failed to run`, { error: err });
            }
          }
          const acc = await result;
          logger.debug(`Action ${action.name} has been finished successfully`);
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

export  {
  collectActions,
};
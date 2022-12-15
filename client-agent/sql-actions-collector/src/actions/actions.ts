import process from 'process';
import { dbDetailsFactory } from '@metis-data/db-details';
import { logger } from '../common/logging';
import { relevant } from '../common/utils';
import directHttpsSend from '../common/http';
import { API_KEY, WEB_APP_REQUEST_OPTIONS } from '../common/consts';
require('dotenv').config();
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

const ACTIONS_DEF = { schemas: { times_a_day: 1 } };


const ACTIONS = {
  schemas: (dbConfig) => {
    const schemaDetailsObject = dbDetailsFactory('postgres');
    return schemaDetailsObject.getDbDetails(dbConfig);
  },
};


const getActions = (fakeHoursDelta) => {
  try {
    const now = new Date();
    now.setHours(now.getHours() - fakeHoursDelta);
    const currentMinutes = now.getMinutes();
    const currentHour = IGNORE_CURRENT_TIME ? 0 : now.getHours();
    if (process.argv.length === 2) {
      const aa = Object.keys(ACTIONS_DEF)
        .filter((key) => relevant(ACTIONS_DEF[key].times_a_day, currentHour, currentMinutes, true))
        .map((key) => ACTIONS[key]);
      return aa;
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
  } catch (error) {
    console.log(error);
  }
};

const collectActions = async (fakeHoursDelta, dbConfigs) => {
  try {
    const theActions = getActions(fakeHoursDelta);
    if (!theActions.length) {
      console.warn('No action was insert to actions array, check your action configuration');
      return;
    }
    const actionsData = await Promise.all(
      dbConfigs.map((dbConfig) =>
        theActions.reduce(
          async (result, action) => {
            logger.info(`Running action ${action.name}`);
            let schemaResult = {};
            let errors;
            try {
              const actionResult = await action(dbConfig);
              schemaResult = {
                [action.name]: actionResult,
              };
            } catch (e) {
              errors = {
                [action.name]: {
                  error: e.stack,
                },
              };
              logger.error(`Action failed to run: ${JSON.stringify(e)}`);
            }
            return {
              ...(await result),
              ...schemaResult,
              errors,
            };
          },
          {
            apiKeyId: API_KEY,
            dbName: dbConfig.database,
            dbHost: dbConfig.host,
          }
        )
      )
    );
    await directHttpsSend(actionsData, WEB_APP_REQUEST_OPTIONS, 1);
    logger.info('Sent actions results.');
    // logger.debug(`Actions data is ${JSON.stringify(actionsData)}`);
  } catch (err: any) {
    logger.error(err.message);
  }
};

export default collectActions;

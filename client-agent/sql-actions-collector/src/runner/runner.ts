import { logger } from './../common/logging';
import collectActions from './../actions/actions';
import collectQueries from './../queries/queries';
import dbConnectionStringParser from '../common/db-connection-string-parser';
require('dotenv').config();

const millis: any = process.env.DB_CONNECTION_TIMEOUT_MILLIS || 5000;
const dbConfigs: any[] = dbConnectionStringParser(process.env.DB_CONNECTION_STRINGS, millis);

export const runMain = async (fakeHoursDelta = 24) => {
  try {
    await collectQueries(fakeHoursDelta, dbConfigs);
    console.log('collectQueries Done');
    await collectActions(fakeHoursDelta, dbConfigs);
    console.log('collectActions Done');
  } catch (err) {
    logger.error('No connection strings found. Exiting...');
    // process.exit(1);
  }
};

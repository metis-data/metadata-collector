import { logger } from './../common/logging';
import collectActions from './../actions/actions';
import collectQueries from './../queries/queries';


export const runMain = async (fakeHoursDelta = 0) => {
  try {
     await collectQueries(fakeHoursDelta, null);
     await collectActions(fakeHoursDelta, null);
  } catch (err) {
    logger.error('No connection strings found. Exiting...');
    // process.exit(1);
  }
};

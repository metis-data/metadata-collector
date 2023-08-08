require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
import wtf = require('wtfnode');
import {isDebug, SQL_PLAN_COLLECTOR_INTERVAL}  from './consts';
import { logger } from './logging';
import { run } from './metrix';
import { setup } from './setup';
import ScheduledJob  from './utils/scheduled-job';
import slowQueryLogPlanCollector from './slow-query-log';

let connections: any;

async function app(hostedOnAws?: any) {
  logger.info('app is staring');
  return setup()
    .then(async (_connections: any) => {
      connections = _connections;
      logger.debug('app setup has completed');
      logger.debug('app is about to run');
      const response = await run(0, _connections, undefined);
      logger.debug('app has completed the running');
      return response;
    })
    .then(() => {
      if (isDebug()) {
        wtf.dump();
      }
      logger.info('app has finished execution');
      if (hostedOnAws) {
        process.exit(0);
      }
    })
    .catch((e: any) => logger.error('app has failed', e));
}

export async function main() {
  try {
    const scheduledJob = new ScheduledJob(async () => {
      try {
        logger.info('scheduledJob - start');
        const results = await app();
        logger.info('scheduledJob - end');
        return results || true;
      }
      catch (e) {
        logger.error('scheduledJob - error: ', e);
        return false;
      }
    }, 1);

    const planCollectionJob = new ScheduledJob(async () => {
      try {
        logger.info('planCollectionJob - start');
        if (!connections) {
          connections = await setup();
        }
        const results = await slowQueryLogPlanCollector(0, connections);
        logger.info('planCollectionJob - end');
        return results || true;
      }
      catch (e) {
        logger.error('planCollectionJob - error: ', e);
        return false;
      }
    }, SQL_PLAN_COLLECTOR_INTERVAL);

    await Promise.allSettled([scheduledJob.start(), planCollectionJob.start()]);

  }
  catch (e) {
    logger.error('error: ', e);
  }
}




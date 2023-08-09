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

export async function main(hostedOnAws?: any) {
  return setup()
    .then(async (_connections: any) => {
   
    const scheduledJob = new ScheduledJob(async () => {
      try {
        const results = await run(0, connections, undefined);
        return results || true;
      }
      catch (e) {
        logger.error('scheduledJob - error: ', e);
        return false;
      }
    }, 1);

    const planCollectionJob = new ScheduledJob(async () => {
      try {
        const results = await slowQueryLogPlanCollector(0, connections);
        return results || true;
      }
      catch (e) {
        logger.error('planCollectionJob - error: ', e);
        return false;
      }
    }, SQL_PLAN_COLLECTOR_INTERVAL);

    await Promise.allSettled([scheduledJob.start(), planCollectionJob.start()]);

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



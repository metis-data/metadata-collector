require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
import wtf = require('wtfnode');
import {ACTION_INTERVAL, isDebug, SQL_PLAN_COLLECTOR_INTERVAL}  from './consts';
import { logger } from './logging';
import { run } from './metrix';
import { setup } from './setup';
import ScheduledJob  from './utils/scheduled-job';
import slowQueryLogPlanCollector from './slow-query-log';

async function main(hostedOnAws = false) {
  logger.info('app is staring');
  return setup()
    .then(async (_connections) => {
      let runAll = true;
      const runnerJob = new ScheduledJob(async () => {
        try {
          logger.info('runnerJob - start');

          const result = await run(runAll, _connections, undefined);

          runAll = false;

          return result || true;
        } catch (e) {
          logger.error('runnerJob - error: ', e);
          return false;
        }
      }, ACTION_INTERVAL);

      const slowQueryLogJob = new ScheduledJob(async () => {
        try {
          logger.info('planCollectionJob - start');
          const results = await slowQueryLogPlanCollector(_connections);
          return results || true;
        } catch (e) {
          logger.error('planCollectionJob - error: ', e);
          return false;
        }
      }, SQL_PLAN_COLLECTOR_INTERVAL);

      
    await Promise.allSettled([slowQueryLogJob.start(), runnerJob.start()]);
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
    .catch((e) => logger.error('error:', e));
}

module.exports = main;

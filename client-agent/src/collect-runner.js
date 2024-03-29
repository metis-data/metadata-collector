require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
const wtf = require('wtfnode');
const { isDebug, SQL_PLAN_COLLECTOR_INTERVAL, ACTION_INTERVAL, AGENT_ENVIRONMENT, AgentEnvsEnum} = require('./consts');
const { logger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const ScheduledJob = require('./utils/scheduled-job');
const slowQueryLogPlanCollector = require('./slow-query-log');

async function main(hostedOnAws = false) {
  logger.info('app is staring');
  return setup()
    .then(async (_connections) => {
      let runAll = true;
      const runnerJob = new ScheduledJob(async () => {
        try {
          logger.info('runnerJob - start');

          const result = await run(runAll, _connections);

          runAll = false;

          return result || true;
        } catch (e) {
          logger.error('runnerJob - error: ', e);
          return false;
        }
      }, ACTION_INTERVAL);

      const slowQueryLogJob = AGENT_ENVIRONMENT === AgentEnvsEnum.NON_PROD
        ? new ScheduledJob(async () => {
            try {
              logger.info('planCollectionJob - start');
              const results = await slowQueryLogPlanCollector(_connections);
              return results || true;
            } catch (e) {
              logger.error('planCollectionJob - error: ', e);
              return false;
            }
          }, SQL_PLAN_COLLECTOR_INTERVAL)
        : undefined;

    slowQueryLogJob
      ? await Promise.allSettled([slowQueryLogJob.start(), runnerJob.start()])
      : await Promise.allSettled([runnerJob.start()]);
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

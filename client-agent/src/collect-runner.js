require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
const wtf = require('wtfnode');
const { isDebug, SQL_PLAN_COLLECTOR_INTERVAL } = require('./consts');
const { logger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const ScheduledJob = require('./utils/scheduled-job');
const slowQueryLogPlanCollector = require('./slow-query-log');


async function app(hostedOnAws) {
  logger.info('app is staring');
  return setup()
    .then(async (_connections) => {
      const scheduledJob = new ScheduledJob(async () => {
        try {
          return (await run(0, _connections)) || true;
        }
        catch (e) {
          logger.error('scheduledJob - error: ', e);
          return false;
        }
      }, ACTION_INTERVAL);

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

      return Promise.allSettled([scheduledJob.start(), planCollectionJob.start()]);
      
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

// Graceful shutdown
const gracefulShutdown = () => {
  logger.warn('Received SIGTERM. Starting graceful shutdown...');
  
  // Close the PostgreSQL connection pool
  pool.end()
    .then(() => {
      console.log('PostgreSQL connection pool closed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error closing PostgreSQL connection pool:', err);
      process.exit(1); // Exit with an error code to indicate a problem
    });
};

module.exports = app;

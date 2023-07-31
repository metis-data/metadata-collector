require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
const wtf = require('wtfnode');
const { isDebug } = require('./consts');
const { logger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const ScheduledJob = require('./utils/scheduled-job');
const slowQueryLogPlanCollector = require('./slow-query-log');

let connections;

async function app(hostedOnAws) {
  logger.info('app is staring');
  return setup()
    .then(async (_connections) => {
      connections = _connections;
      logger.debug('app setup has completed');
      logger.debug('app is about to run');
      const response = await run(0, _connections);
      logger.debug('app has completed the running');
      logger.debug('app - calling connections.closeAllConnections');
      await _connections.closeAllConnections();
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
    .catch((e) => logger.error('app has failed', e));
}

async function main() {
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
    }, 60);

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
    }, 1);

    await Promise.allSettled([scheduledJob.start(), planCollectionJob.start()]);

  }
  catch (e) {
    logger.error('error: ', e);
  }
}


module.exports = main;

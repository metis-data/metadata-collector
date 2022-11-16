const { logger, winstonLogger } = require('./logging');
const { run } = require('./metrix');

const COLLECT_RUNNER = 'collect runner measurement';
winstonLogger.profile(COLLECT_RUNNER);

run()
  .finally(() => {
    winstonLogger.profile(COLLECT_RUNNER);
  })
  .catch((e) => logger.error('runner has failed', e));

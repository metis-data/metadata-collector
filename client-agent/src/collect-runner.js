const wtf = require('wtfnode');
const { logger, winstonLogger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');

console.log('First dump');
wtf.dump();

const COLLECT_RUNNER = 'collect runner measurement';

winstonLogger.profile(COLLECT_RUNNER);

setup()
  .then(run)
  .catch((e) => logger.error('runner has failed', e))
  .finally(() => {
    winstonLogger.profile(COLLECT_RUNNER);
    wtf.dump();
    // process.exit(0);
  });

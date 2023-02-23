const wtf = require('wtfnode');
const { CRON_LOCAL_RUNNING_EXP } = require('./consts');
const { logger, winstonLogger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const { isHostedOnAws } = require('./utilities/environment-utility');

const COLLECT_RUNNER = 'collect runner measurement';

winstonLogger.profile(COLLECT_RUNNER);

(async () => {
  try {
    const hostedOnAws = await isHostedOnAws();
    if (!hostedOnAws) {
      const cron = require('node-cron');
      cron.schedule(CRON_LOCAL_RUNNING_EXP, () => {
        app(hostedOnAws);
      }, {
        runOnInit: true
      });
    }
    else {
      app(hostedOnAws);
    }
  }
  catch (e) {
    logger.error('error: ', e);
    process.exit(1);
  }
})()

function app(hostedOnAws) {
  return setup()
    .then(run)
    .catch((e) => logger.error('runner has failed', e))
    .finally(() => {
      winstonLogger.profile(COLLECT_RUNNER);
      wtf.dump();
      if (hostedOnAws) {
        process.exit(0);
      }
    });
}
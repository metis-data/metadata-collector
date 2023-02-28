const wtf = require('wtfnode');
const { CRON_LOCAL_RUNNING_EXP } = require('./consts');
const { logger, winstonLogger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const { isHostedOnAws } = require('./utilities/environment-utility');

(async () => {
  try {
    const hostedOnAws = await isHostedOnAws();
    if (!hostedOnAws) {
      const cron = require('node-cron');
      cron.schedule(CRON_LOCAL_RUNNING_EXP, async () => {
        await app(hostedOnAws);
      }, {
        runOnInit: true
      });
    }
    else {
        await app(hostedOnAws);
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
      wtf.dump();
      if (hostedOnAws) {
        process.exit(0);
      }
    });
}

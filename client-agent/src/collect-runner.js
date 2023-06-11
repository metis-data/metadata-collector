const { CRON_LOCAL_RUNNING_EXP } = require('./consts');
const { logger } = require('./logging');
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

async function app(hostedOnAws) {
  return setup()
    .then(run)
    .catch((e) => logger.error('Runner has failed', e))
    .finally(() => {

      if (hostedOnAws) {
        process.exit(0);
      }
    });
}

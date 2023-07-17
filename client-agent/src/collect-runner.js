require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;

const wtf = require('wtfnode');
const { CRON_LOCAL_RUNNING_EXP, CRON_LOGS_SERVICE_EXP, isDebug } = require('./consts');
const { logger } = require('./logging');
const { run } = require('./metrix');
const { setup } = require('./setup');
const { isHostedOnAws } = require('./utilities/environment-utility');

(async () => {
  try {
    const hostedOnAws = await isHostedOnAws();
      await app(false);

    // if (!hostedOnAws) {
    //   const cron = require('node-cron');
    //   cron.schedule(CRON_LOCAL_RUNNING_EXP, async () => {
    //     await app(hostedOnAws);
    //   }, {
    //     runOnInit: true
    //   });
    // }
    // else {
    //   await app(hostedOnAws);
    // }
    wtf.dump();
  }
  catch (e) {
    logger.error('error: ', e);
    process.exit(1);
  }
})()

async function app(hostedOnAws) {
  return setup()
    .then((connections)=>{
      return run(0, connections)
    })
    .catch((e) => logger.error('Runner has failed', e))
    .finally(() => {

      if (isDebug()) {
        wtf.dump();
      }

      // if (hostedOnAws) {
      //   process.exit(0);
      // }
    });
}

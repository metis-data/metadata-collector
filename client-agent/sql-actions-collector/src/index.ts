import { logger, winstonLogger } from './common/logging';
import { setup } from './common/setup';
import { runMain } from './runner/runner';
const COLLECT_RUNNER = 'collect runner measurement';
winstonLogger.profile(COLLECT_RUNNER);

const main = async () => {
  try {
    await setup();
    await runMain();
  } catch (error) {
    logger.error('Error run Meta data collector', error);
  } finally {
    winstonLogger.profile(COLLECT_RUNNER);
  }
};

main().then(() => {});

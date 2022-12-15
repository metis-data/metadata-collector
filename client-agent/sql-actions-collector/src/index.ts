import { logger } from './common/logging';
import { setup } from './common/setup';
import { runMain } from './runner/runner';

const main = async () => {
  await setup();
  await runMain()
    .then(() => {})
    .catch((err) => {
      logger.error(err.message);
    });
};

main();

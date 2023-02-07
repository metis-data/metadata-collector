import { logger } from '../common/logging';
import { setup } from '../common/setup';
import { runMain } from '../runner/runner';

const MAX_DELTA_DAYS = process.argv.length === 3 ? parseInt(process.argv[2], 10) : 14;
process.argv = [process.argv[0], process.argv[1]];

const simulate = async () => {
  await setup();

  for (let deltaHour = 1; deltaHour <= MAX_DELTA_DAYS * 24; deltaHour += 1) {
    await runMain(deltaHour);
  }
};

//> ??
simulate()
  .then(() => {})
  .catch((err) => {
    logger.error(err.message);
  });
// <<
export default simulate;

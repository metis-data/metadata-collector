const { run } = require('./metrix');
const { logger } = require('./logging');
const { setup } = require('./setup');

const MAX_DELTA_DAYS = process.argv.length === 3 ? parseInt(process.argv[2], 10) : 14;
process.argv = [process.argv[0], process.argv[1]];

async function simulate() {
  await setup();

  for (let deltaHour = 1; deltaHour <= MAX_DELTA_DAYS * 24; deltaHour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await run(deltaHour);
  }
}

simulate()
  .catch(logger.error);

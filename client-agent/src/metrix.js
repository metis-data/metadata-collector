require('dotenv').config();
const { makeInternalHttpRequest } = require('./http');
const { WEB_APP_REQUEST_OPTIONS } = require('./consts');

const { logger } = require('./logging');
const { getConnectionConfigs } = require('./connections/utils');
const { collectActions } = require('./actions');
const { collectMetrics } = require('./metrics');
const { SilentError } = require('./config/error');

// eslint-disable-next-line max-len
const collectRunnerAsync = async (runAll, connections) => {
  // eslint-disable-next-line max-len
  const collectingActionPromises = [
    {
      name: "Action",
      fn: collectActions,
    },
    {
      name: "Metric",
      fn: collectMetrics,
    }
  ].map(async (collector) => {
    const collectorName = collector.name;
    logger.info(`${collectorName}'s collector has been started.`);
    let collectorResult = {};
    try {
      collectorResult = await collector.fn(runAll, connections);
    } catch (error) {
      if (error && !(error instanceof SilentError)) {
        logger.error(`${collectorName}'s collector has failed.`, { error });
      }
    } finally {
      logger.info(`${collectorName}'s collector has finished.`);
    }

    return collectorResult;
  });

  return await Promise.allSettled(collectingActionPromises);
};

async function run(runAll, connections) {
  const dbConfigs = await getConnectionConfigs();

  const pmcPingResult = await Promise.allSettled(
    dbConfigs.map(({ database: db_name, host: db_host, port }) =>
      makeInternalHttpRequest(
        {
          db_name,
          db_host,
          port: port.toString(),
          rdbms: 'postgres',
        },
        { ...WEB_APP_REQUEST_OPTIONS, path: '/api/pmc-device' },
      ),
    ),
  );

  logger.debug('MMC Ping result', { pmcPingResult });

  return await collectRunnerAsync(runAll, connections);
}

module.exports = {
  run,
};

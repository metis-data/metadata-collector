require('dotenv').config();
const { makeInternalHttpRequest } = require('./http');
const { WEB_APP_REQUEST_OPTIONS } = require('./consts');
const { logger } = require('./logging');
const { getConnectionConfigs } = require('./connections/utils');
const { collectActions } = require('./actions');
const { collectQueries } = require('./queries');
const { collectMetrics } = require('./metrics');
const { SilentError } = require('./config/error');

// eslint-disable-next-line max-len
const collectRunnerAsync = async (fakeHoursDelta: any, connections: any, additionalCollectors: any) => {
  // eslint-disable-next-line max-len
  const collectingActionPromises = [
    collectQueries,
    collectActions,
    collectMetrics,
    ...(additionalCollectors || []),
  ].map(async (collectFn) => {
    const collectorName = collectFn.name;
    logger.info(`Collector ${collectorName} has been started.`);
    let collectorResult = {};
    try {
      collectorResult = await collectFn(fakeHoursDelta, connections);
    } catch (error) {
      if (error && !(error instanceof SilentError)) {
        logger.error(`Collector ${collectorName} has failed.`, { error });
      }
    } finally {
      logger.info(`Collector ${collectorName} has just finished.`);
    }

    return collectorResult;
  });

  return await Promise.allSettled(collectingActionPromises);
};

async function run(fakeHoursDelta = 0, connections: any, additionalCollectors: any) {
  const dbConfigs: any = await getConnectionConfigs();

  const pmcPingResult = await Promise.allSettled(
    dbConfigs.map(({ database: db_name, host: db_host, port }: any) =>
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

  return await collectRunnerAsync(fakeHoursDelta, connections, additionalCollectors);
}

export  {
  run
};

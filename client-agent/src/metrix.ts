require('dotenv').config();
import { makeInternalHttpRequest } from './http';
import { WEB_APP_REQUEST_OPTIONS } from './consts';
import { logger } from './logging';
import { getConnectionConfigs } from './connections/utils';
import { collectActions } from './actions';
import { collectQueries } from './queries';
import { collectMetrics } from './metrics';
import { SilentError } from './config/error';

// eslint-disable-next-line max-len
const collectRunnerAsync = async (runAll: any, connections: any, additionalCollectors: any) => {
  // eslint-disable-next-line max-len
  const collectingActionPromises = [
    collectActions,
    collectMetrics,
    ...(additionalCollectors || []),
  ].map(async (collectFn) => {
    const collectorName = collectFn.name;
    logger.info(`Collector ${collectorName} has been started.`);
    let collectorResult = {};
    try {
      collectorResult = await collectFn(runAll, connections);
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

async function run(runAll: any, connections: any, additionalCollectors: any) {
  const dbConfigs = await getConnectionConfigs();

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

  return await collectRunnerAsync(runAll, connections, additionalCollectors);
}

export  {
  run
};

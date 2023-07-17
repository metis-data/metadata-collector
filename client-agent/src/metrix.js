const { makeInternalHttpRequest } = require('./http');
const { WEB_APP_REQUEST_OPTIONS } = require('./consts');

require('dotenv').config();

const { logger } = require('./logging');
const { getConnectionConfigs } = require('./connections/utils');
const { collectActions } = require('./actions');
const { collectQueries } = require('./queries');
const { collectMetrics } = require('./metrics');
const DatabaseConnectionsManager = require('./connections/database-manager');

// eslint-disable-next-line max-len
const collectRunnerAsync = async (fakeHoursDelta, connections, additionalCollectors) => {
  // eslint-disable-next-line max-len
  const collectingActionPromises = [collectQueries, collectActions, collectMetrics, ...(additionalCollectors||[])].map(
    (collectFn) => {
      collectFn(fakeHoursDelta, connections).catch((e) => logger.error("Couldn't run collect runner.", e));
    },
  );

  return await Promise.allSettled(collectingActionPromises);
};

async function run(fakeHoursDelta = 0, connections, additionalCollectors) {
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

  return await collectRunnerAsync(fakeHoursDelta, connections, additionalCollectors);
}

module.exports = {
  run,
}

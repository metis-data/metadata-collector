const { createSubLogger } = require('./logging');

const logger = createSubLogger('slow-query-log');

const takeActionPerConnection = async (connection) => {
  try {
      const results = await connection.collectSpansFromSlowQueryLog() || false;
      logger.debug('takeAction - results: ', results);
      return results;
  } catch (e) {
    logger.error('Slow query log error: ', e);
    return false;
  }
};

async function collectPlans(connections) {
  const promiseArr = connections.map(takeActionPerConnection);

  const responses = await Promise.allSettled(promiseArr);

  const results = responses.map((responsePromise) =>
    responsePromise.status === 'fulfilled' && responsePromise.value ? responsePromise.value : [],
  );

  return results;
}

module.exports = collectPlans;

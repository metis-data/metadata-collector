// const { makeHttpRequest } = require('../http');
const { IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC } = require('../consts');
const Errors = require('../config/error');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('env-utility');

async function isHostedOnAws() {
  try {
    const { ECS_CONTAINER_METADATA_URI_V4 } = process?.env;
    if (!ECS_CONTAINER_METADATA_URI_V4) {
      return false;
    }
    const url = `${ECS_CONTAINER_METADATA_URI_V4}/task`;
    const httpMethod = 'GET';

    // await makeHttpRequest(url, httpMethod, null, null, IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC);
    return true;
  } catch (e) {
    switch (e.message) {
      case Errors.REQUEST_TIMEOUT:
        return false;
      default:
        logger.error(e);
        return false;
    }
  }
}

module.exports = {
  isHostedOnAws,
};

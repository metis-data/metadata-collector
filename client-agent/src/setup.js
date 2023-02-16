const { loggingSetup, logger, loggerExit } = require('./logging');

const {
  API_KEY,
  API_GATEWAY_HOST,
  API_GATEWAY_PORT,
  API_GATEWAY_PATH,
  WEB_APP_HOST,
  WEB_APP_PORT,
} = require('./consts');

function exit(msg, code) {
  loggerExit(msg);
  if (code) {
    process.exit(code);
  }
}

async function setup() {
  await loggingSetup();

  process.on('uncaughtException', (error, source) => {
    try {
      logger.error('uncaughtException', { error, source });
    } catch (err) {
      /* If logger is failing too, there is nothing we would like to do */
    }
    exit('Uncaught Exception Exiting ...', 1);
  });

  process.on('SIGINT', () => {
    exit('SIGINT signal received, exiting ...', 1);
  });

  process.on('SIGTERM', () => {
    exit('SIGTERM signal received, exiting ...', 1);
  });

  process.on('exit', (code) => {
    exit(`Process Exiting code: ${code}...`);
  });

  const requiredEnvironmentVariables = [
    [API_KEY, 'API Key'],
    [API_GATEWAY_HOST, 'API Gateway Host'],
    [API_GATEWAY_PORT, 'API Gateway Port'],
    [API_GATEWAY_PATH, 'API Gateway Path'],
    [WEB_APP_HOST, 'Web app api Host'],
    [WEB_APP_PORT, 'Web app api port'],
  ];
  const wrong = requiredEnvironmentVariables.find((x) => !x[0]);
  if (wrong) {
    logger.error(`${wrong[1]} is not defined. Exiting ...`);
    throw new Error(`Could not setup PMC as expected, ${wrong[1]} is not defined.`);
  }
}

module.exports = {
  setup,
};

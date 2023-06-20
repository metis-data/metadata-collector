const { loggingSetup, logger, loggerExit } = require('./logging');
const {
  API_KEY,
} = require('./consts');
const { getConnectionStrings } = require('./secret');
const Errors = require('./config/error');

function exit(msg, code) {
  loggerExit(msg);
  if (code) {
    process.exit(code);
  }
}

function _loadConfigFile() {
  try {
    logger.info('_loadConfigFile - start');
    logger.debug('_loadConfigFile - looking for metis-manifest.json file');
    const manifest = require('./metis-manifest.json');
    const { environment, provider, resource, provider_metadata } = manifest;
    globalThis['metis_config'] = {
      metis_environment: environment,
      metis_provider: provider,
      metis_resource: resource,
      provider_metadata,
    }
    logger.debug(`_loadConfigFile - globalThis['metis_config']: `, globalThis['metis_config']);
    logger.info('_loadConfigFile - end');
    return;
  }
  catch (e) {
    logger.error(`${Errors.COULDNT_LOAD_CONFIG_FILE} `, e);
  }
}

async function setup() {
  await loggingSetup();
  _loadConfigFile();
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

  try {
    DB_CONNECTION_STRINGS = await getConnectionStrings();

    const requiredEnvironmentVariables = [
      [API_KEY, 'API Key'],
      [DB_CONNECTION_STRINGS, 'Conenction string'],
    ];

    const wrong = requiredEnvironmentVariables.find((x) => !x[0]);
    if (wrong) {
      throw new Error(`Could not setup MMC as expected, ${wrong[1]} is not defined.`);
    }

  } catch (err) {
    logger.error('Exiting...', err);
    process.exit(1);
  }
}

module.exports = {
  setup,
};

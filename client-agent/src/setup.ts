import { loggingSetup, logger, loggerExit } from './logging';
import { API_KEY } from './consts';
import { getConnectionStrings } from './connections/utils';
import { DatabaseConnectionsManager } from './connections/database-manager';

function exit(msg: any, code: any) {
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

  process.on('exit', (code: any) => {
    exit(`Process Exiting code: ${code}...`, code);
  });

  try {
    const DB_CONNECTION_STRINGS = await getConnectionStrings();

    const requiredEnvironmentVariables = [
      [API_KEY, 'API Key'],
      [DB_CONNECTION_STRINGS, 'Conenction string'],
    ];

    
    const wrong = requiredEnvironmentVariables.find((x) => !x[0]);
    if (wrong) {
      throw new Error(`Could not setup MMC as expected, ${wrong[1]} is missing.`);
    }

    const databaseConnectionsManager = await DatabaseConnectionsManager.create();
    
    if (databaseConnectionsManager.connections.size === 0) {
      throw new Error(`Could not setup MMC as expected, database schema are worngֿ\n Value: ${DB_CONNECTION_STRINGS}`);
    }

    return databaseConnectionsManager;
  } catch (err) {
    logger.error('Exiting...', err);
    process.exit(1);
  }
}

export  {
  setup,
};

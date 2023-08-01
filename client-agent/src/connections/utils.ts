const connectionParser = require('connection-string-parser');
const { logger } = require('../logging');

const DB_CONNECT_TIMEOUT = 5000;

let DB_CONNECTION_STRINGS: any = null;

async function getConnectionStrings() {
  if (DB_CONNECTION_STRINGS) {
    return DB_CONNECTION_STRINGS;
  }

  // The DB_CONNECTION_STRINGS is a semi-colon separated database connection strings. E.g.,
  // export DB_CONNECTION_STRINGS=postgresql://postgres:postgres@1.2.3.4/example_db_name_pg;postgresql://user1234:password1234@www.sitename.com/db_name_1234
  if (process.env.DB_CONNECTION_STRINGS) {
    logger.info(`The connection string load succesfully: ${process.env.DB_CONNECTION_STRINGS}`)
    DB_CONNECTION_STRINGS = process.env.DB_CONNECTION_STRINGS;
    return DB_CONNECTION_STRINGS;
  }
  logger.info('Trying to fetch connection string from secret');

  try {
    const { AWS_REGION } = process.env;
    const {
      SecretsManagerClient,
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');

    const secretsManager = new SecretsManagerClient({ region: AWS_REGION });

    const params = { SecretId: process.env.CONNECTION_STRINGS_SECRET };
    const command = new GetSecretValueCommand(params);
    const data = await secretsManager.send(command);
    DB_CONNECTION_STRINGS = data.SecretString;
  } catch (error) {
    logger.error('Coudlnt get connection string from secret', error);
  }
  return DB_CONNECTION_STRINGS;
}

const connectionStringParser = new connectionParser.ConnectionStringParser({
  scheme: 'postgresql',
  hosts: [],
});

const parsePostgresConnection = (dbConnectionString: any) => {
  const dbConnectionObject = connectionStringParser.parse(dbConnectionString);
  const condition = dbConnectionObject && dbConnectionObject.hosts && dbConnectionObject.hosts[0];
  const host = condition ? dbConnectionObject.hosts[0].host : undefined;

  let port;
  try {
    port = condition ? Number.parseInt(dbConnectionObject.hosts[0].port) : undefined;
  } catch (error) {
    port = 5432;
  }

  return {
    user: dbConnectionObject.username || dbConnectionObject.options.user,
    password: dbConnectionObject.password || dbConnectionObject.options.password,
    database: dbConnectionObject.endpoint,
    host,
    port: port || 5432,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT,
  };
};

const getConnectionConfigs = async () => {
  return (await getConnectionStrings()).split(';').filter(Boolean).map(parsePostgresConnection);
};

export  {
  getConnectionStrings,
  getConnectionConfigs,
  parsePostgresConnection,
};

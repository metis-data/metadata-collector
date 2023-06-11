
let DB_CONNECTION_STRINGS = null;

async function getConnectionStrings() {
  // The DB_CONNECTION_STRINGS is a semi-colon separated database connection strings. E.g.,
  // export DB_CONNECTION_STRINGS=postgresql://postgres:postgres@1.2.3.4/example_db_name_pg;postgresql://user1234:password1234@www.sitename.com/db_name_1234
  if (process.env.DB_CONNECTION_STRINGS) {
    DB_CONNECTION_STRINGS = process.env.DB_CONNECTION_STRINGS;
    return DB_CONNECTION_STRINGS;
  }
  try{
    const { AWS_REGION } = process.env;
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

    const secretsManager = new SecretsManagerClient({ region: AWS_REGION });

    const params = { SecretId: process.env.CONNECTION_STRINGS_SECRET };
    const command = new GetSecretValueCommand(params);
    const data = await secretsManager.send(command);
    DB_CONNECTION_STRINGS = data.SecretString;
  } catch(error){

  }
  return DB_CONNECTION_STRINGS;
}

module.exports = {
  getConnectionStrings,
};

const path = require('path');

const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);
require('dotenv').config();

const EnvironmentsEnum = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
};

const {
  API_KEY,
  API_GATEWAY_HOST = 'ingest.metisdata.io',
  API_GATEWAY_PATH = '/md-collector',
  WEB_APP_HOST = 'app.metisdata.io',
  APP_ENV = EnvironmentsEnum.PRODUCTION,
  NODE_ENV,
  PG_STAT_STATEMENTS_ROWS_LIMIT = 5000,
  IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC = 5,
  DEFAULT_REQUEST_TIMEOUT_IN_SEC = 360,
  CRON_LOCAL_RUNNING_EXP = '0 * * * *',
  CRON_LOGS_SERVICE_EXP = '* * * * *',
  AGENT_ENVIRONMENT = 'non-production',
  METIS_ENVIRONMENT = '',
  METIS_AWS_ACCESS_KEY_ID = '',
  METIS_AWS_SECRET_ACCESS_KEY = '',
  METIS_AWS_REGION = '',
  METIS_PROVIDER_METADATA = '[]',
} = process.env;

let LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const LogLevelEnum = {
  DEBUG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  WARN: 'warn',
};

const AgentEnvsEnum = {
  PROD: 'production',
  NON_PROD: 'non-production',
}

if (LOG_LEVEL) {
  LOG_LEVEL = LOG_LEVEL.toUpperCase();
  const logLevelsKeys = Object.keys(LogLevelEnum);
  if (!logLevelsKeys.includes(LOG_LEVEL)) {
    throw new Error(
      `LOG_LEVEL isn't match to ${JSON.stringify(logLevelsKeys).replaceAll(',', '/')}.`,
    );
  }
}

const API_GATEWAY_PORT = parseInt(process.env.API_GATEWAY_PORT || 443, 10);
const SQL_PLAN_COLLECTOR_INTERVAL = parseInt(process.env.SQL_PLAN_COLLECTOR_INTERVAL_IN_MIN || 1);
const ACTION_INTERVAL = parseInt(process.env.ACTION_INTERVAL_IN_MIN || 1);
const WEB_APP_PORT = parseInt(process.env.WEB_APP_PORT || 443, 10);
const QUERIES_FILE = process.env.QUERIES_FILE || path.join(__dirname, 'queries.yaml');
const ACTIONS_FILE = process.env.ACTIONS || path.join(__dirname, 'actions.yaml');

const HTTPS_TIMEOUT = 30000;

const isDebug = () => {
  return ['1', 'true'].includes(process.env.DEBUG?.toLowerCase());
};

let ENVIRONMENT = APP_ENV || NODE_ENV || EnvironmentsEnum.PRODUCTION;
if (ENVIRONMENT) {
  ENVIRONMENT = ENVIRONMENT.toLowerCase();
  const optionalKeys = Object.values(EnvironmentsEnum);
  if (!optionalKeys.includes(ENVIRONMENT)) {
    throw new Error(
      `APP_ENV or NODE_ENV doesn't match to ${JSON.stringify(optionalKeys).replaceAll(',', '/')}.`,
    );
  }
}

const HTTPS_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST,
  port: API_GATEWAY_PORT,
  path: API_GATEWAY_PATH,
  method: 'POST',
  headers: { 'x-api-key': API_KEY, 'x-api-version': 'v1' },
  timeout: HTTPS_TIMEOUT,
};

const WEB_APP_REQUEST_OPTIONS = {
  host: WEB_APP_HOST,
  port: WEB_APP_PORT,
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

const COLLECTOR_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST,
  port: API_GATEWAY_PORT,
  path: API_GATEWAY_PATH,
  method: 'POST',
  headers: { 'x-api-key': API_KEY, 'x-api-version': 'v2' },
  timeout: HTTPS_TIMEOUT,
};

module.exports = {
  isDebug,
  COLLECTOR_VERSION,
  API_KEY,
  API_GATEWAY_HOST,
  API_GATEWAY_PORT,
  API_GATEWAY_PATH,
  HTTPS_REQUEST_OPTIONS,
  QUERIES_FILE,
  ACTIONS_FILE,
  TAGS,
  WEB_APP_REQUEST_OPTIONS,
  WEB_APP_HOST,
  WEB_APP_PORT,
  LOG_LEVEL,
  LogLevelEnum,
  AgentEnvsEnum,
  ENVIRONMENT,
  EnvironmentsEnum,
  PG_STAT_STATEMENTS_ROWS_LIMIT,
  IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC,
  DEFAULT_REQUEST_TIMEOUT_IN_SEC,
  CRON_LOCAL_RUNNING_EXP,
  CRON_LOGS_SERVICE_EXP,
  COLLECTOR_REQUEST_OPTIONS,
  AGENT_ENVIRONMENT,
  METIS_ENVIRONMENT: METIS_ENVIRONMENT?.toLowerCase(),
  METIS_AWS_ACCESS_KEY_ID,
  METIS_AWS_SECRET_ACCESS_KEY,
  METIS_AWS_REGION,
  METIS_PROVIDER_METADATA: JSON.parse(METIS_PROVIDER_METADATA),
  SQL_PLAN_COLLECTOR_INTERVAL,
  ACTION_INTERVAL,
};

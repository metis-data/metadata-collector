const path = require('path');

const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);
require('dotenv').config();

const {
  API_KEY,
  API_GATEWAY_HOST,
  API_GATEWAY_PATH,
  WEB_APP_HOST,
  APP_ENV,
  NODE_ENV,
  PG_STAT_STATEMENTS_ROWS_LIMIT = 300,
  IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC = 5,
  DEFAULT_REQUEST_TIMEOUT_IN_SEC = 10,
} = process.env;

let LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const LogLevelEnum = {
  DEBUG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  WARN: 'warn',
};

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
const WEB_APP_PORT = parseInt(process.env.WEB_APP_PORT || 443, 10);
const QUERIES_FILE = process.env.QUERIES_FILE || path.join(__dirname, 'queries.yaml');
const ACTIONS_FILE = process.env.ACTIONS || path.join(__dirname, 'actions.yaml');

const HTTPS_TIMEOUT = 30000;

let ENVIRONMENT = APP_ENV || NODE_ENV;

const EnvironmentsEnum = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
};

if (ENVIRONMENT) {
  ENVIRONMENT = ENVIRONMENT.toUpperCase();
  const optionalKeys = Object.keys(EnvironmentsEnum);
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
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

const WEB_APP_REQUEST_OPTIONS = {
  host: WEB_APP_HOST,
  port: WEB_APP_PORT,
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

module.exports = {
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
  ENVIRONMENT,
  EnvironmentsEnum,
  PG_STAT_STATEMENTS_ROWS_LIMIT,
  IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC,
  DEFAULT_REQUEST_TIMEOUT_IN_SEC,
};

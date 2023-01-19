require('dotenv').config();

const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);
const { API_KEY, API_GATEWAY_HOST, API_GATEWAY_PATH, WEB_APP_HOST, WEB_APP_PATH, APP_ENV, NODE_ENV } = process.env;
const API_GATEWAY_PORT: any = parseInt((process.env.API_GATEWAY_PORT as any) || 443, 10);
const WEB_APP_PORT: any = parseInt((process.env.WEB_APP_PORT as any) || 443, 10);

let LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const LogLevelEnum = {
  DEUBG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  WARN: 'warn',
};

if (LOG_LEVEL) {
  LOG_LEVEL = LOG_LEVEL.toUpperCase();
  const logLevelsKeys = Object.keys(LogLevelEnum);
  if (!logLevelsKeys.includes(LOG_LEVEL)) {
    throw new Error(`LOG_LEVEL isn't match to ${JSON.stringify(logLevelsKeys).replaceAll(',', '/')}.`);
  }
}

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
    throw new Error(`APP_ENV or NODE_ENV doesn't match to ${JSON.stringify(optionalKeys).replaceAll(',', '/')}.`);
  }
}

const HTTPS_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST || 'ingest-stg.metisdata.io',
  port: API_GATEWAY_PORT || 443,
  path: API_GATEWAY_PATH || '/md-collector',
  method: 'POST',
  headers: { 'x-api-key': process.env.API_KEY },
  timeout: HTTPS_TIMEOUT,
};

const WEB_APP_REQUEST_OPTIONS = {
  host: WEB_APP_HOST,
  port: WEB_APP_PORT,
  path: WEB_APP_PATH,
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

export {
  COLLECTOR_VERSION,
  API_KEY,
  API_GATEWAY_HOST,
  API_GATEWAY_PORT,
  API_GATEWAY_PATH,
  HTTPS_REQUEST_OPTIONS,
  TAGS,
  WEB_APP_REQUEST_OPTIONS,
  WEB_APP_HOST,
  WEB_APP_PORT,
  WEB_APP_PATH,
  LOG_LEVEL,
  LogLevelEnum,
  ENVIRONMENT,
  EnvironmentsEnum,
};

const path = require('path');

const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);

const {
  API_KEY, API_GATEWAY_HOST, API_GATEWAY_PATH,
  WEB_APP_HOST, WEB_APP_PATH,
} = process.env;
const API_GATEWAY_PORT = parseInt(process.env.API_GATEWAY_PORT || 443, 10);
const WEB_APP_PORT = parseInt(process.env.WEB_APP_PORT || 443, 10);
const QUERIES_FILE = process.env.QUERIES_FILE || path.join(__dirname, 'queries.yaml');
const ACTIONS_FILE = process.env.ACTIONS || path.join(__dirname, 'actions.yaml');

const HTTPS_TIMEOUT = 30000;

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
  path: WEB_APP_PATH,
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
  WEB_APP_PATH,
};

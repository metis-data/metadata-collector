const path = require('path');

const COLLECTOR_VERSION = '0.62';
const TAGS = new Set(['schema', 'table', 'index']);

const {
  API_KEY, API_GATEWAY_HOST, API_GATEWAY_PATH,
} = process.env;
const API_GATEWAY_PORT = parseInt(process.env.API_GATEWAY_PORT || 443, 10);
const QUERIES_FILE = process.env.QUERIES_FILE || path.join(__dirname, 'queries.yaml');

const HTTPS_TIMEOUT = 30000;

const HTTPS_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST,
  port: API_GATEWAY_PORT,
  path: API_GATEWAY_PATH,
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

module.exports.COLLECTOR_VERSION = COLLECTOR_VERSION;
module.exports.API_KEY = API_KEY;
module.exports.API_GATEWAY_HOST = API_GATEWAY_HOST;
module.exports.API_GATEWAY_PORT = API_GATEWAY_PORT;
module.exports.API_GATEWAY_PATH = API_GATEWAY_PATH;
module.exports.HTTPS_REQUEST_OPTIONS = HTTPS_REQUEST_OPTIONS;
module.exports.QUERIES_FILE = QUERIES_FILE;
module.exports.TAGS = TAGS;

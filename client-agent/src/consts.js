const path = require('path');

const config = require('config');

const {
  app: {
    api_key: API_KEY,
    aws: {
      request: {
        options: {
          https_timeout: HTTPS_TIMEOUT,
          api_gateway_method: API_GATEWAY_METHOD,
          api_gateway_host: API_GATEWAY_HOST,
          api_gateway_path: API_GATEWAY_PATH,
          api_gateway_port: API_GATEWAY_PORT,
        },
      },
    },
  },
} = config;

const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);

const API_GATEWAY_PORT_NUMBER = parseInt(API_GATEWAY_PORT || 443, 10);

const HTTPS_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST,
  port: API_GATEWAY_PORT_NUMBER,
  path: API_GATEWAY_PATH,
  method: API_GATEWAY_METHOD,
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

module.exports = {
  COLLECTOR_VERSION,
  API_KEY,
  API_GATEWAY_HOST,
  API_GATEWAY_PORT: API_GATEWAY_PORT_NUMBER,
  API_GATEWAY_PATH,
  HTTPS_REQUEST_OPTIONS,
  TAGS,
};


const COLLECTOR_VERSION = '0.63';
const TAGS = new Set(['schema', 'table', 'index']);

const { API_KEY, API_GATEWAY_HOST, API_GATEWAY_PATH, WEB_APP_HOST, WEB_APP_PATH } = process.env;
const API_GATEWAY_PORT: any = parseInt((process.env.API_GATEWAY_PORT as any) || 443, 10);
const WEB_APP_PORT: any = parseInt((process.env.WEB_APP_PORT as any) || 443, 10);


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
};

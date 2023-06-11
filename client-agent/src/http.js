const {  DEFAULT_REQUEST_TIMEOUT_IN_SEC } = require('./consts');
const http = require('http');
const https = require('https');
const axios = require('axios');
const { createSubLogger } = require('./logging');
const logger = createSubLogger('http');

function formatSizeUnits(bytes){
  if      (bytes >= 1073741824) { bytes = (bytes / 1073741824).toFixed(2) + " GB"; }
  else if (bytes >= 1048576)    { bytes = (bytes / 1048576).toFixed(2) + " MB"; }
  else if (bytes >= 1024)       { bytes = (bytes / 1024).toFixed(2) + " KB"; }
  else if (bytes > 1)           { bytes = bytes + " bytes"; }
  else if (bytes == 1)          { bytes = bytes + " byte"; }
  else                          { bytes = "0 bytes"; }
  return bytes;
}

function makeInternalHttpRequest(payload, options, numRetries = 0, ignoreStatusCodes = [], timeout = DEFAULT_REQUEST_TIMEOUT_IN_SEC) {
  const provider = options.port === 443 ? https : http;

  const strinigyJsonPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);

  logger.debug("Sending a request", { options, length: formatSizeUnits(strinigyJsonPayload.length) });
  
  options = {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Content-Length': strinigyJsonPayload.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = provider.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const context = {
          path: options.path,
          status: res.statusCode,
          requestId: res.headers['x-amzn-requestid'], // When used for our backend api
          traceId: res.headers['x-amzn-trace-id'] || res.headers['x-ray-id'], // When used for API Gateway
        };

        if (res.statusCode < 400) {
          resolve({ statusCode: res.statusCode, context, data });
        } else {
          const error = new Error(`Problem with HTTPS request, status code is ${JSON.stringify(context, null, 2)
            }`);

          error.context = context;
          reject({ error, statusCode: res.statusCode, data });
        }
      });
    });

    req.on('error', (error) => {
      if (numRetries === 0) {
        reject(error);
      } else {
        makeInternalHttpRequest(payload, options, numRetries - 1, ignoreStatusCodes)
          .then(resolve)
          .catch(reject);
      }
    });

    req.write(strinigyJsonPayload);

    req.end();
  });
}

function makeHttpRequest(url, method, data, headers, timeout = DEFAULT_REQUEST_TIMEOUT_IN_SEC) {
  return axios({
    method,
    url,
    data,
    headers,
    timeout: timeout * 1000,
    timeoutErrorMessage: 'REQUEST_TIMEOUT',
  });
}

module.exports = {
  makeInternalHttpRequest,
  makeHttpRequest
};

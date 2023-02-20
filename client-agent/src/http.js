const http = require('http');
const https = require('https');

const { logger } = require('./logging');

function directHttpsSend(data, httpRequestOptions) {
  httpRequestOptions = { ...httpRequestOptions, agent: false };
  const provider = httpRequestOptions.port === 443 ? https : http;

  return new Promise((resolve, reject) => {
    const req = provider.request(httpRequestOptions, (res) => {
      logger.debug(`STATUS: ${res.statusCode}`);
      res.setEncoding('utf8');

      let data= ''
      res.on('data', (chunk) => {
        data += chunk;
        logger.debug(`BODY: ${JSON.stringify(chunk)}`, httpRequestOptions);
      });

      if (res.statusCode >= 400) {
        const err = new Error(
          `Problem with HTTPS request, status code is ${JSON.stringify(
            {
              status: res.statusCode,
              requestId: res.headers['x-amzn-requestid'] || res.headers['x-ray-id'], // When used for our backend api
              traceId: res.headers['x-amzn-trace-id'],
            },
            null,
            2,
          )}`,
        );

        err.context = {
          requestId: res.headers['x-amzn-requestid'] || res.headers['x-ray-id'], // When used for our backend api
          traceId: res.headers['x-amzn-trace-id'], // When used for API Gateway
        };
        reject({ err, data });
      } else {
        resolve();
      }
    });

    req.on('error', (e) => {
      reject(new Error(`Problem with HTTPS request: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Reached timeout!'));
    });

    req.setHeader('Content-Type', 'application/json');
    const message = JSON.stringify(data);
    // write data to request body
    req.write(message);
    req.end();
  });
}

function makeHttpRequest(payload, options, numRetries = 3, ignoreStatusCodes = []) {
  const provider = options.port === 443 ? https : http;

  const strinigyJsonPayload = JSON.stringify(payload);
  
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
      let headers = res.headers;

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const context = {
          path: options.path,
          status: res.statusCode,
          requestId: res.headers['x-amzn-requestid'] || res.headers['x-ray-id'], // When used for our backend api
          traceId: res.headers['x-amzn-trace-id'], // When used for API Gateway
        };

        if (res.statusCode < 400) {
          resolve({ statusCode: res.statusCode, headers, context, data });
        } else {
          const error = new Error(`Problem with HTTPS request, status code is ${
            JSON.stringify(context, null, 2)
          }`);

          error.context = context;
          reject({ error, statusCode: res.statusCode, headers, data });
        }
      });
    });

    req.on('error', (error) => {
      if (numRetries === 0) {
        reject(error);
      } else {
        makeHttpRequest(payload, options, numRetries - 1, ignoreStatusCodes)
          .then(resolve)
          .catch(reject);
      }
    });

    req.write(strinigyJsonPayload);

    req.end();
  });
}



module.exports = {
  directHttpsSend,
  makeHttpRequest
};

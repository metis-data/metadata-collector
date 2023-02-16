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

      res.on('data', (chunk) => {
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
        reject(err);
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

module.exports = {
  directHttpsSend,
};

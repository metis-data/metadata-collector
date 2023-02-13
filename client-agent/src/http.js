const http = require('http');
const https = require('https');
const retry = require('retry');

const { logger } = require('./logging');

function directHttpsSend(data, httpRequestOptions, numRetries = 3) {
  // define http or https according the port
  const provider = httpRequestOptions.port === 443 ? https : http;

  // define maximum retries
  const op = retry.operation({ retries: numRetries });

  return new Promise((resolve, reject) => {
    try {
      op.attempt(() => {
        const req = provider.request(httpRequestOptions, (res) => {
          res.setEncoding('utf8');
          const context = {
            status: res.statusCode,
            requestId: res.headers['x-amzn-requestid'] || res.headers['x-ray-id'], // When used for our backend api
            traceId: res.headers['x-amzn-trace-id'],
          };

          logger.debug(`Reponse status for: ${httpRequestOptions.path} is: ${res.statusCode}`, {
            context,
            httpRequestOptions,
          });

          // getting response body
          const data = [];

          res.on('data', (chunk) => {
            data.push(chunk);
          });

          res.on('end', () => {
            logger.info(`Response ended for ${httpRequestOptions.path} `, {
              context,
              httpRequestOptions,
            });
            try {
              const body = JSON.parse(Buffer.concat(data).toString());
              return resolve({ body, context });
            } catch (err) {}
          });

          if (res.statusCode >= 400) {
            const err = new Error('Problem with HTTPS request');
            err.context = context;
            err.httpRequestOptions = httpRequestOptions;

            if (!op.retry(err)) {
              return reject(err);
            }
          }
        });

        req.setHeader('Content-Type', 'application/json');

        req.on('error', (e) => {
          if (!op.retry(e)) {
            const error = new Error(`Problem with request: ${e.message}`);
            error.httpRequestOptions = httpRequestOptions;
            error.payload = data;
            return reject(error);
          }
        });

        req.on('timeout', () => {
          req.destroy();
          const error = new Error('Reached timeout!');
          error.httpRequestOptions = httpRequestOptions;
          return reject(error);
        });

        const message = JSON.stringify(data);

        // write data to request body
        req.write(message);
        req.end();
      });
    } catch (err) {
      err.httpRequestOptions;
      reject(err);
    }
  });
}

module.exports = {
  directHttpsSend,
};

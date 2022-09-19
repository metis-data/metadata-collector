const https = require('https');
const retry = require('retry');

const { logger } = require('./logging');

const NUM_HTTPS_RETRIES = 3;

function directHttpsSend(data, httpRequestOptions) {
  const op = retry.operation({ retries: NUM_HTTPS_RETRIES });
  return new Promise((resolve, reject) => {
    op.attempt(() => {
      const req = https.request(httpRequestOptions, (res) => {
        logger.debug(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          logger.debug(`BODY: ${JSON.stringify(chunk)}`);
        });
        if (res.statusCode >= 400) {
          const err = new Error(`Problem with HTTPS request, status code is ${res.statusCode}`);
          if (!op.retry(err)) {
            err.context = { requestId: res.headers['x-amzn-requestid'], traceId: res.headers['x-amzn-trace-id'] };
            reject(err);
          }
        } else {
          resolve();
        }
      });
      req.on('error', (e) => {
        if (!op.retry(e)) {
          reject(new Error(`Problem with HTTPS request: ${e.message}`));
        }
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Reached timeout!'));
      });
      const message = JSON.stringify(data);
      // write data to request body
      req.write(message);
      req.end();
    });
  });
}

module.exports.directHttpsSend = directHttpsSend;

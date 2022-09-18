const Influx = require('@influxdata/influxdb-client');
const logger = require('pino')();
const Sentry = require('@sentry/serverless');

const {
  org, bucket, token, url, tags, sentryDSN,
} = process.env;
const tagKeys = new Set(tags ? tags.split(',').map((t) => t.trim()) : []);
const writeOptions = { flushInterval: 0 };
Sentry.AWSLambda.init({
  dsn: sentryDSN,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
  logger.info(`Incoming data: ${event.body}`);
  const { requestTimeEpoch } = event.requestContext;
  const apiKey = event.headers['x-api-key'];
  const timestamp = requestTimeEpoch ? new Date(requestTimeEpoch) : new Date();
  const writeApi = new Influx.InfluxDB({ url, token }).getWriteApi(org, bucket, 'ns', writeOptions);
  writeApi.useDefaultTags({ apiKey });
  const points = JSON.parse(event.body).reduce((arr, data) => {
    const { metricName, value, ...rest } = data;
    if (typeof metricName !== 'string') {
      logger.error(`Metric ignored because name is not a string. data: ${JSON.stringify(data)}`);
      return arr;
    }
    if (typeof value !== 'number') {
      logger.error(`Metric ignored because value is not a number. data: ${JSON.stringify(data)}`);
      return arr;
    }
    let point = new Influx.Point(metricName)
      .floatField('value', value)
      .timestamp(timestamp);
    point = Object.entries(rest).reduce(
      (pnt, [k, v]) => {
        if (typeof v !== 'string') {
          logger.error(`Field ${k} ignored because it is not a string: ${JSON.stringify(v)}`);
          return pnt;
        }
        if (tagKeys.has(k)) {
          return pnt.tag(k, v);
        }
        return pnt.stringField(k, v);
      },
      point,
    );
    arr.push(point);
    return arr;
  }, []);
  writeApi.writePoints(points);

  const response = {
    statusCode: 204,
  };
  await writeApi
    .close()
    .then(() => {
      logger.info(`Saved data: ${JSON.stringify(points)}`);
      callback(null, response);
    });
});

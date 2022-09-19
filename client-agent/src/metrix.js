const https = require('https');
const retry = require('retry');
const pg = require('pg');
const process = require('process');
const connectionParser = require('connection-string-parser');
const Sentry = require('@sentry/node');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { randomUUID } = require('crypto');
const { createLogger, format, transports } = require('winston');

require('dotenv').config();

const COLLECTOR_VERSION = '0.5';
const TAGS = new Set(['schema', 'table', 'index']);
const {
  API_KEY, API_GATEWAY_HOST, API_GATEWAY_PATH, SENTRY_DSN, DATADOG_API_KEY, IGNORE_WINSTON_CONSOLE,
  AWS_REGION,
} = process.env;
const API_GATEWAY_PORT = parseInt(process.env.API_GATEWAY_PORT || 443, 10);
const QUERIES_FILE = process.env.QUERIES_FILE || path.join(__dirname, 'queries.yaml');
const NUM_HTTPS_RETRIES = 3;
const HTTPS_TIMEOUT = 30000;
const DB_CONNECT_TIMEOUT = 5000;
const MAX_NUMBER_OF_MOCK_TABLES = 100;
const MOCK = process.env.MOCK === 'true';

const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES = yaml.load(queriesFileContents);
const IGNORE_CURRENT_TIME = process.env.IGNORE_CURRENT_TIME === 'true';

const voidFunc = () => {};

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${DATADOG_API_KEY}&ddsource=nodejs&service=PMC&host=${API_KEY}`,
  ssl: true,
  level: 'debug',
  handleExceptions: true,
};

const httpTransport = new transports.Http(httpTransportOptions);

const winstonConsoleLogger = IGNORE_WINSTON_CONSOLE === 'true' ? null : createLogger({
  level: 'debug',
  exitOnError: false,
  format: format.json(),
  transports: [
    new transports.Console(),
  ],
});

const winstonLogger = createLogger({
  level: 'debug',
  exitOnError: false,
  format: format.json(),
  transports: [
    httpTransport,
  ],
});

const HTTPS_REQUEST_OPTIONS = {
  host: API_GATEWAY_HOST,
  port: API_GATEWAY_PORT,
  path: API_GATEWAY_PATH,
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
  timeout: HTTPS_TIMEOUT,
};

/* eslint-disable no-use-before-define */
const logger = {
  debug: (msg) => { log('DEBUG', process.stdout, msg); winstonLogger.log('debug', msg); },
  info: (msg) => { log('INFO', process.stdout, msg); winstonLogger.log('info', msg); },
  warn: (msg) => { log('WARNING', process.stderr, msg); winstonLogger.log('warn', msg); },
  error: (msg) => {
    log('ERROR', process.stderr, msg);
    winstonLogger.log('error', msg);
    Sentry.captureException(msg);
  },
};
/* eslint-enable no-use-before-define */

const secretsManager = new SecretsManagerClient({ region: AWS_REGION });
let DB_CONNECTION_STRINGS = null;

async function getConnectionStrings() {
  // The DB_CONNECTION_STRINGS is a semi-colon separated database connection strings. E.g.,
  // export DB_CONNECTION_STRINGS=postgresql://postgres:postgres@1.2.3.4/example_db_name_pg;postgresql://user1234:password1234@www.sitename.com/db_name_1234
  if (process.env.DB_CONNECTION_STRINGS) {
    return process.env.DB_CONNECTION_STRINGS;
  }
  const params = { SecretId: process.env.CONNECTION_STRINGS_SECRET };
  const command = new GetSecretValueCommand(params);
  const data = await secretsManager.send(command);
  return data.SecretString;
}

function consoleLog(level, stream, message) {
  if (stream) {
    const time = new Date().getTime() / 1000;
    stream.write(`${time.toFixed(3)} ${level}: ${message}\n`);
  }
}

function exit(msg, code) {
  Sentry.close(2000).then(voidFunc).catch(voidFunc);
  if (msg) {
    logger.info(msg);
  }
  winstonLogger.close();
  winstonLogger.end();
  if (code) {
    process.exit(code);
  }
}

async function setup() {
  /* eslint-disable no-use-before-define */
  if (!DATADOG_API_KEY) {
    log('ERROR', process.stderr, 'Datadog API Key is not defined. We cannot continue.');
  }

  if (!SENTRY_DSN) {
    log('ERROR', process.stderr, 'Sentry DSN is not defined. We cannot continue.');
  }

  if (!DATADOG_API_KEY || !SENTRY_DSN) {
    log('INFO', process.stdout, 'Exiting...');
    process.exit(1);
  }
  /* eslint-enable no-use-before-define */

  // Wait for the logger and it's http transport finish
  (async () => {
    await new Promise((resolve) => {
      httpTransport.on('finish', voidFunc);
      winstonLogger.on('finish', resolve);
    }).then(voidFunc).catch(voidFunc);
  })();

  httpTransport.on('warn', (err) => {
    const errString = `${err}`;
    if (errString.toLowerCase().includes('error') && !errString.includes(' 2')) {
      /* eslint-disable no-use-before-define */
      log('ERROR', process.stderr, `Datadog HTTP logging does not work: "${errString}"`);
      /* eslint-enable no-use-before-define */
    }
  });

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.APP_ENV,
  });
  Sentry.setUser({ id: API_KEY });

  process.on('uncaughtException', (error, source) => {
    try {
      logger.error(`uncaghtException: error is "${error}" and source is "${source}"`);
    } catch (err) {
      /* If logger is failing too, there is nothing we would like to do */
    }
    exit('Exiting ...', 1);
  });

  process.on('SIGINT', () => {
    exit('SIGINT signal received, exiting ...', 1);
  });

  process.on('SIGTERM', () => {
    exit('SIGTERM signal received, exiting ...', 1);
  });

  process.on('exit', () => {
    exit('Exiting ...');
  });

  try {
    DB_CONNECTION_STRINGS = await getConnectionStrings();
  } catch (err) {
    logger.error('No connection strings found. Exiting...');
    process.exit(1);
  }
}

async function run() {
  await setup();

  /* eslint-disable no-use-before-define */
  if (MOCK) {
    mockCollect();
  } else {
    collect();
  }
  /* eslint-enable no-use-before-define */
}

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
          if (!op.retry(new Error(''))) {
            const err = new Error(`Problem with HTTPS request, status code is ${res.statusCode}`);
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

const winstonLevels = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warn',
  ERROR: 'error',
};

function log(level, stream, message) {
  if (winstonConsoleLogger) {
    const levelIsOK = level in winstonLevels;
    winstonConsoleLogger.log(levelIsOK ? winstonLevels[level] : 'error', message);
    if (!levelIsOK) {
      consoleLog(level, stream, message);
      consoleLog('ERROR', stream, `Level "${level}" is not mapped to a winston level. This is a bug.`);
    }
  } else {
    consoleLog(level, stream, message);
  }
}

async function getDBConfigs() {
  const connectionStringParser = new connectionParser.ConnectionStringParser({
    scheme: 'postgresql',
    hosts: [],
  });
  const configs = DB_CONNECTION_STRINGS.split(';').filter(Boolean).map((dbConnectionString) => {
    const dbConnectionObject = connectionStringParser.parse(dbConnectionString);
    const condition = dbConnectionObject && dbConnectionObject.hosts && dbConnectionObject.hosts[0];
    const host = condition ? dbConnectionObject.hosts[0].host : undefined;
    const port = condition ? dbConnectionObject.hosts[0].port : undefined;
    return {
      user: dbConnectionObject.username || dbConnectionObject.options.user,
      password: dbConnectionObject.password || dbConnectionObject.options.password,
      database: dbConnectionObject.endpoint,
      host,
      port: port || 5432,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT,
    };
  });
  return configs;
}

async function processRows(dbConfig, rows) {
  const metricsData = [];
  rows.forEach((row) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r = {};
      r.id = randomUUID();
      r.timestamp = Date.now().toString();
      r.metricName = valueName;
      r.value = parseFloat(row[valueName]);
      TAGS.forEach((tag) => { if (row[tag]) r[tag] = row[tag]; });
      r.db = dbConfig.database;
      r.host = dbConfig.host;
      r.version = COLLECTOR_VERSION;
      metricsData.push(r);
    });
  });
  await directHttpsSend(metricsData, HTTPS_REQUEST_OPTIONS);
  logger.info('Sent query results.');
  logger.debug(`Metrics data is ${JSON.stringify(metricsData)}`);
}

function relevant(timesADay, hour, minutes) {
  const floatTimesADay = parseFloat(timesADay);
  if (!floatTimesADay || floatTimesADay < 0) {
    return false;
  }
  const every = Math.round(24 / floatTimesADay);
  return hour % every === 0 || (minutes === 0 && ((hour + 23) % 24) % every === 0);
}

function getQueriesFromArgv() {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const currentHour = IGNORE_CURRENT_TIME ? 0 : new Date().getHours();
  if (process.argv.length === 2) {
    return Object.keys(QUERIES)
      .filter((key) => relevant(QUERIES[key].times_a_day, currentHour, currentMinutes))
      .map((key) => QUERIES[key].query);
  }
  const qs = [];
  process.argv.slice(2).forEach((q) => { if (q in QUERIES) { qs.push(QUERIES[q].query); } });
  if (qs.length < process.argv.length - 2) {
    const nonEligableQueries = process.argv.slice(2).filter((q) => !(q in QUERIES));
    throw Error(`Error running the CLI. The following are not eligible queries: ${nonEligableQueries}`);
  }
  return qs;
}

async function processResults(queries, dbConfig, results) {
  if (queries.length === 0 || !results) {
    logger.info(queries.length === 0 ? 'No queries are scheduled for this hour.' : 'Queries returned no results');
    return;
  }
  if (queries.length === 1) {
    await processRows(dbConfig, results.rows);
    return;
  }
  await Promise.all(
    results.map(async (r) => { await processRows(dbConfig, r.rows); }),
  );
}

async function collect() {
  const requiredEnvironmentVariables = [
    [API_KEY, 'API Key'], [API_GATEWAY_HOST, 'API Gateway Host'], [API_GATEWAY_PORT, 'API Gateway Port'],
    [API_GATEWAY_PATH, 'API Gateway Path'],
  ];
  const wrong = requiredEnvironmentVariables.find((x) => !x[0]);
  if (wrong) {
    logger.error(`${wrong[1]} is not defined. Exiting ...`);
    return;
  }
  const dbConfigs = await getDBConfigs();
  if (dbConfigs.length === 0) {
    logger.error('No connection strings could be parsed');
    return;
  }
  const theQueries = getQueriesFromArgv();
  if (theQueries.length === 0) {
    logger.info('There are no queries to run for this hour.');
    return;
  }
  const bigQuery = theQueries.join('; ');
  await Promise.allSettled(
    dbConfigs.map(
      async (dbConfig) => {
        let client = null;
        try {
          client = new pg.Client(dbConfig);
          logger.info(`Trying to connect to ${dbConfig.database} ...`);
          await client.connect();
          logger.info(`Connected to ${dbConfig.database}`);
          const res = await client.query(bigQuery);
          logger.info('Obtained query results. Processing results ...');
          await processResults(theQueries, dbConfig, res);
          logger.info('Processing results done.');
        } catch (err) {
          logger.error(err.message, false, err.context);
        } finally {
          if (client) {
            client.end();
          }
        }
      },
    ),
  ).then((results) => {
    const allOK = results.every((result) => result.status === 'fulfilled');
    if (!allOK) {
      logger.error(`Some of the DBs did not get back fine. dbConfigs is: ${dbConfigs} and the results are ${results}`);
    }
  }).catch((err) => {
    logger.err(`Error "${err}" catched in collect.`);
  });
  logger.info('Collection is done.');
}

function sumAscii(s) {
  return s.split('').map((c) => c.charCodeAt(0)).reduce((a, b) => a + b, 0);
}

function randomNatural(n) {
  return Math.floor(Math.random() * n) + 1;
}

function generateMockResults(queriesNumParams) {
  const results = [];
  for (let i = 0; i < queriesNumParams.length; i += 1) {
    const userID = API_KEY;
    const schemaName = `Schema:${userID.substring(0, 8)}`;
    const numTables = (sumAscii(userID) % MAX_NUMBER_OF_MOCK_TABLES) + 1;

    const rows = [];
    for (let j = 0; j < numTables; j += 1) {
      const row = {
        schema: schemaName, table: `Table:${userID.substring(8, 16)}#${j}`,
      };
      for (let k = 0; k < queriesNumParams[i]; k += 1) {
        const n = randomNatural(20);
        row[`Value${k}`] = randomNatural(n * n * n);
      }
      rows.push(row);
    }
    results.push({ rows });
  }
  return results;
}

async function mockCollect() {
  const requiredEnvironmentVariables = [
    [API_KEY, 'API Key'], [API_GATEWAY_HOST, 'API Gateway Host'], [API_GATEWAY_PORT, 'API Gateway Port'],
    [API_GATEWAY_PATH, 'API Gateway Path'],
  ];
  const wrong = requiredEnvironmentVariables.find((x) => !x[0]);
  if (wrong) {
    logger.error(`${wrong[1]} is not defined. Exiting ...`);
    return;
  }
  try {
    const queriesNumParams = [4, 6];
    logger.info('Getting Mock results');
    const results = generateMockResults(queriesNumParams);
    logger.info('Got Mock results. Sending the results ...');
    await processResults(queriesNumParams, { database: `Database:${API_KEY.split(4, 10)}`, host: 'mock.host.com' }, results);
    logger.info('Sending result done.');
  } catch (err) {
    logger.error(err.message, false, err.context);
  }
  logger.info(' Collection is done.');
}

run().then(() => {}).catch((err) => { logger.error(err.message); });

const { createLogger, format, transports } = require('winston');
const Sentry = require('@sentry/node');

const {
  API_KEY, DATADOG_API_KEY, IGNORE_WINSTON_CONSOLE, SENTRY_DSN,
} = process.env;

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${DATADOG_API_KEY}&ddsource=nodejs&service=PMC&host=${API_KEY}`,
  ssl: true,
  level: 'debug',
  handleExceptions: true,
};

const winstonLevels = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warn',
  ERROR: 'error',
};

const voidFunc = () => {};

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

function consoleLog(level, stream, message) {
  if (stream) {
    const time = new Date().getTime() / 1000;
    stream.write(`${time.toFixed(3)} ${level}: ${message}\n`);
  }
}

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

async function loggingSetup() {
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
  });
  Sentry.setUser({ id: API_KEY });
}

function loggerExit(msg) {
  Sentry.close(2000).then(voidFunc).catch(voidFunc);
  if (msg) {
    logger.info(msg);
  }
  winstonLogger.close();
  winstonLogger.end();
}

module.exports.logger = logger;
module.exports.loggingSetup = loggingSetup;
module.exports.loggerExit = loggerExit;

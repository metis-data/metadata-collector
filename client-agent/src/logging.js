const {
  createLogger,
  format,
  transports,
} = require('winston');
const isError = require('lodash.iserror');

const Sentry = require('@sentry/node');
const utils = require('./utils');
const {
  ENVIRONMENT,
  EnvironmentsEnum,
  LOG_LEVEL,
  LogLevelEnum,
} = require('./consts');

const {
  API_KEY,
  IGNORE_WINSTON_CONSOLE,
  DATADOG_API_KEY = 'pubdd790745e9883748e503f312d8cc7197',
  SENTRY_DSN='https://51701d0b4836486eaa874b522dc2fecb@o1173646.ingest.sentry.io/6515773',
} = process.env;

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${DATADOG_API_KEY}&ddsource=nodejs&service=MMC&host=${API_KEY}`,
  ssl: true,
  level: LogLevelEnum[LOG_LEVEL],
  handleExceptions: true,
};

const voidFunc = () => {
};

const getError = (msg, meta) => {
  if (isError(msg)) {
    return msg;
  }

  if (meta) {
    if (Array.isArray(meta)) {
      return meta.find((arg) => {
        if(isError(arg)) return arg;
        if ('error' in arg) return arg.error;
      });
    }

    if ('stack' in meta) {
      return meta;
    }
  }

  return undefined;
};

const httpTransport = new transports.Http(httpTransportOptions);

const logFormat = [
  format.errors({ stack: true }),
  format.timestamp(),
];

if (ENVIRONMENT && 
  ENVIRONMENT !== EnvironmentsEnum.PRODUCTION &&
  ENVIRONMENT !== EnvironmentsEnum.STAGING) {
  logFormat.push(format.prettyPrint());
  logFormat.push(format.splat());
} else {
  logFormat.push(format.json());
}

const consoleTransporter = new transports.Console({ level: LogLevelEnum[LOG_LEVEL] });
const winstonConsoleTransporter = IGNORE_WINSTON_CONSOLE === 'true' ? [] : [consoleTransporter];

const loggers = [];
const createSubLogger = (componentName, logLevel=LogLevelEnum.INFO) => { 
  const winstonLogger = createLogger({
    level: LOG_LEVEL || logLevel,
    defaultMeta: { component: componentName },
    exitOnError: false,
    format: format.combine(...logFormat),
    transports: [
      httpTransport,
      ...winstonConsoleTransporter,
    ],
    exceptionHandlers: [
      httpTransport,
      consoleTransporter,
    ],
    rejectionHandlers: [
      httpTransport,
      consoleTransporter,
    ],
  });

  loggers.push(winstonLogger);

  return {
    debug: (msg, ...meta) => {
      winstonLogger.debug(msg, ...meta);
    },
    info: (msg, ...meta) => {
      winstonLogger.info(msg, ...meta);
    },
    warn: (msg, ...meta) => {
      winstonLogger.warn(msg, ...meta);
    },
    error: (msg, ...meta) => {
      const error = getError(msg, meta);

      if (!error) {
        Sentry.captureMessage(msg, 'error');
      } else {
        if(error && 'error' in error) {
          Sentry.captureException(error.error);
        } else {
          Sentry.captureException(error);
        }
      }

      winstonLogger.error(msg, ...meta);
    },
  };
}
const logger = createSubLogger('app');


function consoleLog(level, stream, message) {
  if (stream) {
    const time = new Date().getTime() / 1000;
    stream.write(`${time.toFixed(3)} ${level}: ${message}\n`);
  }
}

function log(level, stream, message) {
  consoleLog(level || 'INFO', stream, message);
}

async function loggingSetup() {
  /* eslint-disable no-use-before-define */
  if (!DATADOG_API_KEY) {
    logger.error('Datadog API Key is not defined. We cannot continue.');
  }

  if (!SENTRY_DSN) {
    logger.error('Sentry DSN is not defined. We cannot continue.');
  }

  if (!DATADOG_API_KEY || !SENTRY_DSN) {
    logger.info('Exiting...');
    process.exit(1);
  }
  /* eslint-enable no-use-before-define */

  // Wait for the logger and it's http transport finish
  (async () => {
    await new Promise((resolve) => {
      httpTransport.on('finish', voidFunc);
      logger.on('finish', resolve);
    }).then(voidFunc).catch(voidFunc);
  })();

  httpTransport.on('warn', (err) => {
    const errString = `${err}`;
    if (errString.toLowerCase()
      .includes('error') && !errString.includes('Code: 2')) { // We dont care when 2XX status code
      /* eslint-disable no-use-before-define */
      log('ERROR', process.stderr, `Datadog HTTP logging does not work: "${errString}"`);
      /* eslint-enable no-use-before-define */
    }
  });

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: 1.0,
    release: `metadata-collector-agent@${utils.getPackageVersion()}`,
  });

  Sentry.setUser({ id: API_KEY });
}

function loggerExit(msg) {
  Sentry.close(2000)
    .then(voidFunc)
    .catch(voidFunc);

  if (msg) {
    log('INFO', process.stdout, msg);
  }

  loggers.forEach(loggerItem => {
    loggerItem.close();
    loggerItem.end();
  });
}

module.exports = {
  logger,
  createSubLogger,
  loggingSetup,
  loggerExit,
};

import { createLogger, format, transports } from 'winston';
import isError from 'lodash.iserror';
import { getPackageVersion } from './utils';
import { ENVIRONMENT, EnvironmentsEnum, LOG_LEVEL, LogLevelEnum } from './consts';

import * as Sentry from '@sentry/node';
require('dotenv').config();
const { API_KEY, DATADOG_API_KEY, IGNORE_WINSTON_CONSOLE, SENTRY_DSN } = process.env;

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${DATADOG_API_KEY}&ddsource=nodejs&service=PMC&host=${API_KEY}`,
  ssl: true,
  level: LogLevelEnum[LOG_LEVEL],
  handleExceptions: true,
};

const voidFunc = () => {};
const getError = (msg, meta) => {
  if (isError(msg)) {
    return msg;
  }

  if (meta) {
    if (Array.isArray(meta)) {
      return meta.find((arg) => isError(arg));
    }

    if ('stack' in meta) {
      return meta;
    }
  }

  return undefined;
};

const httpTransport = new transports.Http(httpTransportOptions);

// let winstonConsoleLogger =
//   IGNORE_WINSTON_CONSOLE === 'true'
//     ? null
//     : createLogger({
//         level: 'debug',
//         exitOnError: false,
//         format: format.json(),
//         transports: [new transports.Console()],
//       });

const logFormat = [format.splat(), format.errors({ stack: true }), format.timestamp()];

if (ENVIRONMENT !== EnvironmentsEnum.PRODUCTION && ENVIRONMENT !== EnvironmentsEnum.STAGING) {
  logFormat.push(format.prettyPrint());
} else {
  logFormat.push(format.json());
}

const consoleTransporter = new transports.Console({ level: LogLevelEnum[LOG_LEVEL] });
const winstonConsoleTransporter = IGNORE_WINSTON_CONSOLE === 'true' ? [] : [consoleTransporter];

const winstonLogger = createLogger({
  level: LOG_LEVEL,
  exitOnError: false,
  format: format.combine(...logFormat),
  transports: [httpTransport, ...winstonConsoleTransporter],
  exceptionHandlers: [httpTransport, consoleTransporter],
  rejectionHandlers: [httpTransport, consoleTransporter],
});

const logger = {
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
      Sentry.captureException(error);
    }

    winstonLogger.error(msg, ...meta);
  },
};

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
  try {
    if (!DATADOG_API_KEY) {
      logger.error('Datadog API Key is not defined. We cannot continue.');
    }

    if (!SENTRY_DSN) {
      logger.error('Sentry DSN is not defined. We cannot continue.');
    }

    // Wait for the logger and it's http transport finish
    (async () => {
      await new Promise((resolve) => {
        httpTransport.on('finish', voidFunc);
        winstonLogger.on('finish', resolve);
      })
        .then(voidFunc)
        .catch(voidFunc);
    })();

    httpTransport.on('warn', (err) => {
      const errString = `${err}`;
      if (errString.toLowerCase().includes('error') && !errString.includes('Code: 2')) {
        // We dont care when 2XX status code
        logger.error(process.stderr, `Datadog HTTP logging does not work: "${errString}"`);
      }
    });
    const version = getPackageVersion();
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      tracesSampleRate: 1.0,
      release: `metadata-collector-agent@${version}`,
    });
    Sentry.setUser({ id: API_KEY });
  } catch (error) {
    console.log(error);
  }
}

function loggerExit(msg) {
  try {
    if (Sentry) {
      Sentry.close(2000).then(voidFunc).catch(voidFunc);
    }

    if (msg) {
      log('INFO', process.stdout, msg);
    }
    winstonLogger.close();
    winstonLogger.end();
  } catch (error) {
    console.log(error);
  }
}

export { logger, loggingSetup, loggerExit, winstonLogger };

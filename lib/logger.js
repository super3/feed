const winston = require('winston');

// Create singleton logger instance
let logger;

function createLogger() {
  if (logger) {
    return logger;
  }

  // Determine log level based on environment
  const logLevel = process.env.NODE_ENV === 'test' ? 'error' : 
                   process.env.LOG_LEVEL || 'info';

  // Configure format for non-production environments
  const logFormat = process.env.NODE_ENV === 'production' 
    ? winston.format.json()
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      );

  // Configure transports based on environment
  const transports = [];

  if (process.env.NODE_ENV === 'test') {
    // Silent during tests, only error level
    transports.push(new winston.transports.Console({
      level: 'error',
      silent: true
    }));
  } else {
    // Regular console output for development and production
    transports.push(new winston.transports.Console({
      level: logLevel,
      format: logFormat
    }));
  }

  logger = winston.createLogger({
    level: logLevel,
    format: winston.format.json(),
    transports
  });

  return logger;
}

// Export logger instance
module.exports = createLogger();
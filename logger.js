const winston = require("winston");

const logFormat = winston.format.printf(
  info => `${info.timestamp} ${info.level}: ${info.message}`
);
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    logFormat
  ),
  transports: [new winston.transports.Console()]
});

logger.stream = {
  write: message => {
    logger.info(message);
  }
};

module.exports = logger;

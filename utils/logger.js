"use strict";
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Ensure log directory exists
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}
}

const level = (process.env.LOG_LEVEL || 'info').toLowerCase();

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${rest}`;
  })
);

const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.json()
);

const logger = createLogger({
  level,
  transports: [
    new transports.Console({ format: consoleFormat }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      zippedArchive: true,
      format: fileFormat,
      level
    })
  ]
});

// Morgan stream adapter
logger.stream = {
  write: (message) => {
    // message already ends with \n
    logger.http(message.trim());
  }
};

module.exports = logger;

const fs = require('fs');
const path = require('path');

const logLevels = ['silly', 'debug', 'info', 'warn', 'error', 'fatal'];
let currentLogLevel = 'info';

const config = {
    logLevel: currentLogLevel,
    logDir: path.join(process.cwd(), '.logs'),
};

// Ensure the log directory exists
if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
}

// Get today's log file
const getLogFileName = () => {
    const today = new Date().toISOString().split('T')[0];
    return path.join(config.logDir, `${today}.log`);
};

// Helper to write logs to file
const writeToLogFile = (level, ...args) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${level.toUpperCase()}] ${args.join(' ')}\n`;
    fs.appendFileSync(getLogFileName(), message, 'utf8');
};

// Logger function generator
const createLogger = (level) => (...args) => {
    const levelIndex = logLevels.indexOf(level);
    const currentLevelIndex = logLevels.indexOf(config.logLevel);
    writeToLogFile(level, ...args); // Write to file

    if (levelIndex >= currentLevelIndex) {
        console[level](...args); // Output to console
    }
};

// Export log methods
exports.level = (level) => {
    if (logLevels.includes(level)) {
        config.logLevel = level;
    } else {
        throw new Error(`Invalid log level: ${level}. Valid levels are: ${logLevels.join(', ')}`);
    }
};

exports.info = createLogger('info');
exports.error = createLogger('error');
exports.warn = createLogger('warn');
exports.debug = createLogger('debug');
exports.silly = createLogger('silly');
exports.fatal = createLogger('fatal');



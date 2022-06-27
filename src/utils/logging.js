const winston = require('winston');

class logger {
    constructor(initLogLevel = 'info') {
        this.initLogLevel = initLogLevel;
    }

    logging() {
        const logger = winston.createLogger({
            levels: winston.config.syslog.levels,
            level: this.initLogLevel,
            format: winston.format.cli(),
            transports: [ new winston.transports.Console() ]
        });
        return logger;
    }
}

module.exports = { logger }


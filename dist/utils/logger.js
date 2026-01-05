"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
const chalk_1 = __importDefault(require("chalk"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    static instance;
    level;
    timestamps;
    colors;
    constructor(options = {}) {
        this.level = options.verbose ? LogLevel.DEBUG : (options.level ?? LogLevel.INFO);
        this.timestamps = options.timestamps ?? false;
        this.colors = options.colors ?? true;
    }
    static getInstance(options) {
        if (!Logger.instance) {
            Logger.instance = new Logger(options);
        }
        return Logger.instance;
    }
    static configure(options) {
        Logger.instance = new Logger(options);
    }
    formatMessage(level, message) {
        const parts = [];
        if (this.timestamps) {
            parts.push(`[$new Date().toISOString()]`);
        }
        parts.push(`[${level}]`);
        parts.push(message);
        return parts.join(' ');
    }
    colorize(level, text) {
        if (!this.colors)
            return text;
        switch (level) {
            case LogLevel.ERROR:
                return chalk_1.default.red(text);
            case LogLevel.WARN:
                return chalk_1.default.yellow(text);
            case LogLevel.INFO:
                return chalk_1.default.blue(text);
            case LogLevel.DEBUG:
                return chalk_1.default.green(text);
            case LogLevel.TRACE:
                return chalk_1.default.gray(text);
            default:
                return text;
        }
    }
    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(this.colorize(LogLevel.ERROR, this.formatMessage('ERROR', message)), ...args);
        }
    }
    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.colorize(LogLevel.WARN, this.formatMessage('WARN', message)), ...args);
        }
    }
    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.info(this.colorize(LogLevel.INFO, this.formatMessage('INFO', message)), ...args);
        }
    }
    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(this.colorize(LogLevel.DEBUG, this.formatMessage('DEBUG', message)), ...args);
        }
    }
    trace(message, ...args) {
        if (this.level >= LogLevel.TRACE) {
            console.trace(this.colorize(LogLevel.TRACE, this.formatMessage('TRACE', message)), ...args);
        }
    }
    section(title) {
        if (this.level >= LogLevel.INFO) {
            console.log('\n', chalk_1.default.bold.blue(`=== ${title} ===`), '\n');
        }
    }
    success(message) {
        if (this.level >= LogLevel.INFO) {
            console.log(chalk_1.default.green(`✔ ${message}`));
        }
    }
    step(message) {
        if (this.level >= LogLevel.INFO) {
            console.log(chalk_1.default.cyan(`➜ ${message}`));
        }
    }
    inspect(object) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(chalk_1.default.gray(`[DEBUG] #{object}`));
            console.dir(object, { depth: 3, colors: this.colors });
        }
    }
    timer(label) {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`${label} completed in ${duration}ms`);
        };
    }
    buildError(error) {
        if (this.level >= LogLevel.ERROR) {
            const location = error.file
                ? chalk_1.default.cyan(`${error.file}${error.line ? `:${error.line}` : ''}`)
                : chalk_1.default.gray('(no file)');
            const category = error.category ? chalk_1.default.yellow(`[${error.category}] `) : '';
            console.log(` $chalk.red('ERROR:')} ${category}${error.message} ${location}`);
            console.log(`  ${error.message}`);
        }
    }
    table(data, columns) {
        if (this.level >= LogLevel.INFO) {
            if (columns) {
                console.table(data, columns);
            }
            else {
                console.table(data);
            }
        }
    }
}
exports.Logger = Logger;
exports.logger = Logger.getInstance();
//# sourceMappingURL=logger.js.map
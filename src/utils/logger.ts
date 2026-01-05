import chalk from 'chalk';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

export interface LoggerOptions {
    verbose?: boolean;
    level?: LogLevel;
    timestamps?: boolean;
    colors?: boolean;
}

export class Logger {
    private static instance: Logger;
    private level: LogLevel;
    private timestamps: boolean;
    private colors: boolean;

    private constructor(options: LoggerOptions = {}) {
        this.level = options.verbose ? LogLevel.DEBUG : (options.level ?? LogLevel.INFO);
        this.timestamps = options.timestamps ?? false;
        this.colors = options.colors ?? true;
    }

    static getInstance(options?: LoggerOptions): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(options);
        }
        return Logger.instance;
    }

    static configure(options: LoggerOptions): void {
        Logger.instance = new Logger(options);
    }

    private formatMessage(level: string, message: string): string {
        const parts: string[] = [];

        if (this.timestamps) {
            parts.push(`[$new Date().toISOString()]`);
        }

        parts.push(`[${level}]`);
        parts.push(message);

        return parts.join(' ');
    }

    private colorize(level: LogLevel, text: string): string {
        if (!this.colors) return text;

        switch (level) {
            case LogLevel.ERROR:
                return chalk.red(text);
            case LogLevel.WARN:
                return chalk.yellow(text);
            case LogLevel.INFO:
                return chalk.blue(text);
            case LogLevel.DEBUG:
                return chalk.green(text);
            case LogLevel.TRACE:
                return chalk.gray(text);
            default:
                return text;    
        }
    }

    error(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.ERROR) {
            console.error(this.colorize(LogLevel.ERROR, this.formatMessage('ERROR', message)), ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.colorize(LogLevel.WARN, this.formatMessage('WARN', message)), ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.INFO) {
            console.info(this.colorize(LogLevel.INFO, this.formatMessage('INFO', message)), ...args);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(this.colorize(LogLevel.DEBUG, this.formatMessage('DEBUG', message)), ...args);
        }
    }

    trace(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.TRACE) {
            console.trace(this.colorize(LogLevel.TRACE, this.formatMessage('TRACE', message)), ...args);
        }
    }

    section(title: string): void {
        if (this.level >= LogLevel.INFO) {
            console.log('\n', chalk.bold.blue(`=== ${title} ===`), '\n');
        }
    }

    success(message: string): void {
        if (this.level >= LogLevel.INFO) {
            console.log(chalk.green(`✔ ${message}`));
        }
    }

    step(message: string): void {
        if (this.level >= LogLevel.INFO) {
            console.log(chalk.cyan(`➜ ${message}`));
        }
    }

    inspect(object: any): void {
        if (this.level >= LogLevel.DEBUG) {
            console.log(chalk.gray(`[DEBUG] #{object}`));
            console.dir(object, { depth: 3, colors: this.colors });
        }
    }

    timer(label: string): () => void {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`${label} completed in ${duration}ms`);
        };
    }

    buildError(error: { file?: string; line?: number; message: string; category?: string }): void {
        if (this.level >= LogLevel.ERROR) {
            const location = error.file
                ? chalk.cyan(`${error.file}${error.line ? `:${error.line}` : ''}`)
                : chalk.gray('(no file)');
            const category = error.category ? chalk.yellow(`[${error.category}] `) : '';
            console.log(` $chalk.red('ERROR:')} ${category}${error.message} ${location}`);
            console.log(`  ${error.message}`);
        }
    }

    table(data: Record<string, any>[], columns?: string[]): void {
        if (this.level >= LogLevel.INFO) {
            if (columns) {
                console.table(data, columns);
            } else {
                console.table(data);
            }
        }
    }
}

export const logger = Logger.getInstance();
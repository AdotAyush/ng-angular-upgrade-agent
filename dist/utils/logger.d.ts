export declare enum LogLevel {
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
export declare class Logger {
    private static instance;
    private level;
    private timestamps;
    private colors;
    private constructor();
    static getInstance(options?: LoggerOptions): Logger;
    static configure(options: LoggerOptions): void;
    private formatMessage;
    private colorize;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    trace(message: string, ...args: any[]): void;
    section(title: string): void;
    success(message: string): void;
    step(message: string): void;
    inspect(object: any): void;
    timer(label: string): () => void;
    buildError(error: {
        file?: string;
        line?: number;
        message: string;
        category?: string;
    }): void;
    table(data: Record<string, any>[], columns?: string[]): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map
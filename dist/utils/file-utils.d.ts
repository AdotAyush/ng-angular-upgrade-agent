export declare class FileUtils {
    static readJsonFile<T>(filePath: string): Promise<T>;
    static writeJsonFile<T>(filePath: string, data: T): Promise<void>;
    static createBackup(filePath: string): Promise<string>;
    static restoreBackup(backupPath: string, originalPath: string): Promise<void>;
    static ensureDirectory(dirPath: string): Promise<void>;
    static findFiles(dir: string, pattern: RegExp, excludeDirs?: string[]): Promise<string[]>;
    static copyFile(src: string, dest: string): Promise<void>;
    static relativePath(from: string, to: string): string;
    static fileExists(filePath: string): Promise<boolean>;
    static getFileSize(filePath: string): Promise<number>;
    static readFileLines(filePath: string): Promise<string[]>;
    static writeFileLines(filePath: string, lines: string[]): Promise<void>;
}
//# sourceMappingURL=file-utils.d.ts.map
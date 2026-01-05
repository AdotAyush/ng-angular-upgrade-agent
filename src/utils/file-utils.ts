import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export class FileUtils {
    static async readJsonFile<T>(filePath: string): Promise<T> {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    }

    static async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
        const content = JSON.stringify(data, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    static async createBackup(filePath: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.backup-${timestamp}`;
        const content = await readFile(filePath);
        await writeFile(backupPath, content);
        return backupPath;
    }

    static async restoreBackup(backupPath: string, originalPath: string): Promise<void> {
        const content = await readFile(backupPath);
        await writeFile(originalPath, content);
    }

    static async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await mkdir(dirPath, { recursive: true });
        }catch (error: any){
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    static async findFiles(
        dir: string,
        pattern: RegExp,
        excludeDirs: string[] = ['node_modules', '.git', 'dist']
    ): Promise<string[]> {
        const files: string[] = [];

        async function scan(currentDir: string) {
            const entries = await readdir(currentDir);

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry);
                const stats = await stat(fullPath);

                if (stats.isDirectory()) {
                    if (!excludeDirs.includes(entry)) {
                        await scan(fullPath);
                    }
                } else if (stats.isFile() && pattern.test(entry)) {
                    files.push(fullPath);
                }
            }
        }
        await scan(dir);
        return files;
    }

    static async copyFile(src: string, dest: string): Promise<void> {
        const content = await readFile(src);
        await writeFile(dest, content);
    }

    static relativePath(from: string, to: string): string {
        return path.relative(from, to);
    }

    static async fileExists(filePath: string): Promise<boolean> {
        try {
            await stat(filePath);
            return true;
        } catch {
            return false;
        }
    }

    static getFileSize(filePath: string): Promise<number> {
        return stat(filePath).then(stats => stats.size);
    }

    static async readFileLines(filePath: string): Promise<string[]> {
        const content = await readFile(filePath, 'utf-8');
        return content.split(/\r?\n/);
    }

    static async writeFileLines(filePath: string, lines: string[]): Promise<void> {
        const content = lines.join('\n');
        await writeFile(filePath, content, 'utf-8');
    }
}
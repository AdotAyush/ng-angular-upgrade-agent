import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { BuildError, FixResult } from '../types';
import { time } from 'console';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

export class LLMResponseCache {
    private cacheDir: string;
    private enabled: boolean;
    private maxAgeMs: number;

    constructor(projectPath: string, options?: { enabled?: boolean; maxAgeMs?: number }) {
        this.cacheDir = path.join(projectPath, '.ng-upgrade-cache');
        this.enabled = options?.enabled ?? true;
        this.maxAgeMs = options?.maxAgeMs ?? 24 * 60 * 60 * 1000; // Default 24 hours
    }

    async get(error: BuildError, context: string): Promise<FixResult | null> {
        if (!this.enabled) {
            return null;
        }

        try {
            await this.ensureCacheDir();
            const hash = this.hashError(error, context);
            const cacheFile = path.join(this.cacheDir, `${hash}.json`);

            if(!fs.existsSync(cacheFile)) {
                return null;
            }
            const stats = await stat(cacheFile);
            const age = Date.now() - stats.mtimeMs;
            if(age > this.maxAgeMs) {
                fs.unlinkSync(cacheFile);
                return null;
            }

            const content = await readFile(cacheFile, 'utf-8');
            const cached = JSON.parse(content);

            console.log(`  🗄️  Cache hit for error: ${error.message}`);
            return cached.result;;
        }catch {
            return null;
        }
    }

    async set(error: BuildError, context: string, result: FixResult): Promise<void> {
        if(!this.enabled) {
            return;
        }

        try {
            await this.ensureCacheDir();
            const hash = this.hashError(error, context);
            const cacheFile = path.join(this.cacheDir, `${hash}.json`);
            const cached = {
                error: {
                    message: error.message,
                    category: error.category,
                    file: error.file,
                    line: error.line,
                },
                context: context.substring(0, 500),
                result,
                time: new Date().toISOString(),
            };
            
            await writeFile(cacheFile, JSON.stringify(cached, null, 2), 'utf-8');
            console.log(`  🗄️  Caching result for error: ${error.message}`);
        }catch (error){
            console.log(`Could not write cache`);
        }
    }

    async clear(): Promise<void> {
        if(!fs.existsSync(this.cacheDir)) {
            return;
        }
        const files = fs.readdirSync(this.cacheDir);
        for(const file of files) {
            if(file.endsWith('.json')) {
                fs.unlinkSync(path.join(this.cacheDir, file));
            }
        }
        console.log(`  🗄️  Cleared LLM response cache`);
    }

    async getStats(): Promise<{
        size: number;
        entries: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    }> {
        if(!fs.existsSync(this.cacheDir)) {
            return {
                size: 0,
                entries: 0,
                oldestEntry: null,
                newestEntry: null,
            };
        }

        const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
        let totalSize = 0;
        let oldest: Date | null = null;
        let newest: Date | null = null;

        for(const file of files) {
            const filePath = path.join(this.cacheDir, file);
            const stats = await stat(filePath);
            totalSize += stats.size;

            const mtime = stats.mtime;
            if(!oldest || mtime < oldest) {
                oldest = mtime;
            }
            if(!newest || mtime > newest) {
                newest = mtime;
            }
        }

        return {
            size: totalSize,
            entries: files.length,
            oldestEntry: oldest,
            newestEntry: newest,
        };
    }

    private hashError(error: BuildError, context: string): string {
        const normalizedMessage = error.message.replace(/line \d+/g, 'line X').replace(/column \d+/g, 'column Y');
        const key = `${normalizedMessage}|${error.category}|${error.file}|${error.line}|${context}`;
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    private async ensureCacheDir(): Promise<void> {
        if(!fs.existsSync(this.cacheDir)) {
            await mkdir(this.cacheDir, { recursive: true });

            const gitignorePath = path.join(this.cacheDir, '.gitignore');
            await writeFile(gitignorePath, '*\n!.gitignore\n', 'utf-8');
        }
    }
}
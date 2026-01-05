"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMResponseCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const util_1 = require("util");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const stat = (0, util_1.promisify)(fs.stat);
class LLMResponseCache {
    cacheDir;
    enabled;
    maxAgeMs;
    constructor(projectPath, options) {
        this.cacheDir = path.join(projectPath, '.ng-upgrade-cache');
        this.enabled = options?.enabled ?? true;
        this.maxAgeMs = options?.maxAgeMs ?? 24 * 60 * 60 * 1000; // Default 24 hours
    }
    async get(error, context) {
        if (!this.enabled) {
            return null;
        }
        try {
            await this.ensureCacheDir();
            const hash = this.hashError(error, context);
            const cacheFile = path.join(this.cacheDir, `${hash}.json`);
            if (!fs.existsSync(cacheFile)) {
                return null;
            }
            const stats = await stat(cacheFile);
            const age = Date.now() - stats.mtimeMs;
            if (age > this.maxAgeMs) {
                fs.unlinkSync(cacheFile);
                return null;
            }
            const content = await readFile(cacheFile, 'utf-8');
            const cached = JSON.parse(content);
            console.log(`  🗄️  Cache hit for error: ${error.message}`);
            return cached.result;
            ;
        }
        catch {
            return null;
        }
    }
    async set(error, context, result) {
        if (!this.enabled) {
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
        }
        catch (error) {
            console.log(`Could not write cache`);
        }
    }
    async clear() {
        if (!fs.existsSync(this.cacheDir)) {
            return;
        }
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                fs.unlinkSync(path.join(this.cacheDir, file));
            }
        }
        console.log(`  🗄️  Cleared LLM response cache`);
    }
    async getStats() {
        if (!fs.existsSync(this.cacheDir)) {
            return {
                size: 0,
                entries: 0,
                oldestEntry: null,
                newestEntry: null,
            };
        }
        const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
        let totalSize = 0;
        let oldest = null;
        let newest = null;
        for (const file of files) {
            const filePath = path.join(this.cacheDir, file);
            const stats = await stat(filePath);
            totalSize += stats.size;
            const mtime = stats.mtime;
            if (!oldest || mtime < oldest) {
                oldest = mtime;
            }
            if (!newest || mtime > newest) {
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
    hashError(error, context) {
        const normalizedMessage = error.message.replace(/line \d+/g, 'line X').replace(/column \d+/g, 'column Y');
        const key = `${normalizedMessage}|${error.category}|${error.file}|${error.line}|${context}`;
        return crypto.createHash('sha256').update(key).digest('hex');
    }
    async ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            await mkdir(this.cacheDir, { recursive: true });
            const gitignorePath = path.join(this.cacheDir, '.gitignore');
            await writeFile(gitignorePath, '*\n!.gitignore\n', 'utf-8');
        }
    }
}
exports.LLMResponseCache = LLMResponseCache;
//# sourceMappingURL=response-cache.js.map
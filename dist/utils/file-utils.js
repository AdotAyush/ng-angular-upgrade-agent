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
exports.FileUtils = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const stat = (0, util_1.promisify)(fs.stat);
const readdir = (0, util_1.promisify)(fs.readdir);
class FileUtils {
    static async readJsonFile(filePath) {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    static async writeJsonFile(filePath, data) {
        const content = JSON.stringify(data, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }
    static async createBackup(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.backup-${timestamp}`;
        const content = await readFile(filePath);
        await writeFile(backupPath, content);
        return backupPath;
    }
    static async restoreBackup(backupPath, originalPath) {
        const content = await readFile(backupPath);
        await writeFile(originalPath, content);
    }
    static async ensureDirectory(dirPath) {
        try {
            await mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    static async findFiles(dir, pattern, excludeDirs = ['node_modules', '.git', 'dist']) {
        const files = [];
        async function scan(currentDir) {
            const entries = await readdir(currentDir);
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry);
                const stats = await stat(fullPath);
                if (stats.isDirectory()) {
                    if (!excludeDirs.includes(entry)) {
                        await scan(fullPath);
                    }
                }
                else if (stats.isFile() && pattern.test(entry)) {
                    files.push(fullPath);
                }
            }
        }
        await scan(dir);
        return files;
    }
    static async copyFile(src, dest) {
        const content = await readFile(src);
        await writeFile(dest, content);
    }
    static relativePath(from, to) {
        return path.relative(from, to);
    }
    static async fileExists(filePath) {
        try {
            await stat(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    static getFileSize(filePath) {
        return stat(filePath).then(stats => stats.size);
    }
    static async readFileLines(filePath) {
        const content = await readFile(filePath, 'utf-8');
        return content.split(/\r?\n/);
    }
    static async writeFileLines(filePath, lines) {
        const content = lines.join('\n');
        await writeFile(filePath, content, 'utf-8');
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=file-utils.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorClassifier = void 0;
const types_1 = require("../types");
class ErrorClassifier {
    patterns = [
        // Angular compilation mode errors (check first - very specific)
        {
            category: types_1.ErrorCategory.COMPILATION,
            pattern: /Compiling with Angular sources in (ivy|partial) compilation mode/i,
            extractor: (match) => ({
                message: match[0],
            }),
        },
        // Import/Module errors (check before TypeScript to catch specific cases)
        {
            category: types_1.ErrorCategory.IMPORT,
            pattern: /Cannot find module ['"](.+?)['"]/,
            extractor: (match) => ({
                message: `Cannot find module '${match[1]}'`,
            }),
        },
        // Dependency errors (check before TypeScript)
        {
            category: types_1.ErrorCategory.DEPENDENCY,
            pattern: /peer dep|ERESOLVE|npm ERR!|Module not found.*Can't resolve/i,
            extractor: (match) => ({
                message: match[0],
            }),
        },
        // TypeScript errors
        {
            category: types_1.ErrorCategory.TYPESCRIPT,
            pattern: /TS\d+:\s*(.+)/,
            extractor: (match) => ({
                message: match[1],
                code: match[0].match(/TS\d+/)?.[0],
            }),
        },
        // Compilation errors
        {
            category: types_1.ErrorCategory.COMPILATION,
            pattern: /Error: (.+?)\s+at\s+(.+?):(\d+):(\d+)/,
            extractor: (match) => ({
                message: match[1],
                file: match[2],
                line: parseInt(match[3]),
                column: parseInt(match[4]),
            }),
        },
        // Template errors
        {
            category: types_1.ErrorCategory.TEMPLATE,
            pattern: /Error in template:?\s*(.+)/i,
            extractor: (match) => ({
                message: match[1],
            }),
        },
        // Router errors
        {
            category: types_1.ErrorCategory.ROUTER,
            pattern: /Router|routing|loadChildren/i,
            extractor: (match) => ({
                message: match[0],
            }),
        },
        // RxJS errors
        {
            category: types_1.ErrorCategory.RXJS,
            pattern: /rxjs|Observable|Subscription|pipe/i,
            extractor: (match) => ({
                message: match[0],
            }),
        },
        // Standalone component errors
        {
            category: types_1.ErrorCategory.STANDALONE,
            pattern: /standalone|imports array|Component .+ is standalone/i,
            extractor: (match) => ({
                message: match[0],
            }),
        },
    ];
    classifyErrors(buildOutput) {
        const errors = [];
        const lines = buildOutput.split('\n');
        // Track current file context from webpack/angular build output
        let currentFile;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Extract file path from common patterns
            // Pattern 1: Error in /path/to/file.ts
            // Pattern 2: /path/to/file.ts:line:col - error
            // Pattern 3: at /path/to/file.ts (line:col)
            const fileMatch = line.match(/(?:Error in|ERROR in|at)\s+([^\s:]+\.(?:ts|js|html|css|scss))(?::|\()/i) ||
                line.match(/^\s*([^\s:]+\.(?:ts|js|html|css|scss)):\d+:\d+/);
            if (fileMatch) {
                const potentialFile = fileMatch[1];
                // Basic validation - don't accept paths that look like error messages
                if (!potentialFile.includes('migrateto') &&
                    !potentialFile.includes('Error') &&
                    potentialFile.length < 200) {
                    currentFile = potentialFile;
                }
            }
            if (this.isErrorLine(line)) {
                const error = this.classifyError(line, currentFile);
                if (error) {
                    errors.push(error);
                }
            }
        }
        return this.deduplicateErrors(errors);
    }
    isErrorLine(line) {
        return (line.includes('Error:') ||
            line.includes('error TS') ||
            line.includes('ERROR') ||
            line.includes('✖') ||
            line.match(/^\s*at\s+/) !== null);
    }
    classifyError(line, contextFile) {
        for (const pattern of this.patterns) {
            const match = line.match(pattern.pattern);
            if (match) {
                const extracted = pattern.extractor(match);
                return {
                    category: pattern.category,
                    message: extracted.message || line,
                    file: extracted.file || contextFile, // Use context file if pattern didn't extract one
                    line: extracted.line,
                    column: extracted.column,
                    code: extracted.code,
                    severity: 'error',
                };
            }
        }
        // Default to unknown category
        return {
            category: types_1.ErrorCategory.UNKNOWN,
            message: line,
            severity: 'error',
        };
    }
    deduplicateErrors(errors) {
        const seen = new Set();
        const unique = [];
        for (const error of errors) {
            const key = `${error.category}:${error.file}:${error.line}:${error.message}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(error);
            }
        }
        return unique;
    }
    groupErrorsByCategory(errors) {
        const grouped = new Map();
        for (const error of errors) {
            const category = error.category;
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category).push(error);
        }
        return grouped;
    }
}
exports.ErrorClassifier = ErrorClassifier;
//# sourceMappingURL=error-classifier.js.map
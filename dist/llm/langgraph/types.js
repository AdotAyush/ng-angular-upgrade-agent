"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_ERROR_PATTERNS = exports.BROWSER_INCOMPATIBLE_PACKAGES = exports.createInitialState = exports.AnalyzeRuntimeErrorArgsSchema = exports.ProposeChangesArgsSchema = exports.CheckPackageArgsSchema = exports.RunCommandArgsSchema = exports.ListFilesArgsSchema = exports.SearchCodeArgsSchema = exports.ReadFileArgsSchema = void 0;
const zod_1 = require("zod");
exports.ReadFileArgsSchema = zod_1.z.object({
    filePath: zod_1.z.string().describe('Relative path from project root'),
    startLine: zod_1.z.number().optional().describe('Starting line number (1-indexed)'),
    endLine: zod_1.z.number().optional().describe('Ending line number (inclusive)'),
});
exports.SearchCodeArgsSchema = zod_1.z.object({
    pattern: zod_1.z.string().describe('Text or regex pattern to search for'),
    filePattern: zod_1.z.string().optional().describe('Glob pattern for files to search (e.g., "**/*.ts")'),
    caseSensitive: zod_1.z.boolean().optional().describe('Whether search is case sensitive'),
});
exports.ListFilesArgsSchema = zod_1.z.object({
    directory: zod_1.z.string().describe('Directory path relative to project root'),
    recursive: zod_1.z.boolean().optional().describe('List files recursively'),
    pattern: zod_1.z.string().optional().describe('Glob pattern to filter files'),
});
exports.RunCommandArgsSchema = zod_1.z.object({
    command: zod_1.z.string().describe('Shell command to execute'),
    cwd: zod_1.z.string().optional().describe('Working directory (relative to project root)'),
    timeout: zod_1.z.number().optional().describe('Timeout in milliseconds'),
});
exports.CheckPackageArgsSchema = zod_1.z.object({
    packageName: zod_1.z.string().describe('NPM package name to check'),
    checkBrowserCompat: zod_1.z.boolean().optional().describe('Check if package works in browser'),
});
exports.ProposeChangesArgsSchema = zod_1.z.object({
    changes: zod_1.z.array(zod_1.z.object({
        file: zod_1.z.string().describe('File path relative to project root'),
        type: zod_1.z.enum(['create', 'modify', 'delete']).describe('Type of change'),
        content: zod_1.z.string().optional().describe('New file content or modified content'),
        search: zod_1.z.string().optional().describe('Text to search for (for modify)'),
        replace: zod_1.z.string().optional().describe('Text to replace with (for modify)'),
        reasoning: zod_1.z.string().describe('Why this change is needed'),
    })).describe('Array of file changes to apply'),
    explanation: zod_1.z.string().describe('Overall explanation of the fix'),
    confidence: zod_1.z.number().min(0).max(1).describe('Confidence level in this fix (0-1)'),
});
exports.AnalyzeRuntimeErrorArgsSchema = zod_1.z.object({
    errorMessage: zod_1.z.string().describe('The runtime error message'),
    stackTrace: zod_1.z.string().optional().describe('Stack trace if available'),
    context: zod_1.z.string().optional().describe('Additional context about when the error occurs'),
});
/**
 * Initial state factory
 */
function createInitialState(error, projectPath, projectContext, buildOutput, targetVersion, options) {
    return {
        originalError: error,
        projectPath,
        projectContext,
        buildOutput,
        targetVersion,
        phase: 'analyzing',
        iteration: 0,
        maxIterations: options?.maxIterations ?? 15,
        tokenUsage: 0,
        maxTokenBudget: options?.maxTokenBudget ?? 500000,
        investigationResults: [],
        filesRead: new Map(),
        searchResults: new Map(),
        diagnoses: [],
        relatedPackages: [],
        browserCompatibilityIssues: [],
        plannedFixes: [],
        currentFixIndex: 0,
        fixAttempts: [],
        appliedChanges: [],
        rollbackStack: [],
        success: false,
        finalChanges: [],
        reasoning: '',
        confidence: 0,
        suggestionsForUser: [],
        messages: [],
    };
}
exports.createInitialState = createInitialState;
/**
 * Browser-incompatible packages known to cause issues
 */
exports.BROWSER_INCOMPATIBLE_PACKAGES = new Set([
    'whatwg-url',
    'node-fetch',
    'fs',
    'path',
    'crypto',
    'stream',
    'buffer',
    'util',
    'os',
    'child_process',
    'http',
    'https',
    'net',
    'tls',
    'dns',
    'dgram',
    'cluster',
    'readline',
    'repl',
    'vm',
    'v8',
    'worker_threads',
]);
/**
 * Common Angular upgrade issues patterns
 */
exports.RUNTIME_ERROR_PATTERNS = [
    {
        pattern: /Cannot convert undefined or null to object/i,
        type: 'browser-compatibility',
        hint: 'Node.js-only package being used in browser context',
    },
    {
        pattern: /is not a function/i,
        type: 'deprecated-api',
        hint: 'API may have changed or been removed in newer version',
    },
    {
        pattern: /Cannot read propert(?:y|ies) of (?:undefined|null)/i,
        type: 'runtime-error',
        hint: 'Object or module not properly initialized',
    },
    {
        pattern: /Module not found|Cannot find module/i,
        type: 'missing-dependency',
        hint: 'Missing or incorrectly installed package',
    },
    {
        pattern: /getPrototypeOf|Object\.prototype/i,
        type: 'node-only-package',
        hint: 'Node.js-specific code running in browser',
    },
];
//# sourceMappingURL=types.js.map
/**
 * LangGraph Agent Tools
 * Structured tool implementations with proper error handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
    ReadFileArgs,
    SearchCodeArgs,
    ListFilesArgs,
    RunCommandArgs,
    CheckPackageArgs,
    ProposeChangesArgs,
    AnalyzeRuntimeErrorArgs,
    BROWSER_INCOMPATIBLE_PACKAGES,
    RUNTIME_ERROR_PATTERNS,
    InvestigationResult,
    IssueDiagnosis,
    IssueType,
} from './types';

const readFileAsync = promisify(fs.readFile);
const execAsync = promisify(exec);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/**
 * Tool execution context
 */
export interface ToolContext {
    projectPath: string;
    maxFileSize?: number;
    commandTimeout?: number;
}

/**
 * Base tool result
 */
export interface ToolExecutionResult {
    success: boolean;
    result: string;
    metadata?: Record<string, unknown>;
}

/**
 * Tool: Read file contents
 */
export async function readFileTool(
    args: ReadFileArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        const filePath = path.isAbsolute(args.filePath) 
        ? args.filePath 
        : path.join(context.projectPath, args.filePath);

        if (!fs.existsSync(filePath)) {
            return {
                success: false,
                result: `File not found: ${args.filePath}`,
            };
        }

        const content = await readFileAsync(filePath, 'utf-8');
        const lines = content.split('\n');

        let result: string;
        if (args.startLine !== undefined && args.endLine !== undefined) {
            const start = Math.max(0, args.startLine - 1);
            const end = Math.min(lines.length, args.endLine);
            result = lines.slice(start, end).map((line, i) => `${start + i + 1}: ${line}`).join('\n');
        } else {
            // Truncate large files
            const maxSize = context.maxFileSize ?? 15000;
            if (content.length > maxSize) {
                result = content.substring(0, maxSize) + '\n\n... [FILE TRUNCATED - Use startLine/endLine to read specific sections]';
            } else {
                result = content;
            }
        }

        return {
            success: true,
            result,
            metadata: {
                totalLines: lines.length,
                fileSize: content.length,
            },
        };
    } catch (error: any) {
        return {
            success: false,
            result: `Error reading file: ${error.message}`,
        };
    }
}

/**
 * Tool: Search code patterns
 */
export async function searchCodeTool(
    args: SearchCodeArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        const filePattern = args.filePattern ?? '*.{ts,js,json,html}';
        const caseSensitiveFlag = args.caseSensitive ? '' : '-i';
        
        // Use grep for searching (cross-platform via git grep or ripgrep fallback)
        let command: string;
        let searchResult: string;

        // Try ripgrep first (faster), fallback to grep
        try {
            const { stdout } = await execAsync(
                    `rg ${caseSensitiveFlag} --glob "${filePattern}" -n "${args.pattern.replace(/"/g, '\\"')}" .`,
                    {
                        cwd: context.projectPath,
                        maxBuffer: 2 * 1024 * 1024,
                        timeout: context.commandTimeout ?? 30000,
                    }
                );
                searchResult = stdout;
        } catch {
            // Fallback to findstr on Windows or grep on Unix
            const isWindows = process.platform === 'win32';
            if (isWindows) {
                const { stdout } = await execAsync(
                    `findstr /S /N ${args.caseSensitive ? '' : '/I'} "${args.pattern}" ${filePattern}`,
                    {
                        cwd: context.projectPath,
                        maxBuffer: 2 * 1024 * 1024,
                        timeout: context.commandTimeout ?? 30000,
                    }
                );
                searchResult = stdout;
            } else {
                const { stdout } = await execAsync(
                    `grep -rn ${caseSensitiveFlag} --include="${filePattern}" "${args.pattern.replace(/"/g, '\\"')}" .`,
                    {
                        cwd: context.projectPath,
                        maxBuffer: 2 * 1024 * 1024,
                        timeout: context.commandTimeout ?? 30000,
                    }
                );
                searchResult = stdout;
            }
        }

        if (!searchResult || searchResult.trim().length === 0) {
        return {
            success: true,
            result: 'No matches found',
            metadata: { matchCount: 0 },
        };
        }

        // Limit results
        const lines = searchResult.split('\n').filter(l => l.trim());
        const limitedResults = lines.slice(0, 50);
        const truncated = lines.length > 50;

        return {
        success: true,
        result: limitedResults.join('\n') + (truncated ? `\n\n... [${lines.length - 50} more results truncated]` : ''),
        metadata: { matchCount: lines.length },
        };
    } catch (error: any) {
        if (error.code === 1 || error.message?.includes('No matches')) {
        return {
            success: true,
            result: 'No matches found',
            metadata: { matchCount: 0 },
        };
        }
        return {
        success: false,
        result: `Search error: ${error.message}`,
        };
    }
}

/**
 * Tool: List files in directory
 */
export async function listFilesTool(
    args: ListFilesArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        const dirPath = path.join(context.projectPath, args.directory);

        if (!fs.existsSync(dirPath)) {
            return {
                success: false,
                result: `Directory not found: ${args.directory}`,
            };
        }

        const files: string[] = [];
        
        async function walkDir(dir: string, prefix: string = ''): Promise<void> {
            const entries = await readdirAsync(dir);
            
            for (const entry of entries) {
                // Skip node_modules and hidden directories
                if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) {
                    continue;
                }

                const fullPath = path.join(dir, entry);
                const relativePath = path.join(prefix, entry);
                
                try {
                    const stat = await statAsync(fullPath);
                    
                    if (stat.isDirectory()) {
                        files.push(`${relativePath}/`);
                        if (args.recursive) {
                            await walkDir(fullPath, relativePath);
                        }
                    } else {
                        // Apply pattern filter if specified
                        if (!args.pattern || minimatch(entry, args.pattern)) {
                            files.push(relativePath);
                        }
                }
                } catch {
                    // Skip inaccessible files
                }
            }
        }

        await walkDir(dirPath);

        return {
        success: true,
        result: files.length > 0 ? files.join('\n') : 'Directory is empty',
        metadata: { fileCount: files.length },
        };
    } catch (error: any) {
        return {
        success: false,
        result: `Error listing files: ${error.message}`,
        };
    }
}

/**
 * Simple minimatch implementation for pattern matching
 */
function minimatch(filename: string, pattern: string): boolean {
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(filename);
}

/**
 * Tool: Run shell command
 */
export async function runCommandTool(
    args: RunCommandArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        const cwd = args.cwd 
        ? path.join(context.projectPath, args.cwd)
        : context.projectPath;

        const timeout = args.timeout ?? context.commandTimeout ?? 120000;

        const { stdout, stderr } = await execAsync(args.command, {
            cwd,
            maxBuffer: 5 * 1024 * 1024,
            timeout,
        });

        const output = [
            stdout ? `STDOUT:\n${stdout}` : '',
            stderr ? `STDERR:\n${stderr}` : '',
        ].filter(Boolean).join('\n\n');

        return {
            success: true,
            result: output || 'Command completed with no output',
            metadata: { exitCode: 0 },
        };
    } catch (error: any) {
        // Command failed but we still want to capture output
        const output = [
            error.stdout ? `STDOUT:\n${error.stdout}` : '',
            error.stderr ? `STDERR:\n${error.stderr}` : '',
            `Exit code: ${error.code ?? 'unknown'}`,
        ].filter(Boolean).join('\n\n');

        return {
            success: false,
            result: output || `Command failed: ${error.message}`,
            metadata: { exitCode: error.code },
        };
    }
}

/**
 * Tool: Check package browser compatibility
 */
export async function checkPackageTool(
    args: CheckPackageArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        const packageJsonPath = path.join(context.projectPath, 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            return {
                success: false,
                result: 'package.json not found in project root',
            };
        }

        const packageJson = JSON.parse(await readFileAsync(packageJsonPath, 'utf-8'));
        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        const packageName = args.packageName;
        const version = allDeps[packageName];
        const isInstalled = !!version;
        
        // Check if it's a known browser-incompatible package
        const isBrowserIncompatible = BROWSER_INCOMPATIBLE_PACKAGES.has(packageName);
        
        // Try to read the package's package.json to check browser field
        let packageInfo: any = null;
        const nodeModulesPath = path.join(context.projectPath, 'node_modules', packageName, 'package.json');
        
        if (fs.existsSync(nodeModulesPath)) {
            try {
                packageInfo = JSON.parse(await readFileAsync(nodeModulesPath, 'utf-8'));
            } catch {
                // Ignore parse errors
            }
        }

        const hasBrowserField = !!packageInfo?.browser;
        const hasMainField = !!packageInfo?.main;
        const hasModuleField = !!packageInfo?.module;
        const engines = packageInfo?.engines;
        const isNodeOnly = engines?.node && !hasBrowserField;

        const analysis = {
            packageName,
            version: version ?? 'not installed',
            isInstalled,
            isBrowserIncompatible,
            hasBrowserField,
            hasModuleField,
            isNodeOnly,
            recommendation: '',
        };

        if (isBrowserIncompatible || isNodeOnly) {
            analysis.recommendation = `⚠️ This package is NOT browser-compatible. It should be removed or replaced with a browser-compatible alternative. For '${packageName}', consider using the browser's native APIs instead.`;
        } else if (!hasBrowserField && !hasModuleField && hasMainField) {
            analysis.recommendation = `⚠️ This package may have limited browser support. Check if it's meant for Node.js only.`;
        } else {
            analysis.recommendation = `✅ This package appears to be browser-compatible.`;
        }

        return {
            success: true,
            result: JSON.stringify(analysis, null, 2),
            metadata: analysis,
        };
    } catch (error: any) {
        return {
            success: false,
            result: `Error checking package: ${error.message}`,
        };
    }
}

/**
 * Tool: Analyze runtime error
 */
export async function analyzeRuntimeErrorTool(
    args: AnalyzeRuntimeErrorArgs,
    context: ToolContext
): Promise<ToolExecutionResult> {
    const { errorMessage, stackTrace, context: errorContext } = args;
    
    const diagnosis: Partial<IssueDiagnosis> = {
        evidence: [],
        affectedFiles: [],
        confidence: 0,
    };

    // Match against known patterns
    for (const pattern of RUNTIME_ERROR_PATTERNS) {
        if (pattern.pattern.test(errorMessage)) {
            diagnosis.issueType = pattern.type;
            diagnosis.evidence!.push(`Matched pattern: ${pattern.hint}`);
            diagnosis.confidence = 0.7;
            break;
        }
    }

    // Extract file references from stack trace
    if (stackTrace) {
        const fileMatches = stackTrace.match(/(?:at\s+)?([^\s(]+\.(?:ts|js|tsx|jsx))(?::(\d+))?/g);
        if (fileMatches) {
            diagnosis.affectedFiles = [...new Set(fileMatches.map((m: string) => {
                const match = m.match(/([^\s(]+\.(?:ts|js|tsx|jsx))/);
                return match ? match[1] : '';
            }).filter(Boolean))] as string[];
        }

        // Check for node_modules packages in stack
        const nodeModuleMatches = stackTrace.match(/node_modules\/([^/]+)/g);
        if (nodeModuleMatches) {
            const packages = [...new Set(nodeModuleMatches.map((m: string) => m.replace('node_modules/', '')))];
            
            for (const pkg of packages) {
                if (BROWSER_INCOMPATIBLE_PACKAGES.has(pkg as string)) {
                    diagnosis.issueType = 'node-only-package';
                    diagnosis.rootCause = `Package '${pkg}' is a Node.js-only package and cannot run in the browser`;
                    diagnosis.suggestedFix = `Remove '${pkg}' from dependencies or replace with a browser-compatible alternative`;
                    diagnosis.confidence = 0.9;
                    diagnosis.severity = 'critical';
                    diagnosis.evidence!.push(`Found Node.js-only package in stack trace: ${pkg}`);
                    break;
                }
            }
        }
    }

    // Specific analysis for common errors
    if (errorMessage.includes('whatwg-url') || errorMessage.includes('getPrototypeOf')) {
        diagnosis.issueType = 'node-only-package';
        diagnosis.rootCause = 'whatwg-url is a Node.js implementation of the URL standard. Browsers have native URL support.';
        diagnosis.suggestedFix = 'Remove the whatwg-url package and its imports. Use the browser\'s native URL and URLSearchParams APIs instead.';
        diagnosis.severity = 'critical';
        diagnosis.confidence = 0.95;
    }

    if (!diagnosis.issueType) {
        diagnosis.issueType = 'runtime-error';
        diagnosis.rootCause = 'Unknown runtime error - requires investigation';
        diagnosis.confidence = 0.3;
        diagnosis.severity = 'high';
    }

    return {
        success: true,
        result: JSON.stringify(diagnosis, null, 2),
        metadata: diagnosis as Record<string, unknown>,
    };
}

/**
 * Tool: Find usages of a package or import
 */
export async function findUsagesTool(
    packageName: string,
    context: ToolContext
): Promise<ToolExecutionResult> {
    try {
        // Search for imports of the package
        const importPatterns = [
            `from ['"]${packageName}['"]`,
            `require\\(['"]${packageName}['"]\\)`,
            `import.*${packageName}`,
        ];

        const results: string[] = [];
        
        for (const pattern of importPatterns) {
            const searchResult = await searchCodeTool(
                { pattern, filePattern: '*.{ts,js,tsx,jsx}' },
                context
            );
            if (searchResult.success && searchResult.result !== 'No matches found') {
                results.push(searchResult.result);
            }
        }

        if (results.length === 0) {
            return {
                success: true,
                result: `No usages of '${packageName}' found in the codebase`,
                metadata: { usageCount: 0 },
            };
        }

        return {
            success: true,
            result: `Usages of '${packageName}':\n\n${results.join('\n')}`,
            metadata: { usageCount: results.length },
        };
    } catch (error: any) {
        return {
            success: false,
            result: `Error finding usages: ${error.message}`,
        };
    }
}

/**
 * Tool definitions for LangGraph
 */
export const TOOL_DEFINITIONS = [
    {
        name: 'readFile',
        description: 'Read the contents of a file from the project. Use this to examine source code, configuration files, or any text file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'Relative path from project root to the file',
                },
                startLine: {
                    type: 'number',
                    description: 'Starting line number (1-indexed). Optional.',
                },
                endLine: {
                    type: 'number',
                    description: 'Ending line number (inclusive). Optional.',
                },
            },
            required: ['filePath'],
        },
    },
    {
        name: 'searchCode',
        description: 'Search for code patterns or text across project files. Use this to find usages, imports, or specific code patterns.',
        parameters: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'Text or regex pattern to search for',
                },
                filePattern: {
                    type: 'string',
                    description: 'Glob pattern for files to search (e.g., "*.ts", "*.{ts,js}")',
                },
                caseSensitive: {
                    type: 'boolean',
                    description: 'Whether the search should be case sensitive',
                },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'listFiles',
        description: 'List files in a directory. Use this to explore project structure.',
        parameters: {
            type: 'object',
            properties: {
                directory: {
                    type: 'string',
                    description: 'Directory path relative to project root',
                },
                recursive: {
                    type: 'boolean',
                    description: 'Whether to list files recursively',
                },
                pattern: {
                    type: 'string',
                    description: 'Glob pattern to filter files (e.g., "*.ts")',
                },
            },
            required: ['directory'],
        },
    },
    {
        name: 'runCommand',
        description: 'Run a shell command in the project directory. Use for builds, npm commands, etc.',
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute',
                },
                cwd: {
                    type: 'string',
                    description: 'Working directory relative to project root (optional)',
                },
                timeout: {
                    type: 'number',
                    description: 'Command timeout in milliseconds (optional)',
                },
            },
            required: ['command'],
        },
    },
    {
        name: 'checkPackage',
        description: 'Check if an npm package is browser-compatible. Use this when investigating runtime errors related to packages.',
        parameters: {
            type: 'object',
            properties: {
                packageName: {
                    type: 'string',
                    description: 'The npm package name to check',
                },
                checkBrowserCompat: {
                    type: 'boolean',
                    description: 'Whether to check browser compatibility',
                },
            },
            required: ['packageName'],
        },
    },
    {
        name: 'analyzeRuntimeError',
        description: 'Analyze a runtime error to diagnose the root cause. Use this for browser console errors or application crashes.',
        parameters: {
            type: 'object',
            properties: {
                errorMessage: {
                    type: 'string',
                    description: 'The error message from the console or logs',
                },
                stackTrace: {
                    type: 'string',
                    description: 'The full stack trace if available',
                },
                context: {
                    type: 'string',
                    description: 'Additional context about when/where the error occurs',
                },
            },
            required: ['errorMessage'],
        },
    },
    {
        name: 'proposeChanges',
        description: 'Propose file changes to fix the issue. Only use this when you have diagnosed the problem and are confident in the solution.',
        parameters: {
            type: 'object',
            properties: {
                changes: {
                    type: 'array',
                    description: 'Array of file changes to apply',
                    items: {
                        type: 'object',
                        properties: {
                            file: { type: 'string', description: 'File path' },
                            type: { type: 'string', enum: ['create', 'modify', 'delete'] },
                            content: { type: 'string', description: 'New content (for create/modify)' },
                            search: { type: 'string', description: 'Text to find (for modify)' },
                            replace: { type: 'string', description: 'Replacement text (for modify)' },
                            reasoning: { type: 'string', description: 'Why this change is needed' },
                        },
                        required: ['file', 'type', 'reasoning'],
                    },
                },
                explanation: {
                    type: 'string',
                    description: 'Overall explanation of the fix',
                },
                confidence: {
                    type: 'number',
                    description: 'Confidence level in this fix (0-1)',
                },
            },
            required: ['changes', 'explanation', 'confidence'],
        },
    },
];

/**
 * Execute a tool by name
 */
export async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
): Promise<ToolExecutionResult> {
    switch (toolName) {
        case 'readFile':
            return readFileTool(args as ReadFileArgs, context);
        case 'searchCode':
            return searchCodeTool(args as SearchCodeArgs, context);
        case 'listFiles':
            return listFilesTool(args as ListFilesArgs, context);
        case 'runCommand':
            return runCommandTool(args as RunCommandArgs, context);
        case 'checkPackage':
            return checkPackageTool(args as CheckPackageArgs, context);
        case 'analyzeRuntimeError':
            return analyzeRuntimeErrorTool(args as AnalyzeRuntimeErrorArgs, context);
        case 'proposeChanges':
            // proposeChanges is handled specially - return the args as-is
            return {
                success: true,
                result: JSON.stringify(args, null, 2),
                metadata: args,
            };
        default:
        return {
            success: false,
            result: `Unknown tool: ${toolName}`,
        };
    }
}

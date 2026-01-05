/**
 * Runtime Error Analyzer
 * 
 * Specialized analyzer for browser runtime errors that occur after
 * successful builds. Handles common issues like:
 * - Node.js-only packages in browser context
 * - Missing polyfills
 * - Browser compatibility issues
 * - Import/module resolution errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { BuildError, ErrorCategory, FileChange } from '../../types';
import { 
    BROWSER_INCOMPATIBLE_PACKAGES, 
    RUNTIME_ERROR_PATTERNS,
    IssueDiagnosis,
    IssueType,
} from './types';
import { readFileTool, searchCodeTool, ToolContext } from './tools';

const readFileAsync = promisify(fs.readFile);

/**
 * Common browser alternatives for Node.js packages
 */
const BROWSER_ALTERNATIVES: Record<string, {
    native: boolean;
    alternative: string;
    example: string;
}> = {
    'whatwg-url': {
        native: true,
        alternative: 'Browser native URL and URLSearchParams APIs',
        example: `// Before (Node.js)
    import { URL } from 'whatwg-url';

    // After (Browser - no import needed)
    const url = new URL('https://example.com');
    const params = new URLSearchParams('key=value');`,
    },
    'whatwg-fetch': {
        native: true,
        alternative: 'Browser native fetch API',
        example: `// Before (Node.js)
    import 'whatwg-fetch';

    // After (Browser - no import needed)
    fetch('/api/data').then(res => res.json());`,
    },
    'node-fetch': {
        native: true,
        alternative: 'Browser native fetch API',
        example: `// Before (Node.js)
    import fetch from 'node-fetch';

    // After (Browser - no import needed)
    const response = await fetch('/api/data');`,
    },
    'buffer': {
        native: false,
        alternative: 'Use Uint8Array or the buffer package with browser support',
        example: `// Before (Node.js)
    import { Buffer } from 'buffer';

    // After (Browser)
    const data = new Uint8Array([1, 2, 3]);
    // Or use TextEncoder/TextDecoder for strings`,
    },
    'crypto': {
        native: true,
        alternative: 'Web Crypto API (window.crypto)',
        example: `// Before (Node.js)
    import crypto from 'crypto';
    const hash = crypto.createHash('sha256');

    // After (Browser)
    const hash = await crypto.subtle.digest('SHA-256', data);`,
    },
    'path': {
        native: false,
        alternative: 'String manipulation or URL API',
        example: `// Before (Node.js)
    import path from 'path';
    const joined = path.join('a', 'b', 'c');

    // After (Browser)
    const joined = ['a', 'b', 'c'].join('/');
    // Or use URL for proper path handling`,
    },
    'fs': {
        native: false,
        alternative: 'File System Access API or IndexedDB',
        example: `// File System Access API (modern browsers)
    const fileHandle = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();`,
    },
};

/**
 * Parse a browser console error into structured data
 */
export function parseRuntimeError(errorOutput: string): {
    message: string;
    stackTrace: string;
    sourceFile?: string;
    lineNumber?: number;
    involvedPackages: string[];
} {
    const lines = errorOutput.split('\n');
    const message = lines[0] || 'Unknown error';
    
    // Extract stack trace
    const stackLines = lines.filter(l => 
        l.includes('at ') || 
        l.includes('node_modules') ||
        l.match(/\.(js|ts):\d+/)
    );
    const stackTrace = stackLines.join('\n');

    // Extract source file and line
    const sourceMatch = errorOutput.match(/([^/\s]+\.(js|ts|tsx|jsx)):(\d+)/);
    const sourceFile = sourceMatch?.[1];
    const lineNumber = sourceMatch?.[3] ? parseInt(sourceMatch[3]) : undefined;

    // Extract involved packages
    const packageMatches = errorOutput.match(/node_modules\/([^/\s]+)/g);
    const involvedPackages = packageMatches
        ? [...new Set(packageMatches.map(m => m.replace('node_modules/', '')))]
        : [];

    return {
        message,
        stackTrace,
        sourceFile,
        lineNumber,
        involvedPackages,
    };
}

/**
 * Analyze a runtime error and produce diagnosis
 */
export async function analyzeRuntimeError(
    errorOutput: string,
    projectPath: string
): Promise<{
    diagnosis: IssueDiagnosis;
    suggestedFixes: FileChange[];
    explanation: string;
}> {
    const parsed = parseRuntimeError(errorOutput);
    const context: ToolContext = { projectPath };

    // Default diagnosis
    const diagnosis: IssueDiagnosis = {
        issueType: 'runtime-error',
        rootCause: 'Unknown runtime error',
        affectedFiles: [],
        severity: 'high',
        confidence: 0.5,
        evidence: [],
    };

    const suggestedFixes: FileChange[] = [];
    const explanationParts: string[] = [];

    // Check for browser-incompatible packages
    const problematicPackages = parsed.involvedPackages.filter(pkg =>
        BROWSER_INCOMPATIBLE_PACKAGES.has(pkg)
    );

    if (problematicPackages.length > 0) {
        diagnosis.issueType = 'node-only-package';
        diagnosis.severity = 'critical';
        diagnosis.confidence = 0.9;
        diagnosis.rootCause = `Browser-incompatible package(s) detected: ${problematicPackages.join(', ')}`;
        diagnosis.evidence.push(`Found in stack trace: ${problematicPackages.join(', ')}`);

        explanationParts.push('## Root Cause');
        explanationParts.push(`The application is using Node.js-only package(s) that cannot run in browsers: **${problematicPackages.join(', ')}**`);
        explanationParts.push('');

        // Find usages and generate fixes
        for (const pkg of problematicPackages) {
            // Search for imports
            const searchResult = await searchCodeTool(
                { pattern: `from ['"]${pkg}['"]`, filePattern: '*.{ts,js}' },
                context
            );

            if (searchResult.success && searchResult.result !== 'No matches found') {
                const files = extractFilesFromSearch(searchResult.result);
                diagnosis.affectedFiles.push(...files);

                for (const file of files) {
                    const fileResult = await readFileTool({ filePath: file }, context);
                    if (fileResult.success) {
                        const newContent = removePackageImport(fileResult.result, pkg);
                        if (newContent !== fileResult.result) {
                            suggestedFixes.push({
                                file,
                                type: 'modify',
                                content: newContent,
                                diff: `Remove import from '${pkg}'`,
                            });
                        }
                    }
                }
            }

            // Add explanation for this package
            const alt = BROWSER_ALTERNATIVES[pkg];
            if (alt) {
                explanationParts.push(`### ${pkg}`);
                explanationParts.push(`**Alternative:** ${alt.alternative}`);
                explanationParts.push('');
                explanationParts.push('```typescript');
                explanationParts.push(alt.example);
                explanationParts.push('```');
                explanationParts.push('');
            }
        }

        // Add package.json fix
        const pkgJsonFix = await generatePackageJsonFix(projectPath, problematicPackages);
        if (pkgJsonFix) {
        suggestedFixes.push(pkgJsonFix);
        }
    }

    // Check for specific error patterns
    for (const pattern of RUNTIME_ERROR_PATTERNS) {
        if (pattern.pattern.test(parsed.message)) {
        if (diagnosis.confidence < 0.7) {
            diagnosis.issueType = pattern.type;
            diagnosis.evidence.push(`Matched pattern: ${pattern.hint}`);
        }
        break;
        }
    }

    // Specific handling for whatwg-url error
    if (errorOutput.includes('whatwg-url') && 
        (errorOutput.includes('Cannot convert undefined or null to object') ||
        errorOutput.includes('getPrototypeOf'))) {
        
        diagnosis.issueType = 'node-only-package';
        diagnosis.confidence = 0.95;
        diagnosis.rootCause = 'whatwg-url is a Node.js-only package. Modern browsers have native URL support.';
        
        explanationParts.unshift('## Quick Fix');
        explanationParts.unshift('');
        explanationParts.unshift('The `whatwg-url` package implements the URL standard for Node.js. Browsers already have native `URL` and `URLSearchParams` support built-in, so this package is unnecessary and causes errors.');
        explanationParts.unshift('');
    }

    return {
        diagnosis,
        suggestedFixes,
        explanation: explanationParts.join('\n'),
    };
}

/**
 * Extract file paths from search results
 */
function extractFilesFromSearch(searchResult: string): string[] {
    const files: string[] = [];
    const lines = searchResult.split('\n');
    
    for (const line of lines) {
        const match = line.match(/^\.?\/?([\w\-./]+\.(ts|js|tsx|jsx)):/);
        if (match) {
            files.push(match[1]);
        }
    }

    return [...new Set(files)];
}

/**
 * Remove a package import from file content
 */
function removePackageImport(content: string, packageName: string): string {
    // Match various import patterns
    const patterns = [
        // import { X } from 'pkg'
        new RegExp(`^import\\s+\\{[^}]+\\}\\s+from\\s+['"]${packageName}['"];?\\s*$`, 'gm'),
        // import X from 'pkg'
        new RegExp(`^import\\s+\\w+\\s+from\\s+['"]${packageName}['"];?\\s*$`, 'gm'),
        // import * as X from 'pkg'
        new RegExp(`^import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${packageName}['"];?\\s*$`, 'gm'),
        // import 'pkg'
        new RegExp(`^import\\s+['"]${packageName}['"];?\\s*$`, 'gm'),
        // const X = require('pkg')
        new RegExp(`^const\\s+\\w+\\s*=\\s*require\\(['"]${packageName}['"]\\);?\\s*$`, 'gm'),
        // require('pkg')
        new RegExp(`^require\\(['"]${packageName}['"]\\);?\\s*$`, 'gm'),
    ];

    let result = content;
    for (const pattern of patterns) {
        result = result.replace(pattern, '');
    }

    // Clean up multiple empty lines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
}

/**
 * Generate package.json fix to remove packages
 */
async function generatePackageJsonFix(
    projectPath: string,
    packagesToRemove: string[]
): Promise<FileChange | null> {
    try {
        const pkgJsonPath = path.join(projectPath, 'package.json');
        const content = await readFileAsync(pkgJsonPath, 'utf-8');
        const pkgJson = JSON.parse(content);
        let modified = false;

        for (const pkg of packagesToRemove) {
            if (pkgJson.dependencies?.[pkg]) {
                delete pkgJson.dependencies[pkg];
                modified = true;
            }
            if (pkgJson.devDependencies?.[pkg]) {
                delete pkgJson.devDependencies[pkg];
                modified = true;
            }
        }

        if (modified) {
            return {
                file: 'package.json',
                type: 'modify',
                content: JSON.stringify(pkgJson, null, 2) + '\n',
                diff: `Removed packages: ${packagesToRemove.join(', ')}`,
            };
        }
    } catch {
        // Could not read/parse package.json
    }

    return null;
}

/**
 * Create a BuildError from runtime error output
 */
export function createBuildErrorFromRuntime(errorOutput: string): BuildError {
    const parsed = parseRuntimeError(errorOutput);
    
    // Determine category based on error content
    let category = ErrorCategory.UNKNOWN;
    
    if (parsed.involvedPackages.some(p => BROWSER_INCOMPATIBLE_PACKAGES.has(p))) {
        category = ErrorCategory.DEPENDENCY;
    } else if (errorOutput.includes('import') || errorOutput.includes('require')) {
        category = ErrorCategory.IMPORT;
    } else if (errorOutput.includes('TypeError')) {
        category = ErrorCategory.TYPESCRIPT;
    }

    return {
        category,
        message: parsed.message,
        file: parsed.sourceFile,
        line: parsed.lineNumber,
        severity: 'error',
        stackTrace: parsed.stackTrace,
    };
}

/**
 * Check project for potential browser compatibility issues
 */
export async function scanForBrowserIssues(projectPath: string): Promise<{
    issues: Array<{
        package: string;
        usedIn: string[];
        alternative: string;
    }>;
    clean: boolean;
}> {
    const context: ToolContext = { projectPath };
    const issues: Array<{
        package: string;
        usedIn: string[];
        alternative: string;
    }> = [];

    // Read package.json
    const pkgResult = await readFileTool({ filePath: 'package.json' }, context);
    if (!pkgResult.success) {
        return { issues, clean: true };
    }

    try {
        const pkgJson = JSON.parse(pkgResult.result);
        const allDeps = {
            ...pkgJson.dependencies,
            ...pkgJson.devDependencies,
        };

        for (const pkg of Object.keys(allDeps)) {
            if (BROWSER_INCOMPATIBLE_PACKAGES.has(pkg)) {
                // Find usages
                const searchResult = await searchCodeTool(
                    { pattern: `['"]${pkg}['"]`, filePattern: '*.{ts,js,tsx,jsx}' },
                    context
                );

                const usedIn = searchResult.success && searchResult.result !== 'No matches found'
                ? extractFilesFromSearch(searchResult.result)
                : [];

                const alt = BROWSER_ALTERNATIVES[pkg];
                issues.push({
                    package: pkg,
                    usedIn,
                    alternative: alt?.alternative || 'Consider removing or finding a browser-compatible alternative',
                });
            }
        }
    } catch {
        // Invalid package.json
    }

    return {
        issues,
        clean: issues.length === 0,
    };
}

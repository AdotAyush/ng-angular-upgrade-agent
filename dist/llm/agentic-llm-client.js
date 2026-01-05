"use strict";
/**
 * LangGraph-based Agentic LLM Client
 *
 * A sophisticated agent that uses LangGraph for state management,
 * structured tool execution, and multi-step reasoning to solve
 * complex Angular upgrade issues including:
 * - Build errors
 * - Runtime errors
 * - Browser compatibility issues
 * - Node.js-only package detection
 */
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
exports.AgenticLLMClient = void 0;
const fs = __importStar(require("fs"));
const util_1 = require("util");
const langgraph_1 = require("./langgraph");
const tools_1 = require("./langgraph/tools");
const readFileAsync = (0, util_1.promisify)(fs.readFile);
/**
 * LangGraph-powered Agentic LLM Client
 *
 * Provides intelligent, multi-step problem solving for Angular upgrades
 * with proper state management and structured tool execution.
 */
class AgenticLLMClient {
    llmClient;
    projectPath;
    config;
    constructor(llmClient, projectPath, config) {
        this.llmClient = llmClient;
        this.projectPath = projectPath;
        this.config = {
            maxIterations: config?.maxIterations ?? 15,
            maxTokenBudget: config?.maxTokenBudget ?? 500000,
            enableParallelTools: config?.enableParallelTools ?? true,
            verboseLogging: config?.verboseLogging ?? false,
        };
    }
    /**
     * Request fix using the LangGraph agent
     */
    async requestFix(error, projectContext, buildOutput) {
        console.log('  🤖 Starting LangGraph agent...');
        // First, try quick diagnosis for common patterns
        const quickDiagnosis = await this.quickDiagnose(error, buildOutput);
        if (quickDiagnosis && quickDiagnosis.confidence >= 0.9) {
            console.log(`  ⚡ Quick diagnosis: ${quickDiagnosis.issueType}`);
            // For high-confidence diagnoses, we can fast-track the fix
            const fastFix = await this.generateFastFix(quickDiagnosis);
            if (fastFix) {
                return fastFix;
            }
        }
        // Run the full LangGraph agent
        try {
            const result = await (0, langgraph_1.runAgent)(this.llmClient, error, this.projectPath, projectContext, buildOutput, '19.0.0', // Target Angular version
            {
                maxIterations: this.config.maxIterations,
                maxTokenBudget: this.config.maxTokenBudget,
            });
            if (result.success && result.changes.length > 0) {
                return {
                    success: true,
                    changes: result.changes,
                    reasoning: result.reasoning,
                    confidence: result.confidence,
                    suggestion: result.suggestions.join('\n'),
                };
            }
            return {
                success: false,
                requiresManualIntervention: true,
                reasoning: result.reasoning,
                suggestion: result.suggestions.join('\n') || 'Agent could not determine a fix',
            };
        }
        catch (err) {
            console.error('  ❌ Agent error:', err.message);
            return {
                success: false,
                error: err.message,
                requiresManualIntervention: true,
                suggestion: 'An error occurred during agent execution. Please check the logs.',
            };
        }
    }
    /**
     * Quick diagnosis for common runtime error patterns
     * This provides fast-track fixes for well-known issues
     */
    async quickDiagnose(error, buildOutput) {
        const fullText = `${error.message}\n${buildOutput}`;
        const nodeModulesMatch = fullText.match(/node_modules\/([^/\s]+)/g);
        const extractedPackages = nodeModulesMatch ? [...new Set(nodeModulesMatch.map(m => m.replace('node_modules/', '')))] : [];
        const problematicPackages = extractedPackages.filter(pkg => langgraph_1.BROWSER_INCOMPATIBLE_PACKAGES.has(pkg));
        if (fullText.includes('whatwg-url') ||
            (fullText.includes('Cannot convert undefined or null to object') &&
                fullText.includes('getPrototypeOf'))) {
            // Find files that import whatwg-url
            const affectedFiles = await this.findPackageUsages('whatwg-url');
            return {
                issueType: 'node-only-package',
                problematicPackages: ['whatwg-url'],
                affectedFiles,
                suggestedAction: 'Remove whatwg-url package and imports. Use browser native URL API instead.',
                confidence: 0.95,
            };
        }
        // Check other known patterns
        for (const pattern of langgraph_1.RUNTIME_ERROR_PATTERNS) {
            if (pattern.pattern.test(fullText)) {
                return {
                    issueType: pattern.type,
                    problematicPackages,
                    affectedFiles: [],
                    suggestedAction: pattern.hint,
                    confidence: 0.7,
                };
            }
        }
        // If we found problematic packages
        if (problematicPackages.length > 0) {
            const affectedFiles = [];
            for (const pkg of problematicPackages) {
                const usages = await this.findPackageUsages(pkg);
                affectedFiles.push(...usages);
            }
            return {
                issueType: 'node-only-package',
                problematicPackages,
                affectedFiles: [...new Set(affectedFiles)],
                suggestedAction: `Remove or replace browser-incompatible packages: ${problematicPackages.join(', ')}`,
                confidence: 0.85,
            };
        }
        return null;
    }
    /**
     * Find files that use a specific package
     */
    async findPackageUsages(packageName) {
        const context = { projectPath: this.projectPath };
        const result = await (0, tools_1.searchCodeTool)({
            pattern: `from ['"]${packageName}['"]|require\\(['"]${packageName}['"]\\)`,
            filePattern: '*.{ts,js,tsx,jsx}',
        }, context);
        if (!result.success || result.result === 'No matches found') {
            return [];
        }
        // Extract file paths from search results
        const files = [];
        const lines = result.result.split('\n');
        for (const line of lines) {
            const match = line.match(/^([^:]+):/);
            if (match) {
                files.push(match[1].replace(/^\.\//, ''));
            }
        }
        return [...new Set(files)];
    }
    /**
     * Generate a fast fix for high-confidence diagnoses
     */
    async generateFastFix(diagnosis) {
        const changes = [];
        const context = { projectPath: this.projectPath };
        // For node-only-package issues
        if (diagnosis.issueType === 'node-only-package') {
            // 1. Remove imports from affected files
            for (const filePath of diagnosis.affectedFiles) {
                try {
                    const fileResult = await (0, tools_1.readFileTool)({ filePath }, context);
                    if (!fileResult.success)
                        continue;
                    const content = fileResult.result;
                    let newContent = content;
                    let modified = false;
                    for (const pkg of diagnosis.problematicPackages) {
                        // Remove import statements
                        const importPatterns = [
                            new RegExp(`import\\s+.*?\\s+from\\s+['"]${pkg}['"];?\\n?`, 'g'),
                            new RegExp(`import\\s+['"]${pkg}['"];?\\n?`, 'g'),
                            new RegExp(`const\\s+.*?\\s*=\\s*require\\(['"]${pkg}['"]\\);?\\n?`, 'g'),
                            new RegExp(`require\\(['"]${pkg}['"]\\);?\\n?`, 'g'),
                        ];
                        for (const pattern of importPatterns) {
                            if (pattern.test(newContent)) {
                                newContent = newContent.replace(pattern, '');
                                modified = true;
                            }
                        }
                    }
                    if (modified) {
                        changes.push({
                            file: filePath,
                            type: 'modify',
                            content: newContent,
                            diff: `Removed imports of: ${diagnosis.problematicPackages.join(', ')}`,
                        });
                    }
                }
                catch (err) {
                    console.log(`    ⚠ Could not process ${filePath}`);
                }
            }
            // 2. Remove packages from package.json
            try {
                const pkgJsonPath = 'package.json';
                const pkgResult = await (0, tools_1.readFileTool)({ filePath: pkgJsonPath }, context);
                if (pkgResult.success) {
                    const pkgJson = JSON.parse(pkgResult.result);
                    let modified = false;
                    for (const pkg of diagnosis.problematicPackages) {
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
                        changes.push({
                            file: pkgJsonPath,
                            type: 'modify',
                            content: JSON.stringify(pkgJson, null, 2),
                            diff: `Removed packages: ${diagnosis.problematicPackages.join(', ')}`,
                        });
                    }
                }
            }
            catch (err) {
                console.log('    ⚠ Could not update package.json');
            }
            if (changes.length > 0) {
                return {
                    success: true,
                    changes,
                    reasoning: this.generateReasoning(diagnosis),
                    confidence: diagnosis.confidence,
                    suggestion: 'Run `npm install` after applying these changes to update node_modules.',
                };
            }
        }
        return null;
    }
    /**
     * Generate human-readable reasoning for a fix
     */
    generateReasoning(diagnosis) {
        const parts = [];
        parts.push(`**Issue Type:** ${diagnosis.issueType}`);
        parts.push('');
        if (diagnosis.problematicPackages.length > 0) {
            parts.push(`**Problematic Packages:** ${diagnosis.problematicPackages.join(', ')}`);
            parts.push('');
        }
        parts.push('**Root Cause:**');
        switch (diagnosis.issueType) {
            case 'node-only-package':
                parts.push('The application is using Node.js-only packages that cannot run in browser environments.');
                parts.push('These packages rely on Node.js-specific APIs (like `fs`, `path`, or Node\'s built-in modules) that don\'t exist in browsers.');
                break;
            case 'browser-compatibility':
                parts.push('There are browser compatibility issues with certain packages or APIs.');
                break;
            case 'deprecated-api':
                parts.push('The code is using deprecated APIs that have been removed or changed in the target version.');
                break;
            default:
                parts.push(diagnosis.suggestedAction);
        }
        parts.push('');
        parts.push('**Solution:**');
        parts.push(diagnosis.suggestedAction);
        if (diagnosis.issueType === 'node-only-package' && diagnosis.problematicPackages.includes('whatwg-url')) {
            parts.push('');
            parts.push('**Note:** Modern browsers have native `URL` and `URLSearchParams` APIs. The `whatwg-url` package is only needed for Node.js environments.');
            parts.push('');
            parts.push('Example - Replace:');
            parts.push('```typescript');
            parts.push("import { URL } from 'whatwg-url';");
            parts.push('```');
            parts.push('With (browser native):');
            parts.push('```typescript');
            parts.push('// No import needed - URL is globally available in browsers');
            parts.push('const url = new URL("https://example.com");');
            parts.push('```');
        }
        return parts.join('\n');
    }
    /**
     * Analyze a runtime error directly (useful for console errors)
     */
    async analyzeRuntimeError(errorMessage, stackTrace) {
        const context = { projectPath: this.projectPath };
        const result = await (0, tools_1.analyzeRuntimeErrorTool)({ errorMessage, stackTrace }, context);
        if (result.success && result.metadata) {
            return result.metadata;
        }
        return null;
    }
    /**
     * Check if a package is browser-compatible
     */
    async checkBrowserCompatibility(packageName) {
        const context = { projectPath: this.projectPath };
        const result = await (0, tools_1.checkPackageTool)({ packageName, checkBrowserCompat: true }, context);
        if (!result.success) {
            return {
                compatible: false,
                reason: result.result,
            };
        }
        const analysis = result.metadata;
        if (langgraph_1.BROWSER_INCOMPATIBLE_PACKAGES.has(packageName)) {
            const alternatives = {
                'whatwg-url': 'Use browser native URL API',
                'node-fetch': 'Use browser native fetch API',
                'fs': 'Use File System Access API or IndexedDB',
                'path': 'Use URL API for path manipulation',
                'crypto': 'Use Web Crypto API',
            };
            return {
                compatible: false,
                reason: `${packageName} is a Node.js-only package`,
                alternative: alternatives[packageName],
            };
        }
        return {
            compatible: !analysis.isNodeOnly,
            reason: analysis.recommendation,
        };
    }
    /**
     * Get a summary of browser compatibility issues in the project
     */
    async scanForBrowserIssues() {
        const issues = [];
        // Read package.json
        const context = { projectPath: this.projectPath };
        const pkgResult = await (0, tools_1.readFileTool)({ filePath: 'package.json' }, context);
        if (!pkgResult.success) {
            return { issues };
        }
        try {
            const pkgJson = JSON.parse(pkgResult.result);
            const allDeps = {
                ...pkgJson.dependencies,
                ...pkgJson.devDependencies,
            };
            for (const pkg of Object.keys(allDeps)) {
                if (langgraph_1.BROWSER_INCOMPATIBLE_PACKAGES.has(pkg)) {
                    const files = await this.findPackageUsages(pkg);
                    issues.push({
                        package: pkg,
                        files,
                        suggestion: `Remove ${pkg} - use browser native APIs instead`,
                    });
                }
            }
        }
        catch {
            // Invalid package.json
        }
        return { issues };
    }
}
exports.AgenticLLMClient = AgenticLLMClient;
//# sourceMappingURL=agentic-llm-client.js.map
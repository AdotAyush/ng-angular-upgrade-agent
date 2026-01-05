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
exports.FixStrategyRegistry = void 0;
const fs = __importStar(require("fs"));
const util_1 = require("util");
const types_1 = require("../types");
const angular_migrations_1 = require("./angular-migrations");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
class FixStrategyRegistry {
    strategies = [];
    constructor() {
        this.registerDefaultStrategies();
    }
    registerDefaultStrategies() {
        this.strategies.push(
        // Angular-specific migrations (high priority)
        new angular_migrations_1.HttpClientMigrationStrategy(), new angular_migrations_1.RouterMigrationStrategy(), new angular_migrations_1.RxJSImportStrategy(), 
        // General fix strategies
        new DependencyFixStrategy(), new ImportFixStrategy(), new StandaloneComponentFixStrategy(), new RxJSOperatorFixStrategy(), new TypeScriptStrictFixStrategy(), new AngularCompilationModeFixStrategy(), new UnknownErrorAIFixStrategy() // Fallback for unclassified errors
        );
    }
    async applyFix(error, context) {
        for (const strategy of this.strategies) {
            if (strategy.canHandle(error)) {
                return await strategy.apply(error, context);
            }
        }
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: 'No automatic fix available for this error',
        };
    }
    getStrategy(category) {
        return this.strategies.find(s => s.category === category);
    }
}
exports.FixStrategyRegistry = FixStrategyRegistry;
// Dependency fix strategy
class DependencyFixStrategy {
    name = 'DependencyFixStrategy';
    category = types_1.ErrorCategory.DEPENDENCY;
    isDeterministic = true;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.DEPENDENCY &&
            (error.message.includes('Module not found') ||
                error.message.includes("Can't resolve"));
    }
    async apply(error, context) {
        // Extract the missing module name
        const moduleMatch = error.message.match(/Can't resolve ['"](.+?)['"]/);
        if (!moduleMatch) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: 'Unable to extract module name from error',
            };
        }
        const moduleName = moduleMatch[1];
        // Check if it's a package (not a relative/absolute path)
        if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `Fix relative import path: ${moduleName}`,
            };
        }
        // Extract package name (handle scoped packages)
        const packageName = moduleName.startsWith('@')
            ? moduleName.split('/').slice(0, 2).join('/')
            : moduleName.split('/')[0];
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: `Install or upgrade package: npm install ${packageName}`,
        };
    }
}
// Import fix strategy
class ImportFixStrategy {
    name = 'ImportFixStrategy';
    category = types_1.ErrorCategory.IMPORT;
    isDeterministic = true;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.IMPORT;
    }
    async apply(error, context) {
        if (!error.file) {
            return { success: false, error: 'No file specified' };
        }
        const content = await readFile(error.file, 'utf-8');
        // Check if it's a common Angular import issue
        const missingModule = this.extractMissingModule(error.message);
        if (missingModule) {
            const fix = this.generateImportFix(content, missingModule);
            if (fix) {
                return {
                    success: true,
                    changes: [{
                            file: error.file,
                            type: 'modify',
                            content: fix,
                        }],
                };
            }
        }
        // If deterministic fix failed, try AI
        if (context.llmClient) {
            return await this.tryAIFix(error, context, content);
        }
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: `Add missing import or install package: ${missingModule}`,
        };
    }
    async tryAIFix(error, context, content) {
        try {
            const response = await context.llmClient.generateCode({
                task: {
                    description: `Fix missing module import error`,
                    error: {
                        message: error.message,
                        severity: 'error',
                    },
                    fileContent: content,
                    constraints: [
                        'Add missing import statement or suggest package installation',
                        'Preserve existing code structure',
                    ],
                },
            });
            if (response.code) {
                return {
                    success: true,
                    changes: [{
                            file: error.file,
                            type: 'modify',
                            content: response.code,
                        }],
                };
            }
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: response.reasoning || 'AI could not suggest a fix',
            };
        }
        catch {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: 'Install missing package or add import',
            };
        }
    }
    extractMissingModule(message) {
        const match = message.match(/Cannot find module ['"](.+?)['"]/);
        return match ? match[1] : null;
    }
    generateImportFix(content, module) {
        // Find the last import statement
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        if (lastImportIndex === -1) {
            return null;
        }
        // Add the import after the last import
        const newImport = `import { /* TODO */ } from '${module}';`;
        lines.splice(lastImportIndex + 1, 0, newImport);
        return lines.join('\n');
    }
}
// Standalone component fix strategy
class StandaloneComponentFixStrategy {
    name = 'StandaloneComponentFixStrategy';
    category = types_1.ErrorCategory.STANDALONE;
    isDeterministic = true;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.STANDALONE;
    }
    async apply(error, context) {
        if (!error.file) {
            return { success: false, error: 'No file specified' };
        }
        const content = await readFile(error.file, 'utf-8');
        // Check if component needs imports array
        if (error.message.includes('imports array')) {
            const fixed = this.addImportsArray(content);
            if (fixed) {
                return {
                    success: true,
                    changes: [{
                            file: error.file,
                            type: 'modify',
                            content: fixed,
                        }],
                };
            }
        }
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: 'Manually add required imports to standalone component',
        };
    }
    addImportsArray(content) {
        // Find @Component decorator
        const componentMatch = content.match(/@Component\s*\(\s*\{/);
        if (!componentMatch) {
            return null;
        }
        const index = componentMatch.index + componentMatch[0].length;
        const before = content.substring(0, index);
        const after = content.substring(index);
        return `${before}\n  imports: [],${after}`;
    }
}
// RxJS operator fix strategy
class RxJSOperatorFixStrategy {
    name = 'RxJSOperatorFixStrategy';
    category = types_1.ErrorCategory.RXJS;
    isDeterministic = true;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.RXJS;
    }
    async apply(error, context) {
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: 'RxJS operator changes may require LLM assistance',
        };
    }
}
// TypeScript strict mode fix strategy
class TypeScriptStrictFixStrategy {
    name = 'TypeScriptStrictFixStrategy';
    category = types_1.ErrorCategory.TYPESCRIPT;
    isDeterministic = false;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.TYPESCRIPT &&
            (error.message.includes('possibly undefined') ||
                error.message.includes('possibly null'));
    }
    async apply(error, context) {
        if (!error.file || !error.line) {
            return { success: false, error: 'Missing file or line information' };
        }
        const content = await readFile(error.file, 'utf-8');
        const lines = content.split('\n');
        const targetLine = lines[error.line - 1];
        // Try to add null check
        if (targetLine.includes('.')) {
            const fixed = targetLine.replace(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '?.$1');
            lines[error.line - 1] = fixed;
            return {
                success: true,
                changes: [{
                        file: error.file,
                        type: 'modify',
                        content: lines.join('\n'),
                    }],
            };
        }
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: 'Add null/undefined check or use non-null assertion operator',
        };
    }
}
// Angular compilation mode fix strategy
class AngularCompilationModeFixStrategy {
    name = 'AngularCompilationModeFixStrategy';
    category = types_1.ErrorCategory.COMPILATION;
    isDeterministic = true;
    canHandle(error) {
        return error.category === types_1.ErrorCategory.COMPILATION &&
            error.message.includes('partial compilation mode');
    }
    async apply(error, context) {
        // This is a warning about using partial compilation mode
        // It's usually safe to ignore, but we should suggest updating tsconfig
        return {
            success: false,
            requiresManualIntervention: false,
            suggestion: 'Update tsconfig.json to set "compilationMode": "full" in angularCompilerOptions if needed. This is typically a warning and can be ignored.',
        };
    }
}
// AI-powered fix strategy for unknown errors
class UnknownErrorAIFixStrategy {
    name = 'UnknownErrorAIFixStrategy';
    category = types_1.ErrorCategory.UNKNOWN;
    isDeterministic = false; // AI-based fixes are non-deterministic
    canHandle(error) {
        return error.category === types_1.ErrorCategory.UNKNOWN;
    }
    async apply(error, context) {
        if (!context.llmClient || !error.file || error.line === undefined) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: 'Unknown error - manual inspection required',
            };
        }
        try {
            const content = await readFile(error.file, 'utf-8');
            const lines = content.split('\n');
            const errorLine = error.line;
            const contextStart = Math.max(0, errorLine - 10);
            const contextEnd = Math.min(lines.length, errorLine + 10);
            const contextLines = lines.slice(contextStart, contextEnd).join('\n');
            const response = await context.llmClient.generateCode({
                task: {
                    description: `Fix this build error in an Angular project upgrade`,
                    error: {
                        message: error.message,
                        severity: 'error',
                        line: error.line,
                        column: error.column,
                    },
                    fileContent: contextLines,
                    constraints: [
                        'Preserve existing functionality',
                        'Follow Angular best practices',
                        'Minimal changes only',
                    ],
                },
            });
            if (response.code) {
                // Replace the context section with AI-generated fix
                const fixedLines = [...lines];
                const aiLines = response.code.split('\n');
                fixedLines.splice(contextStart, contextEnd - contextStart, ...aiLines);
                return {
                    success: true,
                    changes: [{
                            file: error.file,
                            type: 'modify',
                            content: fixedLines.join('\n'),
                        }],
                };
            }
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: response.reasoning || 'AI could not suggest a fix',
            };
        }
        catch (error) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `AI fix failed: ${error}`,
            };
        }
    }
}
//# sourceMappingURL=fix-strategies.js.map
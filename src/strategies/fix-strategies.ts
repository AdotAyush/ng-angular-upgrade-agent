import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { BuildError, ErrorCategory, FixStrategy, FixContext, FixResult, FileChange } from '../types';
import { HttpClientMigrationStrategy, RouterMigrationStrategy, RxJSImportStrategy } from './angular-migrations';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export class FixStrategyRegistry {
    private strategies: FixStrategy[] = [];

    constructor() {
        this.registerDefaultStrategies();
    }

    private registerDefaultStrategies(): void {
        this.strategies.push(
            // Angular-specific migrations (high priority)
            new HttpClientMigrationStrategy(),
            new RouterMigrationStrategy(),
            new RxJSImportStrategy(),
            // General fix strategies
            new DependencyFixStrategy(),
            new ImportFixStrategy(),
            new StandaloneComponentFixStrategy(),
            new RxJSOperatorFixStrategy(),
            new TypeScriptStrictFixStrategy(),
            new AngularCompilationModeFixStrategy(),
            new UnknownErrorAIFixStrategy() // Fallback for unclassified errors
        );
    }

    async applyFix(error: BuildError, context: FixContext): Promise<FixResult> {
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

    getStrategy(category: ErrorCategory): FixStrategy | undefined {
        return this.strategies.find(s => s.category === category);
    }
}

    // Dependency fix strategy
class DependencyFixStrategy implements FixStrategy {
    name = 'DependencyFixStrategy';
    category = ErrorCategory.DEPENDENCY;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.DEPENDENCY &&
            (error.message.includes('Module not found') ||
                error.message.includes("Can't resolve"));
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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
class ImportFixStrategy implements FixStrategy {
    name = 'ImportFixStrategy';
    category = ErrorCategory.IMPORT;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.IMPORT;
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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

    private async tryAIFix(error: BuildError, context: FixContext, content: string): Promise<FixResult> {
        try {
            const response = await context.llmClient.generateCode({
                task: {
                    description: `Fix missing module import error`,
                    error: {
                        message: error.message,
                        severity: 'error' as const,
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
                        file: error.file!,
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
        } catch {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: 'Install missing package or add import',
            };
        }
    }

    private extractMissingModule(message: string): string | null {
        const match = message.match(/Cannot find module ['"](.+?)['"]/);
        return match ? match[1] : null;
    }

    private generateImportFix(content: string, module: string): string | null {
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
class StandaloneComponentFixStrategy implements FixStrategy {
    name = 'StandaloneComponentFixStrategy';
    category = ErrorCategory.STANDALONE;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.STANDALONE;
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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

    private addImportsArray(content: string): string | null {
        // Find @Component decorator
        const componentMatch = content.match(/@Component\s*\(\s*\{/);
        if (!componentMatch) {
            return null;
        }

        const index = componentMatch.index! + componentMatch[0].length;
        const before = content.substring(0, index);
        const after = content.substring(index);

        return `${before}\n  imports: [],${after}`;
    }
}

// RxJS operator fix strategy
class RxJSOperatorFixStrategy implements FixStrategy {
    name = 'RxJSOperatorFixStrategy';
    category = ErrorCategory.RXJS;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.RXJS;
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: 'RxJS operator changes may require LLM assistance',
        };
    }
}

// TypeScript strict mode fix strategy
class TypeScriptStrictFixStrategy implements FixStrategy {
    name = 'TypeScriptStrictFixStrategy';
    category = ErrorCategory.TYPESCRIPT;
    isDeterministic = false;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.TYPESCRIPT &&
            (error.message.includes('possibly undefined') ||
                error.message.includes('possibly null'));
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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
class AngularCompilationModeFixStrategy implements FixStrategy {
    name = 'AngularCompilationModeFixStrategy';
    category = ErrorCategory.COMPILATION;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.COMPILATION &&
            error.message.includes('partial compilation mode');
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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
class UnknownErrorAIFixStrategy implements FixStrategy {
    name = 'UnknownErrorAIFixStrategy';
    category = ErrorCategory.UNKNOWN;
    isDeterministic = false; // AI-based fixes are non-deterministic

    canHandle(error: BuildError): boolean {
        return error.category === ErrorCategory.UNKNOWN;
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
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
                    severity: 'error' as const,
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
        } catch (error) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `AI fix failed: ${error}`,
            };
        }
    }
}

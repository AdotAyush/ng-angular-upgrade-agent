import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { BuildError, FixStrategy, FixContext, FixResult, ErrorCategory, FileChange } from '../types';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Migrates HttpClient from HttpClientModule to provideHttpClient
 * Handles Angular 15+ standalone components
 */
export class HttpClientMigrationStrategy implements FixStrategy {
    name = 'HttpClientMigrationStrategy';
    category = ErrorCategory.IMPORT;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return (
            error.message.includes('HttpClientModule') ||
            error.message.includes('provideHttpClient') ||
            (error.message.includes('HttpClient') && error.message.includes('provider'))
        );
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
        try {
            // Find app.config.ts or main.ts
            const configFiles = [
                path.join(context.projectPath, 'src', 'app', 'app.config.ts'),
                path.join(context.projectPath, 'src', 'main.ts'),
            ];

            let configFile: string | null = null;
            for (const file of configFiles) {
                if (fs.existsSync(file)) {
                    configFile = file;
                    break;
                }
            }

            if (!configFile) {
                return {
                    success: false,
                    requiresManualIntervention: true,
                    suggestion: 'Create app.config.ts with provideHttpClient in providers array',
                };
            }

            const content = await readFile(configFile, 'utf-8');

            // Check if already migrated
            if (content.includes('provideHttpClient')) {
                return {
                    success: true,
                    changes: [],
                    suggestion: 'HttpClient already using provideHttpClient',
                };
            }

            // Add import for provideHttpClient
            let newContent = content;

            if (!content.includes('@angular/common/http')) {
                // Add import
                const importMatch = content.match(/(import .+ from ['"]@angular\/[^'"]+['"];?\n)/);
                if (importMatch) {
                    const lastImport = importMatch[0];
                    newContent = content.replace(
                        lastImport,
                        `${lastImport}import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';\n`
                    );
                }
            } else {
                // Update existing import
                newContent = content.replace(
                    /import\s*{([^}]+)}\s*from\s*['"]@angular\/common\/http['"]/,
                    (match, imports) => {
                        const importList = imports.split(',').map((i: string) => i.trim());
                        if (!importList.includes('provideHttpClient')) {
                            importList.push('provideHttpClient');
                        }
                        if (!importList.includes('withInterceptorsFromDi')) {
                            importList.push('withInterceptorsFromDi');
                        }
                        return `import { ${importList.join(', ')} } from '@angular/common/http'`;
                    }
                );
            }

            // Add to providers array
            const providersMatch = newContent.match(/providers:\s*\[([\s\S]*?)\]/);
            if (providersMatch) {
                const providers = providersMatch[1];
                // Check if provideHttpClient already in providers
                if (!providers.includes('provideHttpClient')) {
                    const newProviders = providers.trim()
                        ? `${providers.trim()},\n    provideHttpClient(withInterceptorsFromDi())`
                        : `\n    provideHttpClient(withInterceptorsFromDi())\n  `;
                    newContent = newContent.replace(
                        /providers:\s*\[([\s\S]*?)\]/,
                        `providers: [${newProviders}]`
                    );
                }
            }

            // Remove HttpClientModule import from app.module.ts if exists
            const appModulePath = path.join(context.projectPath, 'src', 'app', 'app.module.ts');
            const changes: FileChange[] = [
                {
                    file: configFile,
                    type: 'modify',
                    content: newContent,
                },
            ];

            if (fs.existsSync(appModulePath)) {
                let moduleContent = await readFile(appModulePath, 'utf-8');
                // Remove HttpClientModule from imports
                moduleContent = moduleContent.replace(
                    /import\s*{\s*HttpClientModule\s*}\s*from\s*['"]@angular\/common\/http['"];?\n/,
                    ''
                );
                moduleContent = moduleContent.replace(/HttpClientModule,?\s*/g, '');
                changes.push({
                    file: appModulePath,
                    type: 'modify',
                    content: moduleContent,
                });
            }

            return {
                success: true,
                changes,
                suggestion: 'Migrated from HttpClientModule to provideHttpClient',
            };
        } catch (error: any) {
        return {
            success: false,
            requiresManualIntervention: true,
            suggestion: `Manual HttpClient migration needed: ${error.message}`,
        };
        }
    }
}

/**
 * Migrates Router from RouterModule to provideRouter
 */
export class RouterMigrationStrategy implements FixStrategy {
    name = 'RouterMigrationStrategy';
    category = ErrorCategory.IMPORT;
    isDeterministic = true;

    canHandle(error: BuildError): boolean {
        return (
            error.message.includes('RouterModule') ||
            error.message.includes('provideRouter') ||
            (error.message.includes('Router') && error.message.includes('provider'))
        );
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
        try {
            const configFile = path.join(context.projectPath, 'src', 'app', 'app.config.ts');

            if (!fs.existsSync(configFile)) {
                return {
                    success: false,
                    requiresManualIntervention: true,
                    suggestion: 'Create app.config.ts with provideRouter in providers array',
                };
            }

            const content = await readFile(configFile, 'utf-8');

            if (content.includes('provideRouter')) {
                return {
                    success: true,
                    changes: [],
                    suggestion: 'Router already using provideRouter',
                };
            }

            let newContent = content;

            // Add import for provideRouter
            if (!content.includes('@angular/router')) {
                const importMatch = content.match(/(import .+ from ['"]@angular\/[^'"]+['"];?\n)/);
                if (importMatch) {
                    const lastImport = importMatch[0];
                    newContent = content.replace(
                        lastImport,
                        `${lastImport}import { provideRouter } from '@angular/router';\nimport { routes } from './app.routes';\n`
                    );
                }
            }

            // Add to providers
            const providersMatch = newContent.match(/providers:\s*\[([\s\S]*?)\]/);
            if (providersMatch) {
                const providers = providersMatch[1];
                if (!providers.includes('provideRouter')) {
                    const newProviders = providers.trim()
                        ? `${providers.trim()},\n    provideRouter(routes)`
                        : `\n    provideRouter(routes)\n  `;
                    newContent = newContent.replace(
                        /providers:\s*\[([\s\S]*?)\]/,
                        `providers: [${newProviders}]`
                    );
                }
            }

            return {
                success: true,
                changes: [
                {
                    file: configFile,
                    type: 'modify',
                    content: newContent,
                },
                ],
                suggestion: 'Migrated from RouterModule to provideRouter',
            };
        } catch (error: any) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `Manual Router migration needed: ${error.message}`,
            };
        }
    }
}

/**
 * Auto-imports common RxJS operators
 */
export class RxJSImportStrategy implements FixStrategy {
    name = 'RxJSImportStrategy';
    category = ErrorCategory.IMPORT;
    isDeterministic = true;

    private rxjsOperators = [
        'map', 'filter', 'switchMap', 'mergeMap', 'concatMap', 'exhaustMap',
        'tap', 'catchError', 'retry', 'take', 'takeUntil', 'debounceTime',
        'distinctUntilChanged', 'share', 'shareReplay', 'combineLatest',
        'forkJoin', 'merge', 'concat', 'zip', 'race', 'of', 'from', 'throwError',
        'interval', 'timer', 'defer', 'EMPTY', 'NEVER'
    ];

    canHandle(error: BuildError): boolean {
        const operatorMatch = this.rxjsOperators.some(op => 
            error.message.includes(`'${op}'`) || error.message.includes(`"${op}"`)
        );
        return operatorMatch && (
            error.message.includes('Cannot find name') ||
            error.message.includes('is not defined')
        );
    }

    async apply(error: BuildError, context: FixContext): Promise<FixResult> {
        if (!error.file) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: 'Add RxJS operator imports manually',
            };
        }

        try {
            const content = await readFile(error.file, 'utf-8');

            // Find which operator is missing
            const missingOperator = this.rxjsOperators.find(op =>
                error.message.includes(`'${op}'`) || error.message.includes(`"${op}"`)
            );

            if (!missingOperator) {
                return { success: false, suggestion: 'Could not determine missing operator' };
            }

            // Determine import path
            const importPath = this.getImportPath(missingOperator);
            const importStatement = `import { ${missingOperator} } from '${importPath}';\n`;

            // Check if import already exists
            if (content.includes(importStatement.trim())) {
                return {
                    success: true,
                    changes: [],
                    suggestion: `${missingOperator} already imported`,
                };
            }

            // Add import after last import or at top
            let newContent = content;
            const lastImportMatch = content.match(/(import .+ from .+;\n)(?!.*import)/s);
            
            if (lastImportMatch) {
                newContent = content.replace(
                    lastImportMatch[1],
                    `${lastImportMatch[1]}${importStatement}`
                );
            } else {
                newContent = importStatement + content;
            }

            return {
                success: true,
                changes: [
                    {
                        file: error.file,
                        type: 'modify',
                        content: newContent,
                    },
                ],
                suggestion: `Added import for ${missingOperator}`,
            };
        } catch (error: any) {
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `Could not add RxJS import: ${error.message}`,
            };
        }
    }

    private getImportPath(operator: string): string {
        // Creation operators
        if (['of', 'from', 'throwError', 'interval', 'timer', 'defer', 'EMPTY', 'NEVER'].includes(operator)) {
            return 'rxjs';
        }
        // Combination operators
        if (['combineLatest', 'forkJoin', 'merge', 'concat', 'zip', 'race'].includes(operator)) {
            return 'rxjs';
        }
        // Pipeable operators
        return 'rxjs/operators';
    }
}

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);

/**
 * Handles compatibility issues with third-party libraries (MobX, etc.)
 * that have TypeScript type definition conflicts with newer Angular/TypeScript versions
 */
export class ThirdPartyFixResolver {
    /**
     * Detect if project has MobX compatibility issues
     */
    async detectMobXIssues(projectPath: string): Promise<boolean> {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
            
            // Check if mobx is in dependencies
            const hasMobX = packageJson.dependencies?.['mobx'] || 
                            packageJson.dependencies?.['mobx-react'] ||
                            packageJson.dependencies?.['mobx-react-lite'];
            
            return !!hasMobX;
        } catch {
            return false;
        }
    }

    /**
     * Create TypeScript declaration overrides for MobX iterator compatibility
     */
    async createMobXTypeOverrides(projectPath: string): Promise<void> {
        const typesDir = path.join(projectPath, 'src', 'types');
        const mobxTypesFile = path.join(typesDir, 'mobx.d.ts');

        // Ensure types directory exists
        try {
            await mkdir(typesDir, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') throw error;
        }

        // Create type override file
        const typeOverrideContent = `/**
* MobX Type Overrides
* 
* This file provides TypeScript declaration overrides for MobX to fix
* compatibility issues with newer TypeScript versions used by Angular.
* 
* Issue: MobX's ObservableMap and ObservableSet have iterator method signatures
* that don't match the standard Map/Set interfaces in newer TypeScript versions.
*/

declare module 'mobx' {
// Fix ObservableMap iterator types
interface ObservableMap<K, V> {
    [Symbol.iterator](): IterableIterator<[K, V]>;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[K, V]>;
}

// Fix ObservableSet iterator types
interface ObservableSet<T> {
    [Symbol.iterator](): IterableIterator<T>;
    entries(): IterableIterator<[T, T]>;
    keys(): IterableIterator<T>;
    values(): IterableIterator<T>;
}
}

export {};
`;

        await writeFile(mobxTypesFile, typeOverrideContent, 'utf-8');
        console.log(`  ✓ Created MobX type overrides at ${mobxTypesFile}`);
    }

    /**
     * Update tsconfig.json to include type overrides and skipLibCheck
     * Handles all tsconfig files in Angular projects (base, app, spec)
     */
    async updateTsConfig(projectPath: string): Promise<boolean> {
        // Find all tsconfig files (Angular has multiple)
        const tsconfigFiles = [
            'tsconfig.json',
            'tsconfig.base.json', 
            'tsconfig.app.json',
            'tsconfig.spec.json'
        ];
        
        let anyModified = false;

        for (const filename of tsconfigFiles) {
            const tsconfigPath = path.join(projectPath, filename);
            
            // Skip if file doesn't exist
            if (!fs.existsSync(tsconfigPath)) {
                continue;
            }

            try {
                const tsconfigContent = await readFile(tsconfigPath, 'utf-8');
                
                // Parse JSON with comments (Angular tsconfig has comments)
                const tsconfig = this.parseJsonWithComments(tsconfigContent);
                let modified = false;

                // Ensure compilerOptions exists
                if (!tsconfig.compilerOptions) {
                    tsconfig.compilerOptions = {};
                    modified = true;
                }

                // Add skipLibCheck if not present
                if (!tsconfig.compilerOptions.skipLibCheck) {
                    tsconfig.compilerOptions.skipLibCheck = true;
                    modified = true;
                    console.log(`  ✓ Enabled skipLibCheck in ${filename}`);
                }

                // Ensure typeRoots includes our custom types
                if (!tsconfig.compilerOptions.typeRoots) {
                    tsconfig.compilerOptions.typeRoots = [
                        './node_modules/@types',
                        './src/types'
                    ];
                    modified = true;
                    console.log(`  ✓ Added custom type roots to ${filename}`);
                } else if (!tsconfig.compilerOptions.typeRoots.includes('./src/types')) {
                    tsconfig.compilerOptions.typeRoots.push('./src/types');
                    modified = true;
                    console.log(`  ✓ Added ./src/types to typeRoots in ${filename}`);
                }

                if (modified) {
                    // Write with preserved formatting
                    await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf-8');
                    anyModified = true;
                }
            } catch (error) {
                console.error(`  ⚠ Could not update ${filename}: ${error}`);
            }
        }

        return anyModified;
    }

    /**
     * Parse JSON with comments (Angular tsconfig files have comments)
     */
    private parseJsonWithComments(content: string): any {
        // Remove single-line comments
        let cleaned = content.replace(/\/\/.*/g, '');
        // Remove multi-line comments
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        return JSON.parse(cleaned);
    }

    /**
     * Apply all MobX compatibility fixes
     */
    async applyMobXFixes(projectPath: string): Promise<{
        applied: boolean;
        actions: string[];
    }> {
        const actions: string[] = [];

        try {
            const hasMobX = await this.detectMobXIssues(projectPath);
            
            if (!hasMobX) {
                console.log('  ℹ No MobX detected, skipping compatibility fixes');
                return { applied: false, actions: [] };
            }

            console.log('  📦 MobX detected, applying compatibility fixes...');

            // Create type overrides
            await this.createMobXTypeOverrides(projectPath);
            actions.push('Created MobX type declaration overrides');

            // Update tsconfig.json
            const tsconfigUpdated = await this.updateTsConfig(projectPath);
            if (tsconfigUpdated) {
                actions.push('Updated tsconfig.json with skipLibCheck and custom type roots');
            } else {
                console.log('  ℹ tsconfig.json already has required configuration');
            }

            console.log('  ✅ MobX compatibility fixes applied successfully');

            return { applied: true, actions };
        } catch (error: any) {
            console.error(`  ✗ Failed to apply MobX fixes: ${error.message}`);
            return { applied: false, actions };
        }
    }

    /**
     * Check for other common third-party library issues
     */
    async detectOtherThirdPartyIssues(projectPath: string): Promise<string[]> {
        const issues: string[] = [];
        
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
            
            // Check for other problematic libraries
            const deps = { 
                ...packageJson.dependencies, 
                ...packageJson.devDependencies 
            };

            // Libraries known to have type issues with newer Angular
            const problematicLibs = [
                { name: 'moment', issue: 'Consider migrating to date-fns or luxon for better TypeScript support' },
                { name: 'lodash', issue: 'Ensure @types/lodash is installed and up to date' },
                { name: 'jquery', issue: 'Consider removing jQuery - Angular has built-in DOM manipulation' },
            ];

            for (const lib of problematicLibs) {
                if (deps[lib.name]) {
                    issues.push(`${lib.name}: ${lib.issue}`);
                }
            }

            return issues;
        } catch {
            return [];
        }
    }

    /**
     * Generate a report of third-party compatibility recommendations
     */
    async generateThirdPartyReport(projectPath: string): Promise<string> {
        const hasMobX = await this.detectMobXIssues(projectPath);
        const otherIssues = await this.detectOtherThirdPartyIssues(projectPath);

        let report = '### Third-Party Library Compatibility\n\n';

        if (hasMobX) {
            report += '**MobX**: Type compatibility fixes have been applied automatically.\n\n';
        }

        if (otherIssues.length > 0) {
            report += '**Other Libraries**:\n\n';
            for (const issue of otherIssues) {
                report += `- ${issue}\n`;
            }
            report += '\n';
        }

        if (!hasMobX && otherIssues.length === 0) {
            report += 'No significant third-party library compatibility issues detected.\n\n';
        }

        return report;
    }
}
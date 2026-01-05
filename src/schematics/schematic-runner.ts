import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Runs Angular CLI's official ng update migrations
 * These handle most common Angular upgrade scenarios automatically
 */
export class AngularSchematicRunner {
    /**
     * Run Angular CLI and Core migrations
     * This executes the official Angular update schematics
     */
    async runOfficialMigrations(
        projectPath: string,
        targetVersion: string
    ): Promise<{
        success: boolean;
        output: string;
        migrationsRun: string[];
    }> {
        const migrationsRun: string[] = [];
        let combinedOutput = '';

        try {
            console.log('\n🔧 Running official Angular migrations...');

            // Step 1: Update @angular/cli
            console.log('  → Updating @angular/cli...');
            try {
                const { stdout: cliOutput, stderr: cliError } = await execAsync(
                    `npx @angular/cli@${targetVersion} update @angular/cli --migrate-only --allow-dirty --force`,
                    {
                        cwd: projectPath,
                        maxBuffer: 50 * 1024 * 1024, // 50MB
                    }
                );
                combinedOutput += cliOutput + cliError;
                migrationsRun.push('@angular/cli');
                console.log('  ✓ @angular/cli migrations completed');
            } catch (error: any) {
                // Continue even if CLI migration fails
                combinedOutput += error.stdout + error.stderr;
                console.log('  ⚠ @angular/cli migrations had issues (continuing)');
            }

            // Step 2: Update @angular/core
            console.log('  → Updating @angular/core...');
            try {
                const { stdout: coreOutput, stderr: coreError } = await execAsync(
                    `npx @angular/cli@${targetVersion} update @angular/core --migrate-only --allow-dirty --force`,
                    {
                        cwd: projectPath,
                        maxBuffer: 50 * 1024 * 1024,
                    }
                );
                combinedOutput += coreOutput + coreError;
                migrationsRun.push('@angular/core');
                console.log('  ✓ @angular/core migrations completed');
            } catch (error: any) {
                combinedOutput += error.stdout + error.stderr;
                console.log('  ⚠ @angular/core migrations had issues (continuing)');
            }

            // Step 3: Update @angular/material (if present)
            const packageJsonPath = path.join(projectPath, 'package.json');
            try {
                const packageJson = require(packageJsonPath);
                if (packageJson.dependencies?.['@angular/material']) {
                    console.log('  → Updating @angular/material...');
                    try {
                        const { stdout: matOutput, stderr: matError } = await execAsync(
                            `npx @angular/cli@${targetVersion} update @angular/material --migrate-only --allow-dirty --force`,
                            {
                                cwd: projectPath,
                                maxBuffer: 50 * 1024 * 1024,
                            }
                        );
                        combinedOutput += matOutput + matError;
                        migrationsRun.push('@angular/material');
                        console.log('  ✓ @angular/material migrations completed');
                    } catch (error: any) {
                        combinedOutput += error.stdout + error.stderr;
                        console.log('  ⚠ @angular/material migrations had issues (continuing)');
                    }
                }
            } catch {
                // package.json not found or no material
            }

            console.log(`\n✅ Official migrations completed (${migrationsRun.length} packages)`);

            return {
                success: true,
                output: combinedOutput,
                migrationsRun,
            };
        } catch (error: any) {
            console.error('  ✗ Official migrations failed:', error.message);
            return {
                success: false,
                output: combinedOutput + (error.message || ''),
                migrationsRun,
            };
        }
    }

    /**
     * Run additional common migrations
     */
    async runCommonMigrations(
        projectPath: string,
        targetVersion: string
    ): Promise<string[]> {
        const migrations: string[] = [];

        try {
        // Run common third-party package migrations
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = require(packageJsonPath);

        // NgRx migrations
        if (packageJson.dependencies?.['@ngrx/store']) {
            console.log('  → Running @ngrx migrations...');
            try {
            await execAsync(
                `npx @angular/cli@${targetVersion} update @ngrx/store --migrate-only --allow-dirty --force`,
                { cwd: projectPath, maxBuffer: 50 * 1024 * 1024 }
            );
            migrations.push('@ngrx/store');
            console.log('  ✓ @ngrx migrations completed');
            } catch {
            console.log('  ⚠ @ngrx migrations not available');
            }
        }

        // Angular CDK
        if (packageJson.dependencies?.['@angular/cdk']) {
            console.log('  → Running @angular/cdk migrations...');
            try {
            await execAsync(
                `npx @angular/cli@${targetVersion} update @angular/cdk --migrate-only --allow-dirty --force`,
                { cwd: projectPath, maxBuffer: 50 * 1024 * 1024 }
            );
            migrations.push('@angular/cdk');
            console.log('  ✓ @angular/cdk migrations completed');
            } catch {
            console.log('  ⚠ @angular/cdk migrations not available');
            }
        }
        } catch (error) {
        console.log('  ⚠ Could not run additional migrations');
        }

        return migrations;
    }

    /**
     * Extract migration details from output
     */
    extractMigrationInfo(output: string): {
        filesModified: string[];
        migrationsApplied: string[];
    } {
        const filesModified: string[] = [];
        const migrationsApplied: string[] = [];

        // Parse Angular CLI migration output
        const updateMatch = output.match(/UPDATE (.+)/g);
        if (updateMatch) {
            updateMatch.forEach((match) => {
                const file = match.replace('UPDATE ', '').trim();
                if (!filesModified.includes(file)) {
                    filesModified.push(file);
                }
            });
        }

        // Parse migration names
        const migrationMatch = output.match(/Running migration "(.+)"/g);
        if (migrationMatch) {
            migrationMatch.forEach((match) => {
                const migration = match.replace(/Running migration "(.+)"/, '$1');
                if (!migrationsApplied.includes(migration)) {
                    migrationsApplied.push(migration);
                }
            });
        }

        return { filesModified, migrationsApplied };
    }
}

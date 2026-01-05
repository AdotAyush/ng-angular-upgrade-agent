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
exports.AngularSchematicRunner = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Runs Angular CLI's official ng update migrations
 * These handle most common Angular upgrade scenarios automatically
 */
class AngularSchematicRunner {
    /**
     * Run Angular CLI and Core migrations
     * This executes the official Angular update schematics
     */
    async runOfficialMigrations(projectPath, targetVersion) {
        const migrationsRun = [];
        let combinedOutput = '';
        try {
            console.log('\n🔧 Running official Angular migrations...');
            // Step 1: Update @angular/cli
            console.log('  → Updating @angular/cli...');
            try {
                const { stdout: cliOutput, stderr: cliError } = await execAsync(`npx @angular/cli@${targetVersion} update @angular/cli --migrate-only --allow-dirty --force`, {
                    cwd: projectPath,
                    maxBuffer: 50 * 1024 * 1024, // 50MB
                });
                combinedOutput += cliOutput + cliError;
                migrationsRun.push('@angular/cli');
                console.log('  ✓ @angular/cli migrations completed');
            }
            catch (error) {
                // Continue even if CLI migration fails
                combinedOutput += error.stdout + error.stderr;
                console.log('  ⚠ @angular/cli migrations had issues (continuing)');
            }
            // Step 2: Update @angular/core
            console.log('  → Updating @angular/core...');
            try {
                const { stdout: coreOutput, stderr: coreError } = await execAsync(`npx @angular/cli@${targetVersion} update @angular/core --migrate-only --allow-dirty --force`, {
                    cwd: projectPath,
                    maxBuffer: 50 * 1024 * 1024,
                });
                combinedOutput += coreOutput + coreError;
                migrationsRun.push('@angular/core');
                console.log('  ✓ @angular/core migrations completed');
            }
            catch (error) {
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
                        const { stdout: matOutput, stderr: matError } = await execAsync(`npx @angular/cli@${targetVersion} update @angular/material --migrate-only --allow-dirty --force`, {
                            cwd: projectPath,
                            maxBuffer: 50 * 1024 * 1024,
                        });
                        combinedOutput += matOutput + matError;
                        migrationsRun.push('@angular/material');
                        console.log('  ✓ @angular/material migrations completed');
                    }
                    catch (error) {
                        combinedOutput += error.stdout + error.stderr;
                        console.log('  ⚠ @angular/material migrations had issues (continuing)');
                    }
                }
            }
            catch {
                // package.json not found or no material
            }
            console.log(`\n✅ Official migrations completed (${migrationsRun.length} packages)`);
            return {
                success: true,
                output: combinedOutput,
                migrationsRun,
            };
        }
        catch (error) {
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
    async runCommonMigrations(projectPath, targetVersion) {
        const migrations = [];
        try {
            // Run common third-party package migrations
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = require(packageJsonPath);
            // NgRx migrations
            if (packageJson.dependencies?.['@ngrx/store']) {
                console.log('  → Running @ngrx migrations...');
                try {
                    await execAsync(`npx @angular/cli@${targetVersion} update @ngrx/store --migrate-only --allow-dirty --force`, { cwd: projectPath, maxBuffer: 50 * 1024 * 1024 });
                    migrations.push('@ngrx/store');
                    console.log('  ✓ @ngrx migrations completed');
                }
                catch {
                    console.log('  ⚠ @ngrx migrations not available');
                }
            }
            // Angular CDK
            if (packageJson.dependencies?.['@angular/cdk']) {
                console.log('  → Running @angular/cdk migrations...');
                try {
                    await execAsync(`npx @angular/cli@${targetVersion} update @angular/cdk --migrate-only --allow-dirty --force`, { cwd: projectPath, maxBuffer: 50 * 1024 * 1024 });
                    migrations.push('@angular/cdk');
                    console.log('  ✓ @angular/cdk migrations completed');
                }
                catch {
                    console.log('  ⚠ @angular/cdk migrations not available');
                }
            }
        }
        catch (error) {
            console.log('  ⚠ Could not run additional migrations');
        }
        return migrations;
    }
    /**
     * Extract migration details from output
     */
    extractMigrationInfo(output) {
        const filesModified = [];
        const migrationsApplied = [];
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
exports.AngularSchematicRunner = AngularSchematicRunner;
//# sourceMappingURL=schematic-runner.js.map
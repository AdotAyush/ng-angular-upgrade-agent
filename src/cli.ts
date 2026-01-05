#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { UpgradeOrchestrator } from './upgrade-orchestrator';
import { UpgradeConfig } from './types';
import { VersionUtils } from './utils/version-utils';

const program = new Command();

program
  .name('ng-upgrade')
  .description('Production-grade Angular version upgrade tool with AI-powered error resolution')
  .version('2.0.0')
  .requiredOption('-p, --project <path>', 'Path to Angular project')
  .requiredOption('-f, --from <version>', 'Source Angular version (e.g., 15.0.0)')
  .requiredOption('-t, --to <version>', 'Target Angular version (e.g., 17.0.0)')
  .requiredOption('-k, --api-key <key>', 'LLM API key (Bedrock/Gemini)')
  .option('--provider <provider>', 'LLM provider: bedrock or gemini', 'gemini')
  .option('--model <model>', 'LLM model (e.g., anthropic.claude-v2, gemini-pro)')
  .option('--aws-region <region>', 'AWS region for Bedrock (default: us-east-1)', 'us-east-1')
  .option('--aws-secret-key <key>', 'AWS Secret Access Key for Bedrock')
  .option('--gemini-api-key <key>', 'Google Gemini API key (if using gemini provider)')
  .option('-m, --max-attempts <number>', 'Maximum build fix attempts', '10')
  .option('--dry-run', 'Simulate upgrade without making changes', false)
  .option('--no-cache', 'Disable LLM response caching')
  .option('--no-agentic', 'Disable agentic mode (multi-step AI reasoning)')
  .option('--verbose', 'Enable verbose logging for debugging', false)
  .action(async (options) => {
        const spinner = ora();

        try {
            console.log(chalk.bold.blue('\n🚀 Angular Upgrade Agent v2.0\n'));

            // Validate project path exists and is Angular project
            const projectPath = path.resolve(options.project);
            if (!fs.existsSync(projectPath)) {
                throw new Error(`Project path does not exist: ${projectPath}`);
            }
            
            const angularJson = path.join(projectPath, 'angular.json');
            if (!fs.existsSync(angularJson)) {
                throw new Error(`Not an Angular project (angular.json not found): ${projectPath}`);
            }

            // Resolve version strings (handle major-only versions like "20")
            let sourceVersion = options.from;
            let targetVersion = options.to;
            
            // Resolve source version if it's major-only
            if (VersionUtils.isMajorVersionOnly(sourceVersion)) {
                spinner.start(`Resolving source version ${sourceVersion}...`);
                const resolved = await VersionUtils.resolveAngularVersion(sourceVersion);
                spinner.stop();
                if (resolved.error && !resolved.version) {
                    throw new Error(`Could not resolve source version: ${resolved.error}`);
                }
                sourceVersion = resolved.version;
                if (resolved.wasResolved) {
                    console.log(chalk.green(`  ✓ Source version resolved: ${sourceVersion}`));
                }
            }
            
            // Resolve target version if it's major-only
            if (VersionUtils.isMajorVersionOnly(targetVersion)) {
                spinner.start(`Resolving target version ${targetVersion}...`);
                const resolved = await VersionUtils.resolveAngularVersion(targetVersion);
                spinner.stop();
                if (resolved.error && !resolved.version) {
                    throw new Error(`Could not resolve target version: ${resolved.error}`);
                }
                targetVersion = resolved.version;
                if (resolved.wasResolved) {
                    console.log(chalk.green(`  ✓ Target version resolved: ${targetVersion}`));
                }
            }

            const config: UpgradeConfig = {
                projectPath,
                sourceAngularVersion: sourceVersion,
                targetAngularVersion: targetVersion,
                llmApiKey: options.apiKey,
                llmProvider: options.provider as 'bedrock' | 'gemini',
                llmModel: options.model,
                awsRegion: options.awsRegion,
                awsSecretKey: options.awsSecretKey,
                geminiApiKey: options.geminiApiKey,
                maxBuildAttempts: parseInt(options.maxAttempts),
                dryRun: options.dryRun,
                useCache: options.cache !== false,
                useAgenticMode: options.agentic !== false,
                verbose: options.verbose,
            };

            // Validate inputs
            if (!config.projectPath) {
                throw new Error('Project path is required');
            }

            if (!config.sourceAngularVersion || !config.targetAngularVersion) {
                throw new Error('Source and target versions are required');
            }

            if (!config.llmApiKey) {
                throw new Error('API key is required');
            }

            // Validate version format and upgrade path
            const versionValidation = VersionUtils.validateUpgradePath(
                config.sourceAngularVersion,
                config.targetAngularVersion
            );

            if (!versionValidation.valid) {
                throw new Error(`Invalid upgrade path: ${versionValidation.reason}`);
            }

            console.log(chalk.gray('Configuration:'));
            console.log(chalk.gray(`  Project: ${config.projectPath}`));
            console.log(chalk.gray(`  From: Angular ${config.sourceAngularVersion}`));
            console.log(chalk.gray(`  To: Angular ${config.targetAngularVersion}`));
            console.log(chalk.gray(`  LLM Provider: ${config.llmProvider}`));
            if (config.llmModel) {
                console.log(chalk.gray(`  LLM Model: ${config.llmModel}`));
            }
            if (config.llmProvider === 'bedrock') {
                console.log(chalk.gray(`  AWS Region: ${config.awsRegion}`));
            }
            if (config.llmProvider === 'gemini' && config.geminiApiKey) {
                console.log(chalk.gray(`  Gemini API Key: ${config.geminiApiKey.substring(0, 10)}...`));
            }
            console.log(chalk.gray(`  Max Attempts: ${config.maxBuildAttempts}`));
            console.log(chalk.gray(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`));
            console.log(chalk.gray(`  Response Cache: ${config.useCache ? 'Enabled' : 'Disabled'}`));
            console.log(chalk.gray(`  Agentic Mode: ${config.useAgenticMode ? 'Enabled' : 'Disabled'}`));
            console.log(chalk.gray(`  Verbose: ${config.verbose ? 'Yes' : 'No'}\n`));

            // Create orchestrator
            const orchestrator = new UpgradeOrchestrator(config);

            // Execute upgrade
            spinner.start('Starting upgrade process...');
            const report = await orchestrator.execute();
            spinner.stop();

            // Print results
            console.log('\n' + chalk.bold('═'.repeat(60)) + '\n');
            
            if (report.success) {
                console.log(chalk.bold.green('✓ Upgrade completed successfully!\n'));
            } else {
                console.log(chalk.bold.red('✗ Upgrade completed with issues\n'));
            }

            console.log(chalk.bold('Summary:'));
            console.log(`  Modified Files: ${chalk.yellow(report.modifiedFiles.length)}`);
            console.log(`  Build Status: ${report.buildPassed ? chalk.green('✓ Passed') : chalk.red('✗ Failed')}`);
            console.log(`  Test Status: ${report.testsPassed ? chalk.green('✓ Passed') : chalk.red('✗ Failed')}`);
            
            if (report.unresolvedIssues.length > 0) {
                console.log(`  Unresolved Issues: ${chalk.red(report.unresolvedIssues.length)}`);
            }

            if (report.manualActions.length > 0) {
                console.log(chalk.bold.yellow('\n⚠ Manual Actions Required:\n'));
                report.manualActions.forEach((action, i) => {
                    console.log(chalk.yellow(`  ${i + 1}. ${action}`));
                });
            }

            // Save report
            const reportPath = path.join(config.projectPath, 'upgrade-report.md');
            console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}\n`));

            process.exit(report.success ? 0 : 1);
        } catch (error: any) {
            spinner.stop();
            console.error(chalk.bold.red('\n✗ Error:'), error.message);
            console.error(chalk.gray(error.stack));
            process.exit(1);
        }
    }
);

program.parse();

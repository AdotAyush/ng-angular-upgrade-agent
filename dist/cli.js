#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const upgrade_orchestrator_1 = require("./upgrade-orchestrator");
const version_utils_1 = require("./utils/version-utils");
const program = new commander_1.Command();
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
    const spinner = (0, ora_1.default)();
    try {
        console.log(chalk_1.default.bold.blue('\n🚀 Angular Upgrade Agent v2.0\n'));
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
        if (version_utils_1.VersionUtils.isMajorVersionOnly(sourceVersion)) {
            spinner.start(`Resolving source version ${sourceVersion}...`);
            const resolved = await version_utils_1.VersionUtils.resolveAngularVersion(sourceVersion);
            spinner.stop();
            if (resolved.error && !resolved.version) {
                throw new Error(`Could not resolve source version: ${resolved.error}`);
            }
            sourceVersion = resolved.version;
            if (resolved.wasResolved) {
                console.log(chalk_1.default.green(`  ✓ Source version resolved: ${sourceVersion}`));
            }
        }
        // Resolve target version if it's major-only
        if (version_utils_1.VersionUtils.isMajorVersionOnly(targetVersion)) {
            spinner.start(`Resolving target version ${targetVersion}...`);
            const resolved = await version_utils_1.VersionUtils.resolveAngularVersion(targetVersion);
            spinner.stop();
            if (resolved.error && !resolved.version) {
                throw new Error(`Could not resolve target version: ${resolved.error}`);
            }
            targetVersion = resolved.version;
            if (resolved.wasResolved) {
                console.log(chalk_1.default.green(`  ✓ Target version resolved: ${targetVersion}`));
            }
        }
        const config = {
            projectPath,
            sourceAngularVersion: sourceVersion,
            targetAngularVersion: targetVersion,
            llmApiKey: options.apiKey,
            llmProvider: options.provider,
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
        const versionValidation = version_utils_1.VersionUtils.validateUpgradePath(config.sourceAngularVersion, config.targetAngularVersion);
        if (!versionValidation.valid) {
            throw new Error(`Invalid upgrade path: ${versionValidation.reason}`);
        }
        console.log(chalk_1.default.gray('Configuration:'));
        console.log(chalk_1.default.gray(`  Project: ${config.projectPath}`));
        console.log(chalk_1.default.gray(`  From: Angular ${config.sourceAngularVersion}`));
        console.log(chalk_1.default.gray(`  To: Angular ${config.targetAngularVersion}`));
        console.log(chalk_1.default.gray(`  LLM Provider: ${config.llmProvider}`));
        if (config.llmModel) {
            console.log(chalk_1.default.gray(`  LLM Model: ${config.llmModel}`));
        }
        if (config.llmProvider === 'bedrock') {
            console.log(chalk_1.default.gray(`  AWS Region: ${config.awsRegion}`));
        }
        if (config.llmProvider === 'gemini' && config.geminiApiKey) {
            console.log(chalk_1.default.gray(`  Gemini API Key: ${config.geminiApiKey.substring(0, 10)}...`));
        }
        console.log(chalk_1.default.gray(`  Max Attempts: ${config.maxBuildAttempts}`));
        console.log(chalk_1.default.gray(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`));
        console.log(chalk_1.default.gray(`  Response Cache: ${config.useCache ? 'Enabled' : 'Disabled'}`));
        console.log(chalk_1.default.gray(`  Agentic Mode: ${config.useAgenticMode ? 'Enabled' : 'Disabled'}`));
        console.log(chalk_1.default.gray(`  Verbose: ${config.verbose ? 'Yes' : 'No'}\n`));
        // Create orchestrator
        const orchestrator = new upgrade_orchestrator_1.UpgradeOrchestrator(config);
        // Execute upgrade
        spinner.start('Starting upgrade process...');
        const report = await orchestrator.execute();
        spinner.stop();
        // Print results
        console.log('\n' + chalk_1.default.bold('═'.repeat(60)) + '\n');
        if (report.success) {
            console.log(chalk_1.default.bold.green('✓ Upgrade completed successfully!\n'));
        }
        else {
            console.log(chalk_1.default.bold.red('✗ Upgrade completed with issues\n'));
        }
        console.log(chalk_1.default.bold('Summary:'));
        console.log(`  Modified Files: ${chalk_1.default.yellow(report.modifiedFiles.length)}`);
        console.log(`  Build Status: ${report.buildPassed ? chalk_1.default.green('✓ Passed') : chalk_1.default.red('✗ Failed')}`);
        console.log(`  Test Status: ${report.testsPassed ? chalk_1.default.green('✓ Passed') : chalk_1.default.red('✗ Failed')}`);
        if (report.unresolvedIssues.length > 0) {
            console.log(`  Unresolved Issues: ${chalk_1.default.red(report.unresolvedIssues.length)}`);
        }
        if (report.manualActions.length > 0) {
            console.log(chalk_1.default.bold.yellow('\n⚠ Manual Actions Required:\n'));
            report.manualActions.forEach((action, i) => {
                console.log(chalk_1.default.yellow(`  ${i + 1}. ${action}`));
            });
        }
        // Save report
        const reportPath = path.join(config.projectPath, 'upgrade-report.md');
        console.log(chalk_1.default.gray(`\n📄 Report saved to: ${reportPath}\n`));
        process.exit(report.success ? 0 : 1);
    }
    catch (error) {
        spinner.stop();
        console.error(chalk_1.default.bold.red('\n✗ Error:'), error.message);
        console.error(chalk_1.default.gray(error.stack));
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map
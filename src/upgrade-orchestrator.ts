import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UpgradeConfig, UpgradeReport, UpgradePhase, UpgradeState, BuildError } from './types';
import { EnvironmentValidator } from './validators/environment';
import { WorkspaceDetector } from './validators/workspace';
import { DependencyResolver } from './resolvers/dependency-resolver';
import { ThirdPartyFixResolver } from './resolvers/third-party-fix-resolver';
import { CodeAnalyzer } from './analyzers/code-analyzer';
import { BuildFixLoop } from './orchestrator/build-fix-loop';
import { ReportGenerator } from './reporting/report-generator';
import { LLMClient } from './llm/llm-client';
import { AgenticLLMClient } from './llm/agentic-llm-client';
import { AngularSchematicRunner } from './schematics/schematic-runner';

const execAsync = promisify(exec);

export class UpgradeOrchestrator {
  private config: UpgradeConfig;
  private state: UpgradeState;
  private reportGenerator: ReportGenerator;
  private llmClient: LLMClient;
  private agenticClient: AgenticLLMClient;
  private schematicRunner: AngularSchematicRunner;

  constructor(config: UpgradeConfig) {
    this.config = config;
    this.state = {
      phase: UpgradePhase.INIT,
      buildAttempts: 0,
      lastBuildErrors: [],
      resolvedErrors: [],
      appliedFixes: [],
      rollbackPoints: [],
    };
    this.reportGenerator = new ReportGenerator();
    this.llmClient = new LLMClient(
      config.llmApiKey,
      config.llmProvider || 'gemini',
      {
        model: config.llmModel,
        awsRegion: config.awsRegion,
        awsSecretKey: config.awsSecretKey,
        geminiApiKey: config.geminiApiKey,
      }
    );
    this.agenticClient = new AgenticLLMClient(this.llmClient, config.projectPath);
    this.schematicRunner = new AngularSchematicRunner();
  }

  async execute(): Promise<UpgradeReport> {
    const startTime = new Date();
    const modifiedFiles: string[] = [];
    let unresolvedIssues: BuildError[] = [];
    let buildPassed = false;
    let testsPassed = false;

    try {
      // Phase 1: Environment Validation
      await this.executePhase(UpgradePhase.ENVIRONMENT_VALIDATION, async () => {
        console.log('📋 Validating environment...');
        const validator = new EnvironmentValidator(this.config.projectPath);
        const validation = await validator.validate(this.config.targetAngularVersion);

        if (!validation.valid) {
          throw new Error(`Environment validation failed:\n${validation.errors.join('\n')}`);
        }

        console.log('✓ Environment validation passed');
        console.log(`  Node.js: ${validation.environment.nodeVersion}`);
        console.log(`  Package Manager: ${validation.environment.packageManager}`);
        console.log(`  Angular CLI: ${validation.environment.angularCliVersion || 'Not found'}`);

        this.reportGenerator.addEntry({
          type: 'environment',
          action: 'Environment validated',
          reason: `Node.js ${validation.environment.nodeVersion}, ${validation.environment.packageManager}`,
          automated: true,
        });

        return validation.environment;
      });

      // Phase 2: Workspace Detection
      const workspace = await this.executePhase(UpgradePhase.INIT, async () => {
        console.log('\n📁 Detecting workspace structure...');
        const detector = new WorkspaceDetector();
        const workspace = await detector.detectWorkspace(this.config.projectPath);

        console.log(`✓ Workspace detected: ${workspace.isWorkspace ? 'Multi-project' : 'Single project'}`);
        console.log(`  Projects: ${workspace.projects.length}`);

        for (const project of workspace.projects) {
          console.log(`    - ${project.name} (${project.type})`);
        }

        // Backup package.json
        const packageJsonPath = path.join(this.config.projectPath, 'package.json');
        await detector.backupFile(packageJsonPath);
        console.log('✓ Backup created');

        return workspace;
      });

      // Phase 3: Dependency Resolution
      await this.executePhase(UpgradePhase.DEPENDENCY_RESOLUTION, async () => {
        console.log('\n📦 Resolving dependencies...');
        const resolver = new DependencyResolver(this.llmClient);
        const { resolutions, conflicts } = await resolver.resolveDependencies(
          workspace.rootPackageJson,
          this.config.targetAngularVersion
        );

        console.log(`✓ Resolved ${resolutions.length} dependencies`);

        if (conflicts.length > 0) {
          console.log(`⚠ Found ${conflicts.length} potential conflicts`);
          conflicts.forEach(c => console.log(`  - ${c}`));
        }

        // Apply resolutions if not dry run
        if (!this.config.dryRun) {
          const packageJsonPath = path.join(this.config.projectPath, 'package.json');
          await resolver.applyResolutions(
            packageJsonPath,
            workspace.rootPackageJson,
            resolutions
          );

          const detector = new WorkspaceDetector();
          await detector.writePackageJson(packageJsonPath, workspace.rootPackageJson);

          // Remove stale lock files and node_modules for clean install
          console.log('\n🧹 Cleaning up stale artifacts...');
          const fs = await import('fs/promises');
          const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
          for (const lockFile of lockFiles) {
            const lockPath = path.join(this.config.projectPath, lockFile);
            try {
              await fs.unlink(lockPath);
              console.log(`  ✓ Removed ${lockFile}`);
            } catch {
              // File doesn't exist, ignore
            }
          }
          
          // Optionally remove node_modules for truly clean install
          const nodeModulesPath = path.join(this.config.projectPath, 'node_modules');
          try {
            await fs.rm(nodeModulesPath, { recursive: true, force: true });
            console.log('  ✓ Removed node_modules');
          } catch {
            // Ignore errors
          }

          // Install dependencies
          console.log('\n📥 Installing dependencies...');
          const env = await new EnvironmentValidator(this.config.projectPath).detectEnvironment();
          
          const installCmd = env.packageManager === 'pnpm' 
            ? 'pnpm install' 
            : 'npm install';
          
          console.log(`  Running: ${installCmd}`);
          
          await execAsync(installCmd, {
            cwd: this.config.projectPath,
            maxBuffer: 10 * 1024 * 1024,
          });
          
          console.log('✓ Dependencies installed');

          // Apply third-party library compatibility fixes
          console.log('\n🔧 Checking third-party library compatibility...');
          const thirdPartyResolver = new ThirdPartyFixResolver();
          const mobxFixes = await thirdPartyResolver.applyMobXFixes(this.config.projectPath);
          
          if (mobxFixes.applied) {
            for (const action of mobxFixes.actions) {
              this.reportGenerator.addEntry({
                type: 'config',
                action,
                reason: 'MobX TypeScript compatibility',
                automated: true,
              });
            }
            modifiedFiles.push('tsconfig.json', 'src/types/mobx.d.ts');
          }

          // Check for other third-party issues
          const otherIssues = await thirdPartyResolver.detectOtherThirdPartyIssues(this.config.projectPath);
          if (otherIssues.length > 0) {
            console.log('\n⚠ Third-party library recommendations:');
            otherIssues.forEach(issue => console.log(`  - ${issue}`));
          }
        }

        // Log changes
        for (const resolution of resolutions) {
          this.reportGenerator.addEntry({
            type: 'dependency',
            action: `Updated ${resolution.package}`,
            before: resolution.currentVersion,
            after: resolution.targetVersion,
            reason: resolution.reason,
            automated: true,
          });
          modifiedFiles.push('package.json');
        }
      });

      // Phase 3.5: Angular Official Migrations
      if (!this.config.dryRun) {
        await this.executePhase(UpgradePhase.CODE_ANALYSIS, async () => {
          console.log('\n🎯 Running Angular official migrations...');
          const migrationResult = await this.schematicRunner.runOfficialMigrations(
            this.config.projectPath,
            this.config.targetAngularVersion
          );

          if (migrationResult.success) {
            console.log(`✓ Official migrations completed: ${migrationResult.migrationsRun.join(', ')}`);
            
            // Parse migration info
            const migrationInfo = this.schematicRunner.extractMigrationInfo(migrationResult.output);
            
            for (const file of migrationInfo.filesModified) {
              modifiedFiles.push(file);
              this.reportGenerator.addEntry({
                type: 'code',
                action: `Modified by Angular schematic`,
                file,
                reason: 'Official Angular migration',
                automated: true,
              });
            }

            for (const migration of migrationInfo.migrationsApplied) {
              this.reportGenerator.addEntry({
                type: 'code',
                action: `Applied migration: ${migration}`,
                reason: 'Angular CLI schematic',
                automated: true,
              });
            }
          } else {
            console.log('⚠ Some official migrations had issues (continuing with custom fixes)');
          }

          // Run common third-party migrations
          const commonMigrations = await this.schematicRunner.runCommonMigrations(
            this.config.projectPath,
            this.config.targetAngularVersion
          );

          if (commonMigrations.length > 0) {
            console.log(`✓ Additional migrations: ${commonMigrations.join(', ')}`);
          }
        });
      }

      // Phase 4: Code Analysis
      await this.executePhase(UpgradePhase.CODE_ANALYSIS, async () => {
        console.log('\n🔍 Analyzing codebase...');
        const analyzer = new CodeAnalyzer();
        const analysis = await analyzer.analyzeProject(this.config.projectPath);

        console.log(`✓ Analysis complete`);
        console.log(`  Issues found: ${analysis.issues.length}`);
        console.log(`  Standalone components: ${analysis.metadata.hasStandaloneComponents}`);
        console.log(`  NgModules: ${analysis.metadata.hasNgModules}`);
        console.log(`  Uses Router: ${analysis.metadata.usesRouter}`);
        console.log(`  Uses SSR: ${analysis.metadata.usesSSR}`);

        this.reportGenerator.addEntry({
          type: 'code',
          action: 'Codebase analyzed',
          reason: `Found ${analysis.issues.length} potential issues`,
          automated: true,
        });
      });

      // Phase 5: Build-Fix Loop
      const environment = await new EnvironmentValidator(this.config.projectPath).detectEnvironment();
      
      if (!this.config.dryRun) {
        const loopResult = await this.executePhase(UpgradePhase.BUILD_FIX_LOOP, async () => {
          console.log('\n🔨 Starting build-fix loop...');
          const buildFixLoop = new BuildFixLoop({
            llmApiKey: this.config.llmApiKey,
            maxAttempts: this.config.maxBuildAttempts,
            llmProvider: this.config.llmProvider,
            llmModel: this.config.llmModel,
            awsRegion: this.config.awsRegion,
            awsSecretKey: this.config.awsSecretKey,
            geminiApiKey: this.config.geminiApiKey,
            useAgenticMode: this.config.useAgenticMode,
            useCache: this.config.useCache,
            verbose: this.config.verbose,
          });

          const result = await buildFixLoop.execute(
            this.config.projectPath,
            this.config.targetAngularVersion,
            environment
          );

          console.log(`\n✓ Build-fix loop completed in ${result.attempts} attempts`);
          console.log(`  Resolved: ${result.resolvedErrors.length} errors`);
          console.log(`  Unresolved: ${result.unresolvedErrors.length} errors`);
          
          // Show cache statistics if caching is enabled
          if (result.cacheStats) {
            console.log(`  Cache: ${result.cacheStats.hits} hits, ${result.cacheStats.misses} misses`);
          }

          // Log fixes
          for (const fix of result.appliedFixes) {
            if (fix.changes) {
              for (const change of fix.changes) {
                modifiedFiles.push(change.file);
                this.reportGenerator.addEntry({
                  type: 'code',
                  action: `Fixed ${change.file}`,
                  file: change.file,
                  reason: 'Build error resolution',
                  automated: true,
                });
              }
            }
          }

          unresolvedIssues = result.unresolvedErrors;
          return result;
        });

        // Phase 6: Verification
        await this.executePhase(UpgradePhase.VERIFICATION, async () => {
          console.log('\n✅ Verifying build and tests...');
          const buildFixLoop = new BuildFixLoop({
            llmApiKey: this.config.llmApiKey,
            maxAttempts: 1,
            llmProvider: this.config.llmProvider,
            llmModel: this.config.llmModel,
            awsRegion: this.config.awsRegion,
            awsSecretKey: this.config.awsSecretKey,
            geminiApiKey: this.config.geminiApiKey,
            useAgenticMode: false, // Disable for verification
            useCache: false, // Disable for verification
            verbose: this.config.verbose,
          });
          const verification = await buildFixLoop.verifyBuildAndTests(
            this.config.projectPath,
            environment
          );

          buildPassed = verification.buildPassed;
          testsPassed = verification.testsPassed;

          console.log(`  Build: ${buildPassed ? '✓ Passed' : '✗ Failed'}`);
          console.log(`  Tests: ${testsPassed ? '✓ Passed' : '✗ Failed'}`);
        });
      }

      this.state.phase = UpgradePhase.COMPLETE;
      const endTime = new Date();

      // Generate report
      const report = await this.reportGenerator.generateReport(
        this.config.sourceAngularVersion,
        this.config.targetAngularVersion,
        startTime,
        endTime,
        buildPassed && testsPassed,
        Array.from(new Set(modifiedFiles)),
        unresolvedIssues,
        buildPassed,
        testsPassed
      );

      // Save report
      const reportPath = path.join(this.config.projectPath, 'upgrade-report.md');
      await this.reportGenerator.saveReportToFile(report, reportPath);

      return report;
    } catch (error: any) {
      console.error('\n❌ Fatal Error during upgrade:', error.message);
      console.error('Stack:', error.stack);
      this.state.phase = UpgradePhase.FAILED;
      const endTime = new Date();

      return await this.reportGenerator.generateReport(
        this.config.sourceAngularVersion,
        this.config.targetAngularVersion,
        startTime,
        endTime,
        false,
        modifiedFiles,
        unresolvedIssues,
        false,
        false
      );
    }
  }

  private async executePhase<T>(phase: UpgradePhase, fn: () => Promise<T>): Promise<T> {
    this.state.phase = phase;
    return await fn();
  }
}

import * as semver from 'semver';
import fetch from 'node-fetch';
import { PackageJson, DependencyResolution } from '../types';
import { PRIVATE_PACKAGE_VERSIONS, PRIVATE_PACKAGE_URLS } from '../config/compatibility';
import { LLMClient } from '../llm/llm-client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRINCIPLED DEPENDENCY RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Addresses 8 categories of dependency/toolchain problems:
 * 
 * 1. FRAMEWORK RUNTIME VS TOOLING VERSION DIVERGENCE
 *    → Align ALL official tooling to framework major
 * 
 * 2. STATIC ANALYSIS / LINT STACK TARGETS DIFFERENT FRAMEWORK MAJOR
 *    → Resolve lint packages by checking their peerDeps against framework
 * 
 * 3. LANGUAGE COMPILER OUTSIDE SUPPORTED WINDOW
 *    → Read compiler constraints from framework's compiler-cli peerDeps
 * 
 * 4. PATCH-LEVEL MISALIGNMENT IN BUILD INFRASTRUCTURE
 *    → Pin exact versions for coordinated packages
 * 
 * 5. OVER-PERMISSIVE VERSION RANGES ON CRITICAL PACKAGES
 *    → Use exact versions (no ^) for framework, ~ for compiler
 * 
 * 6. RESIDUAL ARTIFACTS FROM PREVIOUS MAJOR VERSIONS
 *    → Detect and flag stale packages for removal
 * 
 * 7. ENVIRONMENT / RUNTIME TYPINGS AHEAD OF TOOLCHAIN
 *    → Resolve @types/node from framework's engines.node
 * 
 * 8. IMPOSSIBLE DEPENDENCY GRAPH
 *    → Compute constraint intersections, report true conflicts
 * 
 * NON-SOLUTIONS (explicitly avoided):
 *    - Force installs (--force)
 *    - Legacy peer-dependency flags (--legacy-peer-deps)
 *    - Partial upgrades without cleanup
 * 
 * RESOLUTION STRATEGY:
 *    1. Infer framework major from @angular/core
 *    2. Align all @angular/* packages to exact core version
 *    3. Align CLI and devkit to same major
 *    4. Constrain TypeScript to compiler-cli's supported range
 *    5. Constrain RxJS and zone.js to core's peerDeps
 *    6. Resolve lint stack by peerDep compatibility
 *    7. Detect stale artifacts (wrong major versions)
 *    8. Compute constraint intersections for third-party
 *    9. Report impossible graphs with specific conflicts
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Package categories for resolution priority
enum PackageCategory {
  FRAMEWORK_RUNTIME = 'FRAMEWORK_RUNTIME',       // @angular/core, @angular/common, etc.
  FRAMEWORK_TOOLING = 'FRAMEWORK_TOOLING',       // @angular/cli, @angular-devkit/*
  LANGUAGE_COMPILER = 'LANGUAGE_COMPILER',       // typescript
  REACTIVE_RUNTIME = 'REACTIVE_RUNTIME',         // rxjs, zone.js
  LINT_STACK = 'LINT_STACK',                     // @angular-eslint/*, eslint
  ENVIRONMENT_TYPES = 'ENVIRONMENT_TYPES',       // @types/node, @types/jasmine
  UI_LIBRARY = 'UI_LIBRARY',                     // @angular/material, @angular/cdk
  THIRD_PARTY = 'THIRD_PARTY',                   // Everything else
}

// Version range strategies
enum VersionStrategy {
  EXACT = 'EXACT',           // No prefix: "20.0.0" - for framework packages
  TILDE = 'TILDE',           // ~prefix: "~5.5.0" - for compiler (patch updates only)
  CARET = 'CARET',           // ^prefix: "^8.0.0" - for @types (doesn't affect runtime)
  RANGE = 'RANGE',           // Keep as-is for flexibility
}

export class DependencyResolver {
  private npmRegistry = 'https://registry.npmjs.org';
  private llmClient?: LLMClient;
  private packageCache: Map<string, any> = new Map();

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Fetch package metadata from npm with caching
   */
  private async fetchPackageInfo(packageName: string): Promise<any | null> {
    if (this.packageCache.has(packageName)) {
      return this.packageCache.get(packageName);
    }
    
    try {
      const response = await fetch(`${this.npmRegistry}/${packageName}`);
      if (!response.ok) return null;
      const data = await response.json();
      this.packageCache.set(packageName, data);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Fetch specific version metadata from npm
   */
  private async fetchVersionInfo(packageName: string, version: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.npmRegistry}/${packageName}/${version}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Categorize a package for resolution priority
   */
  private categorizePackage(packageName: string): PackageCategory {
    if (packageName.startsWith('@angular/') && !packageName.includes('cli') && !packageName.includes('devkit')) {
      if (['@angular/material', '@angular/cdk'].includes(packageName)) {
        return PackageCategory.UI_LIBRARY;
      }
      return PackageCategory.FRAMEWORK_RUNTIME;
    }
    if (packageName === '@angular/cli' || packageName.startsWith('@angular-devkit/') || packageName.startsWith('@schematics/')) {
      return PackageCategory.FRAMEWORK_TOOLING;
    }
    if (packageName === 'typescript') {
      return PackageCategory.LANGUAGE_COMPILER;
    }
    if (['rxjs', 'zone.js'].includes(packageName)) {
      return PackageCategory.REACTIVE_RUNTIME;
    }
    if (packageName.startsWith('@angular-eslint/') || packageName === 'eslint') {
      return PackageCategory.LINT_STACK;
    }
    if (packageName.startsWith('@types/')) {
      return PackageCategory.ENVIRONMENT_TYPES;
    }
    return PackageCategory.THIRD_PARTY;
  }

  /**
   * Get version strategy for a package category
   */
  private getVersionStrategy(category: PackageCategory): VersionStrategy {
    switch (category) {
      case PackageCategory.FRAMEWORK_RUNTIME:
      case PackageCategory.FRAMEWORK_TOOLING:
      case PackageCategory.UI_LIBRARY:
        return VersionStrategy.EXACT;  // No ^ or ~ for framework packages
      case PackageCategory.LANGUAGE_COMPILER:
      case PackageCategory.REACTIVE_RUNTIME:
        return VersionStrategy.TILDE;  // ~ for compiler/rxjs (patch updates only)
      case PackageCategory.ENVIRONMENT_TYPES:
        return VersionStrategy.CARET;  // ^ for types (doesn't affect runtime)
      default:
        return VersionStrategy.CARET;
    }
  }

  /**
   * Format version with appropriate prefix
   */
  private formatVersion(version: string, strategy: VersionStrategy): string {
    const cleanVersion = version.replace(/[\^~]/g, '');
    switch (strategy) {
      case VersionStrategy.EXACT:
        return cleanVersion;
      case VersionStrategy.TILDE:
        return `~${cleanVersion}`;
      case VersionStrategy.CARET:
        return `^${cleanVersion}`;
      default:
        return cleanVersion;
    }
  }

  async resolveDependencies(
    packageJson: PackageJson,
    targetAngularVersion: string
  ): Promise<{
    resolutions: DependencyResolution[];
    conflicts: string[];
    stalePackages: string[];  // Packages from wrong major that should be removed
  }> {
    const resolutions: DependencyResolution[] = [];
    const conflicts: string[] = [];
    const stalePackages: string[] = [];

    const majorVersion = parseInt(targetAngularVersion.split('.')[0]);
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         PRINCIPLED DEPENDENCY RESOLUTION                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: ANCHOR RESOLUTION - Framework Runtime
    // Problem addressed: #1 (Runtime vs Tooling divergence)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 1: Framework Runtime Anchor ─────────────────────────────');
    
    const coreVersion = await this.resolveLatestStableMajorVersion('@angular/core', majorVersion);
    if (!coreVersion) {
      throw new Error(`FATAL: Cannot resolve @angular/core@${majorVersion}.x - framework major not found`);
    }
    console.log(`│  ✓ Anchor: @angular/core@${coreVersion}`);

    // Get core's peer dependencies - this defines the entire ecosystem
    const coreInfo = await this.fetchVersionInfo('@angular/core', coreVersion);
    const corePeerDeps = coreInfo?.peerDependencies || {};
    console.log(`│  Core peerDeps: rxjs@${corePeerDeps.rxjs || 'any'}, zone.js@${corePeerDeps['zone.js'] || 'any'}`);
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: FRAMEWORK TOOLING ALIGNMENT
    // Problem addressed: #1 (Runtime vs Tooling divergence), #4 (Patch misalignment)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 2: Framework Tooling Alignment ──────────────────────────');
    
    // CLI MUST match core major
    if (allDeps['@angular/cli']) {
      const cliVersion = await this.resolveLatestStableMajorVersion('@angular/cli', majorVersion);
      if (cliVersion) {
        const strategy = this.getVersionStrategy(PackageCategory.FRAMEWORK_TOOLING);
        resolutions.push({
          package: '@angular/cli',
          currentVersion: allDeps['@angular/cli'],
          targetVersion: this.formatVersion(cliVersion, strategy),
          reason: `[TOOLING ALIGNMENT] CLI must match framework major ${majorVersion}`,
        });
        console.log(`│  ✓ @angular/cli@${cliVersion} (aligned to framework)`);
      } else {
        conflicts.push(`[PROBLEM #1] No @angular/cli@${majorVersion}.x found - TOOLING DIVERGENCE`);
      }
    }

    // Resolve all @angular/* and @angular-devkit/* packages
    const angularPackages = this.getAngularPackages(packageJson);
    console.log(`│  Resolving ${angularPackages.length} framework packages...`);
    
    for (const pkg of angularPackages) {
      if (pkg === '@angular/cli') continue;
      
      const category = this.categorizePackage(pkg);
      const strategy = this.getVersionStrategy(category);
      
      // Try exact core version first for runtime packages
      const exactExists = await this.versionExists(pkg, coreVersion);
      const targetVer = exactExists 
        ? coreVersion 
        : await this.resolveLatestStableMajorVersion(pkg, majorVersion);
      
      if (targetVer) {
        resolutions.push({
          package: pkg,
          currentVersion: allDeps[pkg] || 'unknown',
          targetVersion: this.formatVersion(targetVer, strategy),
          reason: exactExists 
            ? `[EXACT MATCH] Pinned to @angular/core@${coreVersion}` 
            : `[LATEST MAJOR] Latest ${majorVersion}.x`,
        });
      } else {
        conflicts.push(`[PROBLEM #1] Cannot resolve ${pkg}@${majorVersion}.x`);
      }
    }
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: LANGUAGE COMPILER CONSTRAINT
    // Problem addressed: #3 (Compiler outside supported window)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 3: Language Compiler Constraint ─────────────────────────');
    
    const compilerCliVersion = await this.resolveLatestStableMajorVersion('@angular/compiler-cli', majorVersion);
    if (compilerCliVersion) {
      const compilerCliInfo = await this.fetchVersionInfo('@angular/compiler-cli', compilerCliVersion);
      const tsConstraint = compilerCliInfo?.peerDependencies?.typescript;
      
      if (tsConstraint) {
        console.log(`│  Compiler-CLI requires TypeScript: ${tsConstraint}`);
        const tsVersion = await this.resolveLatestVersionSatisfying('typescript', tsConstraint);
        
        if (tsVersion) {
          const strategy = this.getVersionStrategy(PackageCategory.LANGUAGE_COMPILER);
          resolutions.push({
            package: 'typescript',
            currentVersion: allDeps['typescript'] || 'unknown',
            targetVersion: this.formatVersion(tsVersion, strategy),
            reason: `[COMPILER CONSTRAINT] Must satisfy: ${tsConstraint}`,
          });
          console.log(`│  ✓ typescript@${tsVersion} (within supported window)`);
          
          // Check if current version is OUTSIDE the window
          const currentTs = allDeps['typescript']?.replace(/[\^~]/g, '');
          if (currentTs && !semver.satisfies(currentTs, tsConstraint)) {
            console.log(`│  ⚠ PROBLEM #3 DETECTED: Current typescript@${currentTs} is OUTSIDE supported window!`);
          }
        } else {
          conflicts.push(`[PROBLEM #3] No TypeScript satisfies compiler constraint: ${tsConstraint}`);
        }
      }
    }
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: REACTIVE RUNTIME (RxJS, zone.js)
    // Problem addressed: #5 (Over-permissive ranges)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 4: Reactive Runtime ─────────────────────────────────────');
    const rxjsConstraint = corePeerDeps['rxjs'];
    if (rxjsConstraint && allDeps['rxjs']) {
      console.log(`│  Core requires RxJS: ${rxjsConstraint}`);
      const rxjsVersion = await this.resolveLatestVersionSatisfying('rxjs', rxjsConstraint);
      if (rxjsVersion) {
        const strategy = this.getVersionStrategy(PackageCategory.REACTIVE_RUNTIME);
        resolutions.push({
          package: 'rxjs',
          currentVersion: allDeps['rxjs'],
          targetVersion: this.formatVersion(rxjsVersion, strategy),
          reason: `[CONSTRAINED] Core peerDep: ${rxjsConstraint}`,
        });
        console.log(`│  ✓ rxjs@${rxjsVersion}`);
        
        // Check for over-permissive range
        if (allDeps['rxjs'].startsWith('^')) {
          console.log(`│  ⚠ PROBLEM #5: Current rxjs uses caret (^) - constraining to tilde (~)`);
        }
      }
    }

    const zoneConstraint = corePeerDeps['zone.js'];
    if (zoneConstraint && allDeps['zone.js']) {
      console.log(`│  Core requires zone.js: ${zoneConstraint}`);
      const zoneVersion = await this.resolveLatestVersionSatisfying('zone.js', zoneConstraint);
      if (zoneVersion) {
        const strategy = this.getVersionStrategy(PackageCategory.REACTIVE_RUNTIME);
        resolutions.push({
          package: 'zone.js',
          currentVersion: allDeps['zone.js'],
          targetVersion: this.formatVersion(zoneVersion, strategy),
          reason: `[CONSTRAINED] Core peerDep: ${zoneConstraint}`,
        });
        console.log(`│  ✓ zone.js@${zoneVersion}`);
      }
    }
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: LINT STACK ALIGNMENT
    // Problem addressed: #2 (Lint stack targets different framework major)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 5: Lint Stack Alignment ─────────────────────────────────');
    await this.resolveAngularEslint(packageJson, majorVersion, coreVersion, resolutions, conflicts);
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6: ENVIRONMENT TYPINGS
    // Problem addressed: #7 (Environment typings ahead of toolchain)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 6: Environment Typings ──────────────────────────────────');
    if (allDeps['@types/node']) {
      await this.resolveNodeTypes(packageJson, majorVersion, resolutions, conflicts);
    }
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 7: UI LIBRARY ALIGNMENT
    // Problem addressed: #1 (Tooling divergence)
    // ═══════════════════════════════════════════════════════════════════════
    if (allDeps['@angular/material']) {
      console.log('┌─ PHASE 7: UI Library Alignment ───────────────────────────────');
      await this.resolveAngularMaterial(packageJson, majorVersion, coreVersion, resolutions, conflicts);
      console.log('└──────────────────────────────────────────────────────────────────\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 8: STALE ARTIFACT DETECTION
    // Problem addressed: #6 (Residual artifacts from previous major)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 8: Stale Artifact Detection ─────────────────────────────');
    const detectedStale = await this.detectStaleArtifacts(packageJson, majorVersion);
    stalePackages.push(...detectedStale);
    if (detectedStale.length > 0) {
      console.log(`│  ⚠ PROBLEM #6 DETECTED: ${detectedStale.length} stale packages from wrong major:`);
      detectedStale.forEach(pkg => console.log(`│    - ${pkg}`));
    } else {
      console.log('│  ✓ No stale artifacts detected');
    }
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 9: THIRD-PARTY RESOLUTION
    // Problem addressed: #8 (Impossible dependency graph)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 9: Third-Party Resolution ───────────────────────────────');
    const thirdPartyResolutions = await this.resolveThirdPartyAngularLibraries(
      packageJson,
      targetAngularVersion
    );
    resolutions.push(...thirdPartyResolutions.resolutions);
    conflicts.push(...thirdPartyResolutions.conflicts);
    console.log('└──────────────────────────────────────────────────────────────────\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 10: CONSTRAINT INTERSECTION VALIDATION
    // Problem addressed: #8 (Impossible dependency graph)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('┌─ PHASE 10: Constraint Intersection Validation ──────────────────');
    const { resolved, unresolvedConflicts } = await this.iterativeConstraintResolution(
      resolutions,
      packageJson,
      targetAngularVersion
    );
    console.log('└──────────────────────────────────────────────────────────────────\n');

    conflicts.push(...unresolvedConflicts);

    // Final summary
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    RESOLUTION SUMMARY                         ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  ✓ Resolved packages: ${resolved.length.toString().padEnd(38)}║`);
    console.log(`║  ⚠ Conflicts: ${conflicts.length.toString().padEnd(46)}║`);
    console.log(`║  🗑 Stale artifacts: ${stalePackages.length.toString().padEnd(40)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    return { resolutions: resolved, conflicts, stalePackages };
  }

  /**
   * PHASE 8 HELPER: Detect stale artifacts from previous major versions
   * Problem addressed: #6 (Residual artifacts from previous major versions)
   */
  private async detectStaleArtifacts(
    packageJson: PackageJson,
    targetMajor: number
  ): Promise<string[]> {
    const stale: string[] = [];
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for Angular packages on wrong major
    const angularPackagePattern = /^@angular(-devkit)?\/|^@schematics\//;
    
    for (const [pkg, version] of Object.entries(allDeps)) {
      if (!angularPackagePattern.test(pkg)) continue;
      
      const cleanVersion = version.replace(/[\^~]/g, '');
      const parsed = semver.parse(cleanVersion);
      
      if (parsed && parsed.major !== targetMajor) {
        stale.push(`${pkg}@${version} (major ${parsed.major}, expected ${targetMajor})`);
      }
    }

    // Check for eslint packages on wrong major
    const eslintPackages = Object.keys(allDeps).filter(p => p.startsWith('@angular-eslint/'));
    for (const pkg of eslintPackages) {
      const version = allDeps[pkg];
      const cleanVersion = version.replace(/[\^~]/g, '');
      const parsed = semver.parse(cleanVersion);
      
      if (parsed && parsed.major !== targetMajor) {
        stale.push(`${pkg}@${version} (major ${parsed.major}, expected ${targetMajor})`);
      }
    }

    return stale;
  }

  /**
   * Resolve @angular-eslint packages dynamically
   * Problem addressed: #2 (Lint stack targets different framework major)
   * 
   * NOTE: @angular-eslint follows Angular's major version directly.
   * - @angular-eslint@20.x is for Angular 20.x
   * - @angular-eslint@19.x is for Angular 19.x
   * The packages use dependencies (not peerDependencies) for @angular-devkit constraints.
   * 
   * CRITICAL: All @angular-eslint packages MUST be the same version to avoid conflicts.
   */
  private async resolveAngularEslint(
    packageJson: PackageJson,
    majorVersion: number,
    coreVersion: string,
    resolutions: DependencyResolution[],
    conflicts: string[]
  ): Promise<void> {
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Find ALL @angular-eslint packages in the project (not just a predefined list)
    const presentPackages = Object.keys(allDeps).filter(pkg => pkg.startsWith('@angular-eslint/'));

    if (presentPackages.length === 0) return;

    console.log(`  Resolving ${presentPackages.length} @angular-eslint packages for Angular ${majorVersion}...`);

    // @angular-eslint follows Angular's major version directly
    // So for Angular 20, we use @angular-eslint@20.x
    // Use @angular-eslint/schematics as the reference package
    const eslintVersion = await this.resolveLatestStableMajorVersion(
      '@angular-eslint/schematics',
      majorVersion
    );

    if (!eslintVersion) {
      // No version found for this major - report conflict
      conflicts.push(`No @angular-eslint version found for Angular ${majorVersion}. The package may not yet support this Angular version.`);
      console.log(`    ⚠ No @angular-eslint@${majorVersion}.x found`);
      return;
    }

    console.log(`    ✓ Target version: @angular-eslint/*@${eslintVersion}`);
    
    // CRITICAL: ALL @angular-eslint packages must use the SAME version
    // Do NOT use fallback versions - this causes the conflicts
    for (const pkg of presentPackages) {
      const exists = await this.versionExists(pkg, eslintVersion);
      if (exists) {
        resolutions.push({
          package: pkg,
          currentVersion: allDeps[pkg] || 'unknown',
          targetVersion: eslintVersion,
          reason: `Aligned to @angular-eslint@${eslintVersion} (Angular ${majorVersion}.x)`,
        });
      } else {
        // Version doesn't exist for this package - this is a problem
        // But we still set it to the target version and let npm handle it
        // Better than having mismatched versions
        console.log(`    ⚠ ${pkg}@${eslintVersion} not found, but setting anyway for consistency`);
        resolutions.push({
          package: pkg,
          currentVersion: allDeps[pkg] || 'unknown',
          targetVersion: eslintVersion,
          reason: `Aligned to @angular-eslint@${eslintVersion} (may need manual verification)`,
        });
      }
    }
    
    // Ensure template-parser is included if eslint-plugin-template is present
    // (template-parser is a peer dependency of eslint-plugin-template)
    if (presentPackages.includes('@angular-eslint/eslint-plugin-template') && 
        !presentPackages.includes('@angular-eslint/template-parser')) {
      const exists = await this.versionExists('@angular-eslint/template-parser', eslintVersion);
      if (exists) {
        console.log(`    + Adding @angular-eslint/template-parser@${eslintVersion} (required by eslint-plugin-template)`);
        resolutions.push({
          package: '@angular-eslint/template-parser',
          currentVersion: 'not installed',
          targetVersion: eslintVersion,
          reason: `Required peer dependency of @angular-eslint/eslint-plugin-template`,
        });
      }
    }
  }

  /**
   * Resolve @types/node based on Angular CLI's engines.node requirement
   */
  private async resolveNodeTypes(
    packageJson: PackageJson,
    majorVersion: number,
    resolutions: DependencyResolution[],
    conflicts: string[]
  ): Promise<void> {
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Get @angular/cli's engines.node to determine Node.js version
    const cliVersion = await this.resolveLatestStableMajorVersion('@angular/cli', majorVersion);
    if (!cliVersion) return;

    const cliInfo = await this.fetchVersionInfo('@angular/cli', cliVersion);
    const nodeConstraint = cliInfo?.engines?.node;

    if (nodeConstraint) {
      console.log(`  Resolving @types/node (CLI requires Node: ${nodeConstraint})...`);
      
      // Parse the minimum Node version from constraint (e.g., "^18.19.1 || ^20.11.1 || >=22.0.0")
      const nodeTypeMajor = this.extractMinNodeMajor(nodeConstraint);
      
      if (nodeTypeMajor) {
        const nodeTypesVersion = await this.resolveLatestStableMajorVersion('@types/node', nodeTypeMajor);
        if (nodeTypesVersion) {
          console.log(`    ✓ @types/node@${nodeTypesVersion}`);
          resolutions.push({
            package: '@types/node',
            currentVersion: allDeps['@types/node'] || 'unknown',
            targetVersion: `^${nodeTypesVersion}`,
            reason: `Matches CLI's Node.js requirement: ${nodeConstraint}`,
          });
        }
      }
    }
  }

  /**
   * Extract minimum Node.js major version from engines constraint
   */
  private extractMinNodeMajor(constraint: string): number | null {
    // Parse constraints like "^18.19.1 || ^20.11.1 || >=22.0.0"
    const matches = constraint.match(/\d+/g);
    if (matches && matches.length > 0) {
      // Return the smallest major version mentioned
      const majors = matches.filter((_, i) => i % 3 === 0).map(Number);
      return Math.min(...majors);
    }
    return null;
  }

  /**
   * Resolve Angular Material and CDK
   */
  private async resolveAngularMaterial(
    packageJson: PackageJson,
    majorVersion: number,
    coreVersion: string,
    resolutions: DependencyResolution[],
    conflicts: string[]
  ): Promise<void> {
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    console.log('  Resolving @angular/material...');
    
    // Find Material version compatible with this Angular version
    const materialVersion = await this.findCompatibleVersionByPeerDep(
      '@angular/material',
      '@angular/core',
      coreVersion
    );

    if (materialVersion) {
      console.log(`    ✓ @angular/material@${materialVersion}`);
      resolutions.push({
        package: '@angular/material',
        currentVersion: allDeps['@angular/material'],
        targetVersion: materialVersion,
        reason: `Compatible with @angular/core@${coreVersion}`,
      });

      // CDK should match Material
      if (allDeps['@angular/cdk']) {
        const cdkExists = await this.versionExists('@angular/cdk', materialVersion);
        const cdkVersion = cdkExists 
          ? materialVersion 
          : await this.resolveLatestStableMajorVersion('@angular/cdk', majorVersion);
        
        if (cdkVersion) {
          console.log(`    ✓ @angular/cdk@${cdkVersion}`);
          resolutions.push({
            package: '@angular/cdk',
            currentVersion: allDeps['@angular/cdk'],
            targetVersion: cdkVersion,
            reason: `Matches @angular/material@${materialVersion}`,
          });
        }
      }
    } else {
      conflicts.push(`No @angular/material found compatible with Angular ${majorVersion}`);
    }
  }

  /**
   * Find the latest version of a package whose peerDependency satisfies a target version
   * 
   * Example: Find @angular-eslint/schematics version where peerDeps['@angular/cli'] includes "20.x"
   */
  private async findCompatibleVersionByPeerDep(
    packageName: string,
    peerDepName: string,
    targetVersion: string
  ): Promise<string | null> {
    const pkgInfo = await this.fetchPackageInfo(packageName);
    if (!pkgInfo) return null;

    const versions = Object.keys(pkgInfo.versions)
      .filter(v => {
        const parsed = semver.parse(v);
        return parsed && parsed.prerelease.length === 0; // Skip prereleases
      })
      .sort((a, b) => semver.rcompare(a, b)); // Latest first

    for (const version of versions) {
      const versionData = pkgInfo.versions[version];
      const peerDeps = versionData.peerDependencies || {};
      const constraint = peerDeps[peerDepName];

      if (constraint) {
        try {
          if (semver.satisfies(targetVersion, constraint)) {
            return version;
          }
        } catch {
          // Invalid semver constraint, skip
        }
      }
    }

    return null;
  }

  /**
   * Find the latest version that satisfies a semver constraint
   */
  private async resolveLatestVersionSatisfying(
    packageName: string,
    constraint: string
  ): Promise<string | null> {
    const pkgInfo = await this.fetchPackageInfo(packageName);
    if (!pkgInfo) return null;

    const versions = Object.keys(pkgInfo.versions)
      .filter(v => {
        const parsed = semver.parse(v);
        return parsed && parsed.prerelease.length === 0;
      })
      .sort((a, b) => semver.rcompare(a, b)); // Latest first

    for (const version of versions) {
      try {
        if (semver.satisfies(version, constraint)) {
          return version;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Resolve latest stable version for a major version
   */
  private async resolveLatestStableMajorVersion(
    packageName: string,
    majorVersion: number
  ): Promise<string | null> {
    const pkgInfo = await this.fetchPackageInfo(packageName);
    if (!pkgInfo) return null;

    const versions = Object.keys(pkgInfo.versions)
      .filter(v => {
        const parsed = semver.parse(v);
        if (!parsed) return false;
        if (parsed.prerelease.length > 0) return false; // Skip prereleases
        return parsed.major === majorVersion;
      })
      .sort((a, b) => semver.compare(a, b));

    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  private getAngularPackages(packageJson: PackageJson): string[] {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return Object.keys(allDeps).filter(pkg => 
      pkg.startsWith('@angular/') || pkg.startsWith('@angular-devkit/') || pkg.startsWith('@schematics/')
    );
  }

  private async resolveTypescript(compatibleVersions: string[]): Promise<string> {
    // Get the latest compatible TypeScript version
    const latestMinor = compatibleVersions[compatibleVersions.length - 1];
    const latestPatch = await this.getLatestPatchVersion('typescript', latestMinor);
    return latestPatch;
  }

  private async getLatestPatchVersion(packageName: string, minorVersion: string): Promise<string> {
    try {
      const response = await fetch(`${this.npmRegistry}/${packageName}`);
      const data = await response.json();
      const versions = Object.keys(data.versions);
      
      const matching = versions.filter(v => 
        v.startsWith(`${minorVersion}.`)
      );

      if (matching.length === 0) {
        return `${minorVersion}.0`;
      }

      matching.sort((a, b) => semver.compare(a, b));
      return matching[matching.length - 1];
    } catch (error) {
      return `${minorVersion}.0`;
    }
  }

  /**
   * Iterative cross-dependency resolution with constraint intersection
   * 
   * IMPROVED ALGORITHM:
   * 1. Collect ALL peer dependency constraints for each package
   * 2. Compute the INTERSECTION of constraints (what version satisfies ALL requirements)
   * 3. If no intersection exists, report conflict with details
   * 4. Use backtracking only when absolutely necessary
   */
  private async iterativeConstraintResolution(
    initialResolutions: DependencyResolution[],
    packageJson: PackageJson,
    targetAngularVersion: string
  ): Promise<{ resolved: DependencyResolution[]; unresolvedConflicts: string[] }> {
    const unresolvedConflicts: string[] = [];
    const resolved = [...initialResolutions];
    
    console.log('\n  Phase 1: Collecting all peer dependency constraints...');
    
    // Build a map of package -> all constraints from other packages
    const constraintMap = new Map<string, Array<{ from: string; constraint: string }>>();
    
    for (const resolution of resolved) {
      try {
        const version = resolution.targetVersion.replace(/[\^~]/g, '');
        const versionData = await this.fetchVersionInfo(resolution.package, version);
        
        if (!versionData?.peerDependencies) continue;
        
        for (const [peerPkg, constraint] of Object.entries(versionData.peerDependencies)) {
          if (!constraintMap.has(peerPkg)) {
            constraintMap.set(peerPkg, []);
          }
          constraintMap.get(peerPkg)!.push({
            from: `${resolution.package}@${version}`,
            constraint: constraint as string,
          });
        }
      } catch {
        // Ignore errors
      }
    }

    console.log('  Phase 2: Computing constraint intersections...');
    
    // For each package that has multiple constraints, find version satisfying ALL
    for (const [pkg, constraints] of constraintMap.entries()) {
      if (constraints.length <= 1) continue;
      
      console.log(`    ${pkg} required by ${constraints.length} packages:`);
      constraints.forEach(c => console.log(`      - ${c.from}: ${c.constraint}`));
      
      // Find the resolution for this package
      const resolutionIdx = resolved.findIndex(r => r.package === pkg);
      if (resolutionIdx === -1) {
        // Package not in resolutions - might need to add it
        const intersectionVersion = await this.findVersionSatisfyingAll(pkg, constraints);
        if (intersectionVersion) {
          console.log(`      ✓ Adding ${pkg}@${intersectionVersion} (satisfies all)`);
          resolved.push({
            package: pkg,
            currentVersion: packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg] || 'unknown',
            targetVersion: intersectionVersion,
            reason: `Required by: ${constraints.map(c => c.from).join(', ')}`,
          });
        }
        continue;
      }
      
      const currentVersion = resolved[resolutionIdx].targetVersion.replace(/[\^~]/g, '');
      
      // Check if current version satisfies ALL constraints
      const allSatisfied = constraints.every(c => {
        try {
          return semver.satisfies(currentVersion, c.constraint);
        } catch {
          return false;
        }
      });
      
      if (allSatisfied) {
        console.log(`      ✓ ${pkg}@${currentVersion} satisfies all constraints`);
        continue;
      }
      
      // Current version doesn't satisfy all - find one that does
      console.log(`      ✗ ${pkg}@${currentVersion} does NOT satisfy all constraints`);
      
      const intersectionVersion = await this.findVersionSatisfyingAll(pkg, constraints);
      
      if (intersectionVersion) {
        console.log(`      → Updating to ${pkg}@${intersectionVersion}`);
        resolved[resolutionIdx] = {
          ...resolved[resolutionIdx],
          targetVersion: intersectionVersion,
          reason: `Satisfies constraints from: ${constraints.map(c => c.from).join(', ')}`,
        };
      } else {
        // No version satisfies all constraints - this is a true conflict
        const conflictDetail = constraints.map(c => `${c.from} requires ${c.constraint}`).join('; ');
        unresolvedConflicts.push(
          `❌ INCOMPATIBLE: ${pkg} has conflicting requirements: ${conflictDetail}`
        );
        console.log(`      ❌ NO VERSION of ${pkg} satisfies all constraints!`);
      }
    }

    // Phase 3: Verify final resolution has no conflicts
    console.log('\n  Phase 3: Final verification...');
    const remainingConflicts = await this.findAllPeerConflicts(resolved);
    
    if (remainingConflicts.length === 0) {
      console.log('    ✓ All peer dependencies satisfied');
    } else {
      console.log(`    ⚠️ ${remainingConflicts.length} unresolved conflicts remain`);
      for (const conflict of remainingConflicts) {
        unresolvedConflicts.push(
          `${conflict.package}@${conflict.currentVersion} requires ${conflict.peerPackage}@${conflict.peerConstraint}, ` +
          `but ${conflict.actualVersion} is resolved`
        );
      }
    }

    return { resolved, unresolvedConflicts };
  }

  /**
   * Find a version that satisfies ALL given constraints
   * Returns null if no such version exists (incompatible constraints)
   */
  private async findVersionSatisfyingAll(
    packageName: string,
    constraints: Array<{ from: string; constraint: string }>
  ): Promise<string | null> {
    const pkgInfo = await this.fetchPackageInfo(packageName);
    if (!pkgInfo) return null;

    const versions = Object.keys(pkgInfo.versions)
      .filter(v => {
        const parsed = semver.parse(v);
        return parsed && parsed.prerelease.length === 0;
      })
      .sort((a, b) => semver.rcompare(a, b)); // Latest first

    for (const version of versions) {
      const satisfiesAll = constraints.every(c => {
        try {
          return semver.satisfies(version, c.constraint);
        } catch {
          return false;
        }
      });

      if (satisfiesAll) {
        return version;
      }
    }

    return null;
  }

  /**
   * Find all peer dependency conflicts across resolved packages
   */
  private async findAllPeerConflicts(
    resolutions: DependencyResolution[]
  ): Promise<Array<{
    package: string;
    currentVersion: string;
    peerPackage: string;
    peerConstraint: string;
    actualVersion: string;
  }>> {
    const conflicts: Array<{
      package: string;
      currentVersion: string;
      peerPackage: string;
      peerConstraint: string;
      actualVersion: string;
    }> = [];

    for (const resolution of resolutions) {
      try {
        const version = resolution.targetVersion.replace(/[\^~]/g, '');
        const response = await fetch(`${this.npmRegistry}/${resolution.package}/${version}`);
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const peerDeps = data.peerDependencies || {};

        for (const [peerPackage, constraint] of Object.entries(peerDeps)) {
          const peerResolution = resolutions.find(r => r.package === peerPackage);
          
          if (peerResolution) {
            const peerVersion = peerResolution.targetVersion.replace(/[\^~]/g, '');
            
            try {
              if (!semver.satisfies(peerVersion, constraint as string)) {
                conflicts.push({
                  package: resolution.package,
                  currentVersion: version,
                  peerPackage,
                  peerConstraint: constraint as string,
                  actualVersion: peerVersion,
                });
              }
            } catch {
              // Ignore malformed semver constraints
            }
          }
        }
      } catch (error) {
        // Ignore fetch errors
      }
    }

    return conflicts;
  }

  /**
   * Attempt to resolve a single peer dependency conflict
   */
  private async resolveConflict(
    conflict: {
      package: string;
      currentVersion: string;
      peerPackage: string;
      peerConstraint: string;
      actualVersion: string;
    },
    resolutions: DependencyResolution[],
    packageJson: PackageJson,
    targetAngularVersion: string
  ): Promise<boolean> {
    // Find the resolution for the peer package that's causing the conflict
    const peerResolutionIndex = resolutions.findIndex(r => r.package === conflict.peerPackage);
    
    if (peerResolutionIndex === -1) return false;

    // Try to find a version of the peer package that satisfies the constraint
    try {
      const response = await fetch(`${this.npmRegistry}/${conflict.peerPackage}`);
      if (!response.ok) return false;
      
      const data = await response.json();
      const versions = Object.keys(data.versions)
        .filter(v => {
          const parsed = semver.parse(v);
          return parsed && parsed.prerelease.length === 0;
        })
        .sort((a, b) => semver.rcompare(a, b));

      // Find highest version that satisfies the constraint
      for (const version of versions) {
        try {
          if (semver.satisfies(version, conflict.peerConstraint)) {
            // Check if this version is still compatible with Angular (if it's an Angular package)
            const versionData = data.versions[version];
            const angularPeerDeps = versionData.peerDependencies || {};
            
            let isAngularCompatible = true;
            if (angularPeerDeps['@angular/core']) {
              isAngularCompatible = semver.satisfies(
                targetAngularVersion,
                angularPeerDeps['@angular/core']
              );
            }

            if (isAngularCompatible) {
              // Check if this version won't break other existing resolutions
              const wouldBreakOthers = await this.wouldBreakOtherResolutions(
                conflict.peerPackage,
                version,
                resolutions,
                peerResolutionIndex
              );

              if (!wouldBreakOthers) {
                // Update the resolution
                resolutions[peerResolutionIndex] = {
                  ...resolutions[peerResolutionIndex],
                  targetVersion: `^${version}`,
                  reason: `Adjusted to satisfy peer dependency constraint ${conflict.peerConstraint} from ${conflict.package}`,
                };
                return true;
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  /**
   * Check if changing a package version would break other resolutions
   */
  private async wouldBreakOtherResolutions(
    packageName: string,
    newVersion: string,
    resolutions: DependencyResolution[],
    skipIndex: number
  ): Promise<boolean> {
    for (let i = 0; i < resolutions.length; i++) {
      if (i === skipIndex) continue;

      const resolution = resolutions[i];
      try {
        const version = resolution.targetVersion.replace(/[\^~]/g, '');
        const response = await fetch(`${this.npmRegistry}/${resolution.package}/${version}`);
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const peerDeps = data.peerDependencies || {};

        if (peerDeps[packageName]) {
          if (!semver.satisfies(newVersion, peerDeps[packageName])) {
            return true; // Would break this resolution
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private async resolveThirdPartyAngularLibraries(
    packageJson: PackageJson,
    targetAngularVersion: string
  ): Promise<{ resolutions: DependencyResolution[]; conflicts: string[] }> {
    const resolutions: DependencyResolution[] = [];
    const conflicts: string[] = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Get all non-Angular packages
    const thirdPartyPackages = Object.keys(allDeps).filter(
      pkg => !pkg.startsWith('@angular/') && 
             !pkg.startsWith('@angular-devkit/') && 
             !pkg.startsWith('@schematics/') &&
             pkg !== 'typescript' &&
             pkg !== 'rxjs' &&
             pkg !== 'zone.js'
    );

    const targetMajor = parseInt(targetAngularVersion.split('.')[0]);

    for (const pkg of thirdPartyPackages) {
      try {
        // Check if package has a URL override (for private packages)
        if (PRIVATE_PACKAGE_URLS[pkg]) {
          const url = PRIVATE_PACKAGE_URLS[pkg];
          resolutions.push({
            package: pkg,
            currentVersion: allDeps[pkg],
            targetVersion: url,
            reason: `Private package installed from custom URL`,
          });
          console.log(`  ✓ Using custom URL: ${pkg}@${url}`);
          continue;
        }

        // Check if package has a hardcoded version override
        if (PRIVATE_PACKAGE_VERSIONS[pkg]) {
          const privateVersionMap = PRIVATE_PACKAGE_VERSIONS[pkg];
          const majorVersion = privateVersionMap[targetMajor.toString()];
          
          if (majorVersion) {
            // Fetch latest version matching the major version
            const resolvedVersion = await this.resolveLatestStableMajorVersion(pkg, parseInt(majorVersion));
            
            if (resolvedVersion) {
              resolutions.push({
                package: pkg,
                currentVersion: allDeps[pkg],
                targetVersion: `^${resolvedVersion}`,
                reason: `Resolved from major version ${majorVersion} for Angular ${targetAngularVersion}`,
              });
              console.log(`  ✓ Using resolved version: ${pkg}@${resolvedVersion}`);
              continue;
            } else {
              // Version doesn't exist - skip this package and let peer dependency resolution handle it
              console.log(`  ⚠ Major version ${majorVersion} not found for ${pkg}, trying peer dependency resolution...`);
              // Fall through to peer dependency resolution
            }
          }
        }

        // Peer-dependency-driven resolution
        const compatibleVersion = await this.resolvePeerDependencyCompatibleVersion(
          pkg,
          targetAngularVersion,
          process.version.replace('v', '')
        );

        if (compatibleVersion) {
          resolutions.push({
            package: pkg,
            currentVersion: allDeps[pkg],
            targetVersion: `^${compatibleVersion}`,
            reason: `Peer-dependency compatible with Angular ${targetAngularVersion}`,
          });
          console.log(`  ✓ Found peer-compatible version: ${pkg}@${compatibleVersion}`);
          continue;
        }

        // If peer-dependency resolution fails, try AI-assisted resolution
        if (this.llmClient) {
          const response = await fetch(`${this.npmRegistry}/${pkg}`);
          if (response.ok) {
            const data = await response.json();
            const aiVersion = await this.aiAssistedVersionResolution(
              pkg,
              allDeps[pkg].replace(/[\^~]/g, ''),
              targetAngularVersion,
              data
            );
            
            if (aiVersion) {
              resolutions.push({
                package: pkg,
                currentVersion: allDeps[pkg],
                targetVersion: `^${aiVersion}`,
                reason: `AI-suggested version compatible with Angular ${targetAngularVersion}`,
              });
              console.log(`  ✓ AI suggested compatible version: ${pkg}@${aiVersion}`);
              continue;
            }
          }
        }

        // If all resolution methods fail, add to conflicts
        conflicts.push(
          `❌ ${pkg} has no compatible version found for Angular ${targetAngularVersion}`
        );

      } catch (error) {
        // Ignore fetch errors for private or unavailable packages
      }
    }

    return { resolutions, conflicts };
  }

  /**
   * Peer-dependency-driven resolution
   * Finds the highest version that satisfies Angular peer dependencies and Node constraints
   */
  private async resolvePeerDependencyCompatibleVersion(
    packageName: string,
    targetAngularVersion: string,
    nodeVersion: string
  ): Promise<string | null> {
    // Skip npm registry lookup for packages in PRIVATE_PACKAGE_VERSIONS
    // These packages will use hardcoded versions and should not query npm
    if (PRIVATE_PACKAGE_VERSIONS[packageName]) {
      return null;
    }

    try {
      const response = await fetch(`${this.npmRegistry}/${packageName}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const versions = Object.keys(data.versions).filter(v => {
        // Filter out pre-release versions
        const parsed = semver.parse(v);
        return parsed && parsed.prerelease.length === 0;
      });

      // Sort versions in descending order (highest first)
      versions.sort((a, b) => semver.rcompare(a, b));

      // Iterate through versions to find the highest compatible one
      for (const version of versions) {
        const versionData = data.versions[version];
        
        // Check peer dependencies for Angular compatibility
        const peerDeps = versionData.peerDependencies || {};
        const angularCorePeer = peerDeps['@angular/core'];
        const angularCommonPeer = peerDeps['@angular/common'];
        
        let isAngularCompatible = true;
        
        // If package has Angular peer dependencies, check compatibility
        if (angularCorePeer || angularCommonPeer) {
          if (angularCorePeer && !semver.satisfies(targetAngularVersion, angularCorePeer)) {
            isAngularCompatible = false;
          }
          if (angularCommonPeer && !semver.satisfies(targetAngularVersion, angularCommonPeer)) {
            isAngularCompatible = false;
          }
        }
        
        if (!isAngularCompatible) continue;

        // Check Node version constraints
        const engines = versionData.engines || {};
        const nodeConstraint = engines.node;
        
        if (nodeConstraint) {
          try {
            if (!semver.satisfies(nodeVersion, nodeConstraint)) {
              continue; // Skip if Node version doesn't match
            }
          } catch {
            // If constraint is malformed, ignore it
          }
        }

        // This version satisfies all constraints
        return version;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a specific version exists for a package
   */
  private async versionExists(packageName: string, version: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.npmRegistry}/${packageName}/${version}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async findCompatibleVersion(
    packageName: string,
    packageData: any,
    targetAngularMajor: number
  ): Promise<string | null> {
    const versions = Object.keys(packageData.versions).reverse(); // Latest first

    for (const version of versions) {
      try {
        const versionData = packageData.versions[version];
        if (!versionData.peerDependencies) continue;

        const angularPeerDeps = Object.keys(versionData.peerDependencies)
          .filter(dep => dep.startsWith('@angular/'));

        if (angularPeerDeps.length === 0) continue;

        // Check if this version is compatible with target Angular
        let isCompatible = true;
        for (const peerDep of angularPeerDeps) {
          const constraint = versionData.peerDependencies[peerDep];
          // Check if constraint allows the target Angular major version
          try {
            const testVersion = `${targetAngularMajor}.0.0`;
            if (!semver.satisfies(testVersion, constraint)) {
              isCompatible = false;
              break;
            }
          } catch {
            isCompatible = false;
            break;
          }
        }

        if (isCompatible) {
          return version;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async aiAssistedVersionResolution(
    packageName: string,
    currentVersion: string,
    targetAngularVersion: string,
    packageData: any
  ): Promise<string | null> {
    if (!this.llmClient) return null;

    try {
      // Get available versions
      const versions = Object.keys(packageData.versions).slice(-20); // Last 20 versions
      
      const prompt = `You are helping to upgrade an Angular project from its current version to Angular ${targetAngularVersion}.

Package: ${packageName}
Current Version: ${currentVersion}
Target Angular Version: ${targetAngularVersion}

The current version is incompatible with Angular ${targetAngularVersion}. I need to find a compatible version.

Available recent versions: ${versions.join(', ')}

Task: Analyze which version of ${packageName} would be compatible with Angular ${targetAngularVersion}.

Consider:
1. The package should support Angular ${targetAngularVersion} peer dependencies
2. Choose the latest stable version that's compatible
3. Avoid pre-release or beta versions unless necessary

Response format (JSON only):
{
  "version": "x.x.x",
  "reasoning": "brief explanation"
}`;

      const response = await this.llmClient.requestFix({
        type: 'refactor',
        context: {
          targetVersion: targetAngularVersion,
          error: {
            message: `Package ${packageName}@${currentVersion} incompatible with Angular ${targetAngularVersion}`,
            category: 'DEPENDENCY' as any,
            severity: 'error' as const,
          },
          fileContent: prompt,
          constraints: ['Return valid JSON only', 'Choose stable versions', 'Ensure Angular compatibility'],
        },
      });

      // Extract JSON from response reasoning
      const jsonMatch = response.reasoning?.match(/\{[\s\S]*"version"[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.version && versions.includes(result.version)) {
          return result.version;
        }
      }
    } catch (error) {
      console.log(`  ⚠ AI version resolution failed for ${packageName}: ${error}`);
    }

    return null;
  }

  async applyResolutions(
    packageJsonPath: string,
    packageJson: PackageJson,
    resolutions: DependencyResolution[]
  ): Promise<void> {
    for (const resolution of resolutions) {
      if (packageJson.dependencies?.[resolution.package]) {
        packageJson.dependencies[resolution.package] = resolution.targetVersion;
      }
      if (packageJson.devDependencies?.[resolution.package]) {
        packageJson.devDependencies[resolution.package] = resolution.targetVersion;
      }
    }
  }
}

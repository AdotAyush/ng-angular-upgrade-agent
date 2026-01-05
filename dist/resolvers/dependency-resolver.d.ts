import { PackageJson, DependencyResolution } from '../types';
import { LLMClient } from '../llm/llm-client';
export declare class DependencyResolver {
    private npmRegistry;
    private llmClient?;
    private packageCache;
    constructor(llmClient?: LLMClient);
    /**
     * Fetch package metadata from npm with caching
     */
    private fetchPackageInfo;
    /**
     * Fetch specific version metadata from npm
     */
    private fetchVersionInfo;
    /**
     * Categorize a package for resolution priority
     */
    private categorizePackage;
    /**
     * Get version strategy for a package category
     */
    private getVersionStrategy;
    /**
     * Format version with appropriate prefix
     */
    private formatVersion;
    resolveDependencies(packageJson: PackageJson, targetAngularVersion: string): Promise<{
        resolutions: DependencyResolution[];
        conflicts: string[];
        stalePackages: string[];
    }>;
    /**
     * PHASE 8 HELPER: Detect stale artifacts from previous major versions
     * Problem addressed: #6 (Residual artifacts from previous major versions)
     */
    private detectStaleArtifacts;
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
    private resolveAngularEslint;
    /**
     * Resolve @types/node based on Angular CLI's engines.node requirement
     */
    private resolveNodeTypes;
    /**
     * Extract minimum Node.js major version from engines constraint
     */
    private extractMinNodeMajor;
    /**
     * Resolve Angular Material and CDK
     */
    private resolveAngularMaterial;
    /**
     * Find the latest version of a package whose peerDependency satisfies a target version
     *
     * Example: Find @angular-eslint/schematics version where peerDeps['@angular/cli'] includes "20.x"
     */
    private findCompatibleVersionByPeerDep;
    /**
     * Find the latest version that satisfies a semver constraint
     */
    private resolveLatestVersionSatisfying;
    /**
     * Resolve latest stable version for a major version
     */
    private resolveLatestStableMajorVersion;
    private getAngularPackages;
    private resolveTypescript;
    private getLatestPatchVersion;
    /**
     * Iterative cross-dependency resolution with constraint intersection
     *
     * IMPROVED ALGORITHM:
     * 1. Collect ALL peer dependency constraints for each package
     * 2. Compute the INTERSECTION of constraints (what version satisfies ALL requirements)
     * 3. If no intersection exists, report conflict with details
     * 4. Use backtracking only when absolutely necessary
     */
    private iterativeConstraintResolution;
    /**
     * Find a version that satisfies ALL given constraints
     * Returns null if no such version exists (incompatible constraints)
     */
    private findVersionSatisfyingAll;
    /**
     * Find all peer dependency conflicts across resolved packages
     */
    private findAllPeerConflicts;
    /**
     * Attempt to resolve a single peer dependency conflict
     */
    private resolveConflict;
    /**
     * Check if changing a package version would break other resolutions
     */
    private wouldBreakOtherResolutions;
    private resolveThirdPartyAngularLibraries;
    /**
     * Peer-dependency-driven resolution
     * Finds the highest version that satisfies Angular peer dependencies and Node constraints
     */
    private resolvePeerDependencyCompatibleVersion;
    /**
     * Check if a specific version exists for a package
     */
    private versionExists;
    private findCompatibleVersion;
    private aiAssistedVersionResolution;
    applyResolutions(packageJsonPath: string, packageJson: PackageJson, resolutions: DependencyResolution[]): Promise<void>;
}
//# sourceMappingURL=dependency-resolver.d.ts.map
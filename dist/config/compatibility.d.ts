/**
 * Angular Upgrade Agent - Compatibility Configuration
 *
 * NOTE: Dependency versions are now resolved DYNAMICALLY from npm metadata.
 * The ANGULAR_COMPATIBILITY matrix below is DEPRECATED and kept only for reference.
 *
 * The DependencyResolver reads peer dependencies directly from:
 * - @angular/core → for rxjs, zone.js constraints
 * - @angular/compiler-cli → for typescript constraints
 * - @angular/cli → for Node.js version requirements
 * - @angular-eslint/schematics → for eslint compatibility
 *
 * This approach is future-proof and always accurate.
 */
/**
 * @deprecated - Versions are now resolved dynamically from npm peer dependencies.
 * This matrix is kept for reference only and may be removed in future versions.
 */
export declare const ANGULAR_COMPATIBILITY: Record<string, {
    typescript: string[];
    rxjs: string[];
    zoneJs: string;
    nodeMin: string;
    nodeTypes: string;
    materialCdk?: string;
}>;
/**
 * Deprecated RxJS operators and their replacements
 */
export declare const RXJS_MIGRATIONS: Record<string, string>;
/**
 * Known third-party package compatibility
 */
export declare const KNOWN_PACKAGES: Record<string, {
    minAngularVersion?: string;
    maxAngularVersion?: string;
    warning?: string;
}>;
/**
 * Private/custom package version overrides
 * Use this to hardcode major versions for private repositories or packages with specific requirements
 * The resolver will automatically find the latest compatible minor/patch version
 * Format: 'package-name': { 'angularVersion': 'majorVersion' }
 */
export declare const PRIVATE_PACKAGE_VERSIONS: Record<string, Record<string, string>>;
/**
 * Private package URL overrides
 * Use this for packages that should be installed from custom URLs instead of npm registry
 * Format: 'package-name': 'url'
 */
export declare const PRIVATE_PACKAGE_URLS: Record<string, string>;
//# sourceMappingURL=compatibility.d.ts.map
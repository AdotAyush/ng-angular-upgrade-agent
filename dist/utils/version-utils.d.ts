/**
 * Version comparison and validation utilities
 */
export declare class VersionUtils {
    static isValid(version: string): boolean;
    /**
     * Check if version is just a major version (e.g., "20" or "19")
     */
    static isMajorVersionOnly(version: string): boolean;
    /**
     * Resolve a major version to the latest stable patch version from npm
     * Returns the original version if it's already a full semver version
     */
    static resolveLatestVersion(packageName: string, majorVersion: string | number, options?: {
        timeout?: number;
        fallbackToLatest?: boolean;
    }): Promise<{
        version: string;
        resolved: boolean;
        error?: string;
    }>;
    /**
     * Resolve Angular version - handles both full version and major-only input
     * For major-only (e.g., "20"), queries npm for the latest stable version
     */
    static resolveAngularVersion(version: string): Promise<{
        version: string;
        wasResolved: boolean;
        error?: string;
    }>;
    static compare(v1: string, v2: string): number;
    static getMajorVersion(version: string): number;
    static getMinorVersion(version: string): number;
    static satisfies(version: string, range: string): boolean;
    static incrementMajor(version: string): string;
    static normalizeVersion(version: string): string;
    static isUpgrade(from: string, to: string): boolean;
    static getMajorVersionDifference(from: string, to: string): number;
    static validateUpgradePath(from: string, to: string): {
        valid: boolean;
        reason?: string;
    };
}
//# sourceMappingURL=version-utils.d.ts.map
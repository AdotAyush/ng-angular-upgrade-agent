/**
 * Version comparison and validation utilities
 */

import * as semver from 'semver';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VersionUtils {
    static isValid(version: string): boolean {
        return semver.valid(version) !== null;
    }

    /**
     * Check if version is just a major version (e.g., "20" or "19")
     */
    static isMajorVersionOnly(version: string): boolean {
        return /^\d+$/.test(version.trim());
    }

    /**
     * Resolve a major version to the latest stable patch version from npm
     * Returns the original version if it's already a full semver version
     */
    static async resolveLatestVersion(
        packageName: string,
        majorVersion: string | number,
        options?: { timeout?: number; fallbackToLatest?: boolean }
    ): Promise<{ version: string; resolved: boolean; error?: string }> {
        const timeout = options?.timeout ?? 10000;
        const major = String(majorVersion).replace(/[^\d]/g, '');
        
        try {
            const { stdout } = await execAsync(
                `npm view ${packageName} versions --json`,
                { timeout }
            );
            
            const versions: string[] = JSON.parse(stdout);
            
            const matchingVersions = versions
                .filter(v => {
                    const parsed = semver.parse(v);
                    return parsed && parsed.major === parseInt(major) && !v.includes('-'); // Exclude prereleases
                })
                .sort((a, b) => semver.rcompare(a, b)); // Sort descending
            
            if (matchingVersions.length > 0) {
                return { version: matchingVersions[0], resolved: true };
            }
            
            if (options?.fallbackToLatest) {
                const latestMatch = versions
                .filter(v => !v.includes('-'))
                .sort((a, b) => semver.rcompare(a, b));
                
                if (latestMatch.length > 0) {
                    return { 
                        version: latestMatch[0], 
                        resolved: true,
                        error: `No v${major}.x.x found, using latest: ${latestMatch[0]}`
                    };
                }
            }
            
            return { 
                version: `${major}.0.0`, 
                resolved: false, 
                error: `No versions found for ${packageName}@${major}.x.x` 
            };
        } catch (error: any) {
            return { 
                version: `${major}.0.0`, 
                resolved: false, 
                error: `Failed to query npm: ${error.message}` 
            };
        }
    }

    /**
     * Resolve Angular version - handles both full version and major-only input
     * For major-only (e.g., "20"), queries npm for the latest stable version
     */
    static async resolveAngularVersion(version: string): Promise<{
        version: string;
        wasResolved: boolean;
        error?: string;
    }> {
        if (this.isValid(version)) {
            return { version, wasResolved: false };
        }
        
        if (this.isMajorVersionOnly(version)) {
            console.log(`  Resolving Angular v${version} to latest stable version...`);
            const result = await this.resolveLatestVersion('@angular/core', version);
            
            if (result.resolved) {
                console.log(`  ✓ Resolved to Angular ${result.version}`);
                return { version: result.version, wasResolved: true };
            } else {
                console.log(`  ⚠ Could not resolve, using ${result.version}: ${result.error}`);
                return { version: result.version, wasResolved: true, error: result.error };
            }
        }
        
        const coerced = semver.coerce(version);
        if (coerced) {
            return { version: coerced.version, wasResolved: true };
        }
        
        return { 
            version, 
            wasResolved: false, 
            error: `Invalid version format: ${version}` 
        };
    }

    static compare(v1: string, v2: string): number {
        return semver.compare(v1, v2);
    }

    static getMajorVersion(version: string): number {
        const parsed = semver.parse(version);
        return parsed?.major || 0;
    }

    static getMinorVersion(version: string): number {
        const parsed = semver.parse(version);
        return parsed?.minor || 0;
    }

    static satisfies(version: string, range: string): boolean {
        return semver.satisfies(version, range);
    }

    static incrementMajor(version: string): string {
        const incremented = semver.inc(version, 'major');
        return incremented || version;
    }

    static normalizeVersion(version: string): string {
        return version.replace(/[\^~>=<]/g, '').trim();
    }

    static isUpgrade(from: string, to: string): boolean {
        return this.compare(from, to) < 0;
    }

    static getMajorVersionDifference(from: string, to: string): number {
        const fromMajor = this.getMajorVersion(from);
        const toMajor = this.getMajorVersion(to);
        return toMajor - fromMajor;
    }

    static validateUpgradePath(from: string, to: string): { valid: boolean; reason?: string } {
        if (!this.isValid(from)) {
            return { valid: false, reason: `Invalid source version: ${from}` };
        }

        if (!this.isValid(to)) {
            return { valid: false, reason: `Invalid target version: ${to}` };
        }

        if (!this.isUpgrade(from, to)) {
            return { valid: false, reason: `Target version must be higher than source version` };
        }

        const majorDiff = this.getMajorVersionDifference(from, to);
        if (majorDiff > 3) {
            return { 
                valid: false, 
                reason: `Upgrading more than 3 major versions at once is not recommended. Current diff: ${majorDiff}` 
            };
        }

        return { valid: true };
    }
}

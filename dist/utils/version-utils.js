"use strict";
/**
 * Version comparison and validation utilities
 */
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
exports.VersionUtils = void 0;
const semver = __importStar(require("semver"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class VersionUtils {
    static isValid(version) {
        return semver.valid(version) !== null;
    }
    /**
     * Check if version is just a major version (e.g., "20" or "19")
     */
    static isMajorVersionOnly(version) {
        return /^\d+$/.test(version.trim());
    }
    /**
     * Resolve a major version to the latest stable patch version from npm
     * Returns the original version if it's already a full semver version
     */
    static async resolveLatestVersion(packageName, majorVersion, options) {
        const timeout = options?.timeout ?? 10000;
        const major = String(majorVersion).replace(/[^\d]/g, '');
        try {
            const { stdout } = await execAsync(`npm view ${packageName} versions --json`, { timeout });
            const versions = JSON.parse(stdout);
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
        }
        catch (error) {
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
    static async resolveAngularVersion(version) {
        if (this.isValid(version)) {
            return { version, wasResolved: false };
        }
        if (this.isMajorVersionOnly(version)) {
            console.log(`  Resolving Angular v${version} to latest stable version...`);
            const result = await this.resolveLatestVersion('@angular/core', version);
            if (result.resolved) {
                console.log(`  ✓ Resolved to Angular ${result.version}`);
                return { version: result.version, wasResolved: true };
            }
            else {
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
    static compare(v1, v2) {
        return semver.compare(v1, v2);
    }
    static getMajorVersion(version) {
        const parsed = semver.parse(version);
        return parsed?.major || 0;
    }
    static getMinorVersion(version) {
        const parsed = semver.parse(version);
        return parsed?.minor || 0;
    }
    static satisfies(version, range) {
        return semver.satisfies(version, range);
    }
    static incrementMajor(version) {
        const incremented = semver.inc(version, 'major');
        return incremented || version;
    }
    static normalizeVersion(version) {
        return version.replace(/[\^~>=<]/g, '').trim();
    }
    static isUpgrade(from, to) {
        return this.compare(from, to) < 0;
    }
    static getMajorVersionDifference(from, to) {
        const fromMajor = this.getMajorVersion(from);
        const toMajor = this.getMajorVersion(to);
        return toMajor - fromMajor;
    }
    static validateUpgradePath(from, to) {
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
exports.VersionUtils = VersionUtils;
//# sourceMappingURL=version-utils.js.map
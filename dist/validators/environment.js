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
exports.EnvironmentValidator = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const semver = __importStar(require("semver"));
const compatibility_1 = require("../config/compatibility");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class EnvironmentValidator {
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    async validate(targetAngularVersion) {
        const errors = [];
        const environment = await this.detectEnvironment();
        const majorVersion = parseInt(targetAngularVersion.split('.')[0]);
        const requiredNodeVersion = compatibility_1.ANGULAR_COMPATIBILITY[majorVersion]?.nodeMin;
        if (requiredNodeVersion) {
            if (!semver.satisfies(environment.nodeVersion, `>=${requiredNodeVersion}`)) {
                errors.push(`Node.js version ${environment.nodeVersion} is too old. ` +
                    `Angular ${targetAngularVersion} requires Node.js >= ${requiredNodeVersion}`);
            }
        }
        if (!environment.npmVersion && !environment.pnpmVersion) {
            errors.push(`No package manager (npm or pnpm) detected`);
        }
        if (!environment.angularCliVersion) {
            errors.push(`Angular CLI not found. Install with: npm install -g @angular/cli`);
        }
        return {
            valid: errors.length === 0,
            environment,
            errors,
        };
    }
    async detectEnvironment() {
        const nodeVersion = await this.getNodeVersion();
        const npmVersion = await this.getNpmVersion();
        const pnpmVersion = await this.getPnpmVersion();
        const angularCliVersion = await this.getAngularCliVersion();
        const packageManager = pnpmVersion ? 'pnpm' : 'npm';
        return {
            nodeVersion,
            npmVersion: npmVersion || '',
            pnpmVersion,
            angularCliVersion,
            packageManager
        };
    }
    async getNodeVersion() {
        try {
            const { stdout } = await execAsync('node --version');
            return stdout.trim().replace('v', '');
        }
        catch (error) {
            throw new Error('Node.js not found');
        }
    }
    async getNpmVersion() {
        try {
            const { stdout } = await execAsync('npm --version');
            return stdout.trim();
        }
        catch (error) {
            return undefined;
        }
    }
    async getPnpmVersion() {
        try {
            const { stdout } = await execAsync('pnpm --version');
            return stdout.trim();
        }
        catch (error) {
            return undefined;
        }
    }
    async getAngularCliVersion() {
        const cwd = this.projectPath ? { cwd: this.projectPath } : {};
        try {
            const { stdout } = await execAsync('ng version --json', cwd);
            const versionInfo = JSON.parse(stdout);
            return versionInfo['cli']?.['version'] || versionInfo['@angular/cli'];
        }
        catch (error) {
            try {
                const { stdout } = await execAsync('npx ng version --json', cwd);
                const versionInfo = JSON.parse(stdout);
                return versionInfo['cli']?.['version'] || versionInfo['@angular/cli'];
            }
            catch (npxError) {
                try {
                    const { stdout } = await execAsync('npx ng version', cwd);
                    const match = stdout.match(/Angular CLI:\s+(\d+\.\d+\.\d+)/);
                    if (match) {
                        return match[1];
                    }
                    return undefined;
                }
                catch (textError) {
                    return undefined;
                }
            }
        }
    }
}
exports.EnvironmentValidator = EnvironmentValidator;
//# sourceMappingURL=environment.js.map
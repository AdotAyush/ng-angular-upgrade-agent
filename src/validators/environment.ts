import { exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import { EnvironmentInfo } from '../types';
import { ANGULAR_COMPATIBILITY } from '../config/compatibility';

const execAsync = promisify(exec);

export class EnvironmentValidator {
    constructor(private projectPath?: string) {}

    async validate(targetAngularVersion: string): Promise<{
        valid: boolean;
        environment: EnvironmentInfo;
        errors: string[];
    }> {
        const errors: string[] = [];
        const environment = await this.detectEnvironment();

        const majorVersion = parseInt(targetAngularVersion.split('.')[0]);
        const requiredNodeVersion = ANGULAR_COMPATIBILITY[majorVersion]?.nodeMin;

        if(requiredNodeVersion){
            if(!semver.satisfies(environment.nodeVersion, `>=${requiredNodeVersion}`)){
                errors.push(
                    `Node.js version ${environment.nodeVersion} is too old. ` + 
                    `Angular ${targetAngularVersion} requires Node.js >= ${requiredNodeVersion}`
                );
            }
        }

        if(!environment.npmVersion && !environment.pnpmVersion){
            errors.push(`No package manager (npm or pnpm) detected`);
        }
        if(!environment.angularCliVersion){
            errors.push(`Angular CLI not found. Install with: npm install -g @angular/cli`);
        }
        return {
            valid: errors.length === 0,
            environment,
            errors,
        };
    }

    async detectEnvironment(): Promise<EnvironmentInfo> {
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
        }
    }

    private async getNodeVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('node --version');
            return stdout.trim().replace('v','');
        }catch (error){
            throw new Error('Node.js not found');
        }
    }

    private async getNpmVersion(): Promise<string | undefined> {
        try {
            const { stdout } = await execAsync('npm --version');
            return stdout.trim();
        }catch (error){
            return undefined;
        }
    }

    private async getPnpmVersion(): Promise<string | undefined> {
        try {
            const { stdout } = await execAsync('pnpm --version');
            return stdout.trim();
        }catch (error){
            return undefined;
        }
    }

    private async getAngularCliVersion(): Promise<string | undefined> {
        const cwd = this.projectPath ? { cwd: this.projectPath} : {};
        try {
            const { stdout } = await execAsync('ng version --json', cwd);
            const versionInfo = JSON.parse(stdout);

            return versionInfo['cli']?.['version'] || versionInfo['@angular/cli'];
        }catch (error) {
            try{
                const { stdout } = await execAsync('npx ng version --json', cwd);
                const versionInfo = JSON.parse(stdout);
                return versionInfo['cli']?.['version'] || versionInfo['@angular/cli'];
            }catch (npxError) {
                try {
                    const { stdout } = await execAsync('npx ng version', cwd);
                    const match = stdout.match(/Angular CLI:\s+(\d+\.\d+\.\d+)/);
                    if(match){
                        return match[1];
                    }
                    return undefined;
                }catch(textError){
                    return undefined;
                }
            }
        }
    }
}
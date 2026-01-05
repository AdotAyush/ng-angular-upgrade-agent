import { EnvironmentInfo } from '../types';
export declare class EnvironmentValidator {
    private projectPath?;
    constructor(projectPath?: string | undefined);
    validate(targetAngularVersion: string): Promise<{
        valid: boolean;
        environment: EnvironmentInfo;
        errors: string[];
    }>;
    detectEnvironment(): Promise<EnvironmentInfo>;
    private getNodeVersion;
    private getNpmVersion;
    private getPnpmVersion;
    private getAngularCliVersion;
}
//# sourceMappingURL=environment.d.ts.map
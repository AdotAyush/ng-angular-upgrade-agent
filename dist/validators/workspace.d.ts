import { PackageJson, WorkspaceInfo } from '../types';
export declare class WorkspaceDetector {
    detectWorkspace(projectPath: string): Promise<WorkspaceInfo>;
    readPackageJson(path: string): Promise<PackageJson>;
    writePackageJson(path: string, packageJson: PackageJson): Promise<void>;
    private extractProjects;
    backupFile(filePath: string): Promise<void>;
}
//# sourceMappingURL=workspace.d.ts.map
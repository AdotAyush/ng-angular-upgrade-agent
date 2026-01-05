import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { PackageJson, WorkspaceInfo, ProjectInfo } from '../types';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);

export class WorkspaceDetector {
    async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const angularJsonPath = path.join(projectPath, 'angular.json');

        if (!await exists(packageJsonPath)){
            throw new Error('package json not found');
        }

        const rootPackageJson = await this.readPackageJson(packageJsonPath);
        const isWorkspace = await exists(angularJsonPath);

        let projects: ProjectInfo[] = [];

        if (isWorkspace){
            const angularJson = JSON.parse(
                await readFile(angularJsonPath, 'utf-8')
            );

            projects = await this.extractProjects(projectPath, angularJson);
        }else {
            projects = [{
                name: rootPackageJson.name,
                path: projectPath,
                type: 'application',
                isInternal: false,
            }]
        }
        return {
            isWorkspace,
            projects,
            rootPackageJson
        }
    }

    async readPackageJson(path: string): Promise<PackageJson> {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
    }

    async writePackageJson(path: string, packageJson: PackageJson): Promise<void> {
        const content = JSON.stringify(packageJson, null, 2);
        await writeFile(path, content, 'utf-8');
    }

    private async extractProjects(
        rootPath: string,
        angularJson: any
    ): Promise<ProjectInfo[]> {
        const projects: ProjectInfo[] = [];
        const projectsConfig = angularJson.projects || {};

        for (const [name, config] of Object.entries(projectsConfig)) {
        const projectConfig = config as any;
        const projectPath = path.join(rootPath, projectConfig.root || '');
        
        projects.push({
            name,
            path: projectPath,
            type: projectConfig.projectType || 'application',
            isInternal: projectConfig.root?.startsWith('projects/') || false,
        });
        }

        return projects;
    }

    async backupFile(filePath: string): Promise<void> {
        const backupPath = `${filePath}.backup-${Date.now()}`;
        const content = await readFile(filePath, 'utf-8');
        await writeFile(backupPath, content, 'utf-8');
    }
}
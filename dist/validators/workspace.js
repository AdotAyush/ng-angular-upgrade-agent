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
exports.WorkspaceDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const exists = (0, util_1.promisify)(fs.exists);
class WorkspaceDetector {
    async detectWorkspace(projectPath) {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const angularJsonPath = path.join(projectPath, 'angular.json');
        if (!await exists(packageJsonPath)) {
            throw new Error('package json not found');
        }
        const rootPackageJson = await this.readPackageJson(packageJsonPath);
        const isWorkspace = await exists(angularJsonPath);
        let projects = [];
        if (isWorkspace) {
            const angularJson = JSON.parse(await readFile(angularJsonPath, 'utf-8'));
            projects = await this.extractProjects(projectPath, angularJson);
        }
        else {
            projects = [{
                    name: rootPackageJson.name,
                    path: projectPath,
                    type: 'application',
                    isInternal: false,
                }];
        }
        return {
            isWorkspace,
            projects,
            rootPackageJson
        };
    }
    async readPackageJson(path) {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
    }
    async writePackageJson(path, packageJson) {
        const content = JSON.stringify(packageJson, null, 2);
        await writeFile(path, content, 'utf-8');
    }
    async extractProjects(rootPath, angularJson) {
        const projects = [];
        const projectsConfig = angularJson.projects || {};
        for (const [name, config] of Object.entries(projectsConfig)) {
            const projectConfig = config;
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
    async backupFile(filePath) {
        const backupPath = `${filePath}.backup-${Date.now()}`;
        const content = await readFile(filePath, 'utf-8');
        await writeFile(backupPath, content, 'utf-8');
    }
}
exports.WorkspaceDetector = WorkspaceDetector;
//# sourceMappingURL=workspace.js.map
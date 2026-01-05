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
exports.CodeAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const typescript_estree_1 = require("@typescript-eslint/typescript-estree");
const readFile = (0, util_1.promisify)(fs.readFile);
const readdir = (0, util_1.promisify)(fs.readdir);
const stat = (0, util_1.promisify)(fs.stat);
class CodeAnalyzer {
    async analyzeProject(projectPath) {
        const issues = [];
        const metadata = {
            hasStandaloneComponents: false,
            hasNgModules: false,
            usesRouter: false,
            usesSSR: false,
            rxjsUsage: [],
        };
        const tsFiles = await this.findTypeScriptFiles(projectPath);
        for (const file of tsFiles) {
            const fileIssues = await this.analyzeFile(file, metadata);
            issues.push(...fileIssues);
        }
        const templateFiles = await this.findTemplateFiles(projectPath);
        for (const file of templateFiles) {
            const fileIssues = await this.analyzeTemplate(file);
            issues.push(...fileIssues);
        }
        return { issues, metadata };
    }
    async analyzeFile(filePath, metadata) {
        const issues = [];
        const content = await readFile(filePath, 'utf-8');
        try {
            const ast = (0, typescript_estree_1.parse)(content, {
                loc: true,
                range: true,
                comment: true,
                jsx: false,
            });
            // Analyze AST
            this.traverseAST(ast, filePath, issues, metadata);
        }
        catch (error) {
            issues.push({
                type: 'parse-error',
                severity: 'error',
                message: `Failed to parse file: ${error}`,
                file: filePath,
            });
        }
        return issues;
    }
    traverseAST(node, filePath, issues, metadata) {
        if (!node)
            return;
        // Check for standalone components
        if (node.type === 'Decorator' && node.expression?.callee?.name === 'Component') {
            const args = node.expression.arguments[0];
            if (args?.properties) {
                const standalone = args.properties.find((p) => p.key?.name === 'standalone');
                if (standalone?.value?.value === true) {
                    metadata.hasStandaloneComponents = true;
                }
            }
        }
        // Check for NgModule
        if (node.type === 'Decorator' && node.expression?.callee?.name === 'NgModule') {
            metadata.hasNgModules = true;
        }
        // Check for inject() usage
        if (node.type === 'CallExpression' && node.callee?.name === 'inject') {
            // Check if used outside constructor/injection context
            if (!this.isInInjectionContext(node)) {
                issues.push({
                    type: 'inject-misuse',
                    severity: 'error',
                    message: 'inject() must be called in an injection context',
                    file: filePath,
                    line: node.loc?.start.line,
                    column: node.loc?.start.column,
                    suggestion: 'Move inject() call to constructor or field initializer',
                });
            }
        }
        // Check for Router usage
        if (node.type === 'ImportDeclaration') {
            const source = node.source?.value;
            if (source === '@angular/router') {
                metadata.usesRouter = true;
            }
            // Check for RxJS imports
            if (source === 'rxjs' || source?.startsWith('rxjs/')) {
                node.specifiers?.forEach((spec) => {
                    if (spec.imported?.name) {
                        metadata.rxjsUsage.push(spec.imported.name);
                    }
                });
            }
        }
        // Check for SSR-unsafe code
        if (node.type === 'MemberExpression') {
            const object = node.object?.name;
            if (object === 'window' || object === 'document' || object === 'localStorage') {
                issues.push({
                    type: 'ssr-unsafe',
                    severity: 'warning',
                    message: `Direct access to ${object} is not SSR-safe`,
                    file: filePath,
                    line: node.loc?.start.line,
                    column: node.loc?.start.column,
                    suggestion: `Use PLATFORM_ID and isPlatformBrowser() check`,
                });
            }
        }
        // Recursively traverse children
        for (const key of Object.keys(node)) {
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach(c => this.traverseAST(c, filePath, issues, metadata));
            }
            else if (typeof child === 'object' && child !== null) {
                this.traverseAST(child, filePath, issues, metadata);
            }
        }
    }
    isInInjectionContext(node) {
        // Simplified check - in production, traverse up the AST
        return false; // Conservative approach
    }
    async analyzeTemplate(filePath) {
        const issues = [];
        const content = await readFile(filePath, 'utf-8');
        // Check for common template issues
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Check for deprecated two-way binding syntax
            if (line.includes('[(ngModel)]') && !line.includes('FormsModule')) {
                issues.push({
                    type: 'template-binding',
                    severity: 'warning',
                    message: 'ngModel requires FormsModule to be imported',
                    file: filePath,
                    line: index + 1,
                });
            }
            // Check for unsafe null access
            if (line.match(/\{\{[^}]*\.[^}]*\}\}/) && !line.includes('?')) {
                issues.push({
                    type: 'template-strictness',
                    severity: 'info',
                    message: 'Consider using safe navigation operator (?.) for null safety',
                    file: filePath,
                    line: index + 1,
                });
            }
        });
        return issues;
    }
    async findTypeScriptFiles(dir) {
        const files = [];
        try {
            const entries = await readdir(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = await stat(fullPath);
                if (stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
                    const subFiles = await this.findTypeScriptFiles(fullPath);
                    files.push(...subFiles);
                }
                else if (stats.isFile() && entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Skip inaccessible directories
        }
        return files;
    }
    async findTemplateFiles(dir) {
        const files = [];
        try {
            const entries = await readdir(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = await stat(fullPath);
                if (stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
                    const subFiles = await this.findTemplateFiles(fullPath);
                    files.push(...subFiles);
                }
                else if (stats.isFile() && entry.endsWith('.html')) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Skip inaccessible directories
        }
        return files;
    }
    shouldSkipDirectory(name) {
        return ['node_modules', 'dist', '.git', '.angular', 'coverage'].includes(name);
    }
}
exports.CodeAnalyzer = CodeAnalyzer;
//# sourceMappingURL=code-analyzer.js.map
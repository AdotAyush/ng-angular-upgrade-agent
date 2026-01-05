import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { parse } from '@typescript-eslint/typescript-estree';
import { CodeIssue, AnalysisResult } from '../types';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class CodeAnalyzer {
    async analyzeProject(projectPath: string): Promise<AnalysisResult> {
        const issues: CodeIssue[] = [];
        const metadata = {
            hasStandaloneComponents: false,
            hasNgModules: false,
            usesRouter: false,
            usesSSR: false,
            rxjsUsage: [] as string[],
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

    private async analyzeFile(
        filePath: string,
        metadata: AnalysisResult['metadata']
    ): Promise<CodeIssue[]> {
        const issues: CodeIssue[] = [];
        const content = await readFile(filePath, 'utf-8');

        try {
            const ast = parse(content, {
                loc: true,
                range: true,
                comment: true,
                jsx: false,
            });

            // Analyze AST
            this.traverseAST(ast, filePath, issues, metadata);
        } catch (error) {
            issues.push({
                type: 'parse-error',
                severity: 'error',
                message: `Failed to parse file: ${error}`,
                file: filePath,
            });
        }

        return issues;
    }

    private traverseAST(
        node: any,
        filePath: string,
        issues: CodeIssue[],
        metadata: AnalysisResult['metadata']
    ): void {
        if (!node) return;

        // Check for standalone components
        if (node.type === 'Decorator' && node.expression?.callee?.name === 'Component') {
            const args = node.expression.arguments[0];
            if (args?.properties) {
                const standalone = args.properties.find((p: any) => p.key?.name === 'standalone');
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
                node.specifiers?.forEach((spec: any) => {
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
            } else if (typeof child === 'object' && child !== null) {
                this.traverseAST(child, filePath, issues, metadata);
            }
        }
    }

    private isInInjectionContext(node: any): boolean {
        // Simplified check - in production, traverse up the AST
        return false; // Conservative approach
    }

    private async analyzeTemplate(filePath: string): Promise<CodeIssue[]> {
        const issues: CodeIssue[] = [];
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

    private async findTypeScriptFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = await readdir(dir);
            
            for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
                    const subFiles = await this.findTypeScriptFiles(fullPath);
                    files.push(...subFiles);
                } else if (stats.isFile() && entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip inaccessible directories
        }
        
        return files;
    }

    private async findTemplateFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = await readdir(dir);
            
            for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
                    const subFiles = await this.findTemplateFiles(fullPath);
                    files.push(...subFiles);
                } else if (stats.isFile() && entry.endsWith('.html')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip inaccessible directories
        }
        
        return files;
    }

    private shouldSkipDirectory(name: string): boolean {
        return ['node_modules', 'dist', '.git', '.angular', 'coverage'].includes(name);
    }
}

import { AnalysisResult } from '../types';
export declare class CodeAnalyzer {
    analyzeProject(projectPath: string): Promise<AnalysisResult>;
    private analyzeFile;
    private traverseAST;
    private isInInjectionContext;
    private analyzeTemplate;
    private findTypeScriptFiles;
    private findTemplateFiles;
    private shouldSkipDirectory;
}
//# sourceMappingURL=code-analyzer.d.ts.map
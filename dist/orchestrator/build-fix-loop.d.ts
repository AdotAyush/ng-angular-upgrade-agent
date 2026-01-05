import { BuildError, FixResult, EnvironmentInfo } from '../types';
export interface BuildFixLoopOptions {
    llmApiKey: string;
    maxAttempts?: number;
    llmProvider?: 'bedrock' | 'gemini';
    llmModel?: string;
    awsRegion?: string;
    awsSecretKey?: string;
    geminiApiKey?: string;
    useAgenticMode?: boolean;
    useCache?: boolean;
    useSchematics?: boolean;
    verbose?: boolean;
}
export declare class BuildFixLoop {
    private errorClassifier;
    private fixRegistry;
    private llmClient;
    private agenticClient;
    private responseCache;
    private schematicRunner;
    private maxAttempts;
    private fileBackups;
    private useAgenticMode;
    private useCache;
    private useSchematics;
    private verbose;
    private schematicsRunThisSession;
    constructor(options: BuildFixLoopOptions);
    /**
     * Initialize project-specific components
     */
    private initializeForProject;
    static create(llmApiKey: string, maxAttempts?: number, llmProvider?: 'bedrock' | 'gemini', llmOptions?: {
        model?: string;
        awsRegion?: string;
        awsSecretKey?: string;
        geminiApiKey?: string;
    }): BuildFixLoop;
    execute(projectPath: string, targetVersion: string, environment: EnvironmentInfo): Promise<{
        success: boolean;
        attempts: number;
        resolvedErrors: BuildError[];
        unresolvedErrors: BuildError[];
        appliedFixes: FixResult[];
        cacheStats?: {
            hits: number;
            misses: number;
        };
    }>;
    private runBuild;
    private runTests;
    private tryLLMFix;
    private applyChanges;
    /**
     * Fuzzy replace - try to match ignoring whitespace differences
     */
    private fuzzyReplace;
    /**
     * Backup a file before making changes
     */
    private backupFile;
    /**
     * Rollback all backed up files to original state
     */
    private rollbackAllChanges;
    /**
     * Find relevant files for errors without file context
     * Searches project for files that might be related to the error
     */
    private findRelevantContext;
    /**
     * Recursively search files for terms
     */
    private recursiveFileSearch;
    /**
     * Check if an error might be fixable by Angular schematics
     */
    private isSchematicFixableError;
    /**
     * Try to fix an error using Angular schematics
     */
    private trySchematicFix;
    /**
     * Determine which schematic to run for an error
     */
    private determineSchematic;
    /**
     * Get the package name for running ng update
     */
    private getPackageForSchematic;
    verifyBuildAndTests(projectPath: string, environment: EnvironmentInfo): Promise<{
        buildPassed: boolean;
        testsPassed: boolean;
    }>;
}
//# sourceMappingURL=build-fix-loop.d.ts.map
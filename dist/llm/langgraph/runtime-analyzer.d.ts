/**
 * Runtime Error Analyzer
 *
 * Specialized analyzer for browser runtime errors that occur after
 * successful builds. Handles common issues like:
 * - Node.js-only packages in browser context
 * - Missing polyfills
 * - Browser compatibility issues
 * - Import/module resolution errors
 */
import { BuildError, FileChange } from '../../types';
import { IssueDiagnosis } from './types';
/**
 * Parse a browser console error into structured data
 */
export declare function parseRuntimeError(errorOutput: string): {
    message: string;
    stackTrace: string;
    sourceFile?: string;
    lineNumber?: number;
    involvedPackages: string[];
};
/**
 * Analyze a runtime error and produce diagnosis
 */
export declare function analyzeRuntimeError(errorOutput: string, projectPath: string): Promise<{
    diagnosis: IssueDiagnosis;
    suggestedFixes: FileChange[];
    explanation: string;
}>;
/**
 * Create a BuildError from runtime error output
 */
export declare function createBuildErrorFromRuntime(errorOutput: string): BuildError;
/**
 * Check project for potential browser compatibility issues
 */
export declare function scanForBrowserIssues(projectPath: string): Promise<{
    issues: Array<{
        package: string;
        usedIn: string[];
        alternative: string;
    }>;
    clean: boolean;
}>;
//# sourceMappingURL=runtime-analyzer.d.ts.map
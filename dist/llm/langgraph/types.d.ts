import { z } from 'zod';
import { BuildError, FileChange } from '../../types';
export type AgentPhase = 'analyzing' | 'investigating' | 'diagnosing' | 'planning' | 'fixing' | 'verifying' | 'complete' | 'failed';
export type IssueType = 'build-error' | 'runtime-error' | 'browser-compatibility' | 'node-only-package' | 'deprecated-api' | 'missing-dependency' | 'type-error' | 'import-error' | 'configuration-error' | 'unknown';
export interface InvestigationResult {
    tool: string;
    query: string;
    result: string;
    timestamp: Date;
    success: boolean;
}
export interface IssueDiagnosis {
    issueType: IssueType;
    rootCause: string;
    affectedFiles: string[];
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    evidence: string[];
    suggestedFix?: string;
}
export interface PlannedFix {
    id: string;
    description: string;
    files: string[];
    changes: FileChange[];
    priority: number;
    dependencies: string[];
    estimatedImpact: 'high' | 'medium' | 'low';
}
export interface FixAttemptResult {
    fixId: string;
    success: boolean;
    changes: FileChange[];
    error?: string;
    buildOutput?: string;
    runtimeCheck?: {
        passed: boolean;
        errors: string[];
    };
}
export interface AgentState {
    originalError: BuildError;
    projectPath: string;
    projectContext: string;
    buildOutput: string;
    targetVersion: string;
    phase: AgentPhase;
    iteration: number;
    maxIterations: number;
    tokenUsage: number;
    maxTokenBudget: number;
    investigationResults: InvestigationResult[];
    filesRead: Map<string, string>;
    searchResults: Map<string, string>;
    diagnoses: IssueDiagnosis[];
    relatedPackages: string[];
    browserCompatibilityIssues: string[];
    plannedFixes: PlannedFix[];
    currentFixIndex: number;
    fixAttempts: FixAttemptResult[];
    appliedChanges: FileChange[];
    rollbackStack: FileChange[][];
    success: boolean;
    finalChanges: FileChange[];
    reasoning: string;
    confidence: number;
    suggestionsForUser: string[];
    messages: AgentMessage[];
}
export interface AgentMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface ToolResult {
    toolCallId: string;
    name: string;
    result: string;
    success: boolean;
}
export declare const ReadFileArgsSchema: z.ZodObject<{
    filePath: z.ZodString;
    startLine: z.ZodOptional<z.ZodNumber>;
    endLine: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}, {
    filePath: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}>;
export declare const SearchCodeArgsSchema: z.ZodObject<{
    pattern: z.ZodString;
    filePattern: z.ZodOptional<z.ZodString>;
    caseSensitive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    filePattern?: string | undefined;
    caseSensitive?: boolean | undefined;
}, {
    pattern: string;
    filePattern?: string | undefined;
    caseSensitive?: boolean | undefined;
}>;
export declare const ListFilesArgsSchema: z.ZodObject<{
    directory: z.ZodString;
    recursive: z.ZodOptional<z.ZodBoolean>;
    pattern: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    directory: string;
    pattern?: string | undefined;
    recursive?: boolean | undefined;
}, {
    directory: string;
    pattern?: string | undefined;
    recursive?: boolean | undefined;
}>;
export declare const RunCommandArgsSchema: z.ZodObject<{
    command: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    command: string;
    cwd?: string | undefined;
    timeout?: number | undefined;
}, {
    command: string;
    cwd?: string | undefined;
    timeout?: number | undefined;
}>;
export declare const CheckPackageArgsSchema: z.ZodObject<{
    packageName: z.ZodString;
    checkBrowserCompat: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    packageName: string;
    checkBrowserCompat?: boolean | undefined;
}, {
    packageName: string;
    checkBrowserCompat?: boolean | undefined;
}>;
export declare const ProposeChangesArgsSchema: z.ZodObject<{
    changes: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        type: z.ZodEnum<["create", "modify", "delete"]>;
        content: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
        replace: z.ZodOptional<z.ZodString>;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reasoning: string;
        type: "modify" | "create" | "delete";
        file: string;
        replace?: string | undefined;
        search?: string | undefined;
        content?: string | undefined;
    }, {
        reasoning: string;
        type: "modify" | "create" | "delete";
        file: string;
        replace?: string | undefined;
        search?: string | undefined;
        content?: string | undefined;
    }>, "many">;
    explanation: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    changes: {
        reasoning: string;
        type: "modify" | "create" | "delete";
        file: string;
        replace?: string | undefined;
        search?: string | undefined;
        content?: string | undefined;
    }[];
    confidence: number;
    explanation: string;
}, {
    changes: {
        reasoning: string;
        type: "modify" | "create" | "delete";
        file: string;
        replace?: string | undefined;
        search?: string | undefined;
        content?: string | undefined;
    }[];
    confidence: number;
    explanation: string;
}>;
export declare const AnalyzeRuntimeErrorArgsSchema: z.ZodObject<{
    errorMessage: z.ZodString;
    stackTrace: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    errorMessage: string;
    stackTrace?: string | undefined;
    context?: string | undefined;
}, {
    errorMessage: string;
    stackTrace?: string | undefined;
    context?: string | undefined;
}>;
export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;
export type SearchCodeArgs = z.infer<typeof SearchCodeArgsSchema>;
export type ListFilesArgs = z.infer<typeof ListFilesArgsSchema>;
export type RunCommandArgs = z.infer<typeof RunCommandArgsSchema>;
export type CheckPackageArgs = z.infer<typeof CheckPackageArgsSchema>;
export type ProposeChangesArgs = z.infer<typeof ProposeChangesArgsSchema>;
export type AnalyzeRuntimeErrorArgs = z.infer<typeof AnalyzeRuntimeErrorArgsSchema>;
/**
 * Initial state factory
 */
export declare function createInitialState(error: BuildError, projectPath: string, projectContext: string, buildOutput: string, targetVersion: string, options?: {
    maxIterations?: number;
    maxTokenBudget?: number;
}): AgentState;
/**
 * Browser-incompatible packages known to cause issues
 */
export declare const BROWSER_INCOMPATIBLE_PACKAGES: Set<string>;
/**
 * Common Angular upgrade issues patterns
 */
export declare const RUNTIME_ERROR_PATTERNS: {
    pattern: RegExp;
    type: IssueType;
    hint: string;
}[];
//# sourceMappingURL=types.d.ts.map
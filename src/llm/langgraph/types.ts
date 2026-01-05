import { z } from 'zod';
import { BuildError, FileChange, ErrorCategory } from '../../types';

export type AgentPhase = | 'analyzing' | 'investigating' | 'diagnosing' | 'planning' | 'fixing' | 'verifying' | 'complete' | 'failed';

export type IssueType = | 'build-error' | 'runtime-error' |  'browser-compatibility' | 'node-only-package' | 'deprecated-api' | 'missing-dependency' | 'type-error' | 'import-error' | 'configuration-error' | 'unknown';

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
    confidence: number; // 0.0 - 1.0
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
    }
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
    filesRead: Map<string, string>; // filepath -> content
    searchResults: Map<string, string>; // query -> result

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
    name?: string; // e.g., tool name
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

export const ReadFileArgsSchema = z.object({
  filePath: z.string().describe('Relative path from project root'),
  startLine: z.number().optional().describe('Starting line number (1-indexed)'),
  endLine: z.number().optional().describe('Ending line number (inclusive)'),
});

export const SearchCodeArgsSchema = z.object({
  pattern: z.string().describe('Text or regex pattern to search for'),
  filePattern: z.string().optional().describe('Glob pattern for files to search (e.g., "**/*.ts")'),
  caseSensitive: z.boolean().optional().describe('Whether search is case sensitive'),
});

export const ListFilesArgsSchema = z.object({
  directory: z.string().describe('Directory path relative to project root'),
  recursive: z.boolean().optional().describe('List files recursively'),
  pattern: z.string().optional().describe('Glob pattern to filter files'),
});

export const RunCommandArgsSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory (relative to project root)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
});

export const CheckPackageArgsSchema = z.object({
  packageName: z.string().describe('NPM package name to check'),
  checkBrowserCompat: z.boolean().optional().describe('Check if package works in browser'),
});

export const ProposeChangesArgsSchema = z.object({
  changes: z.array(z.object({
    file: z.string().describe('File path relative to project root'),
    type: z.enum(['create', 'modify', 'delete']).describe('Type of change'),
    content: z.string().optional().describe('New file content or modified content'),
    search: z.string().optional().describe('Text to search for (for modify)'),
    replace: z.string().optional().describe('Text to replace with (for modify)'),
    reasoning: z.string().describe('Why this change is needed'),
  })).describe('Array of file changes to apply'),
  explanation: z.string().describe('Overall explanation of the fix'),
  confidence: z.number().min(0).max(1).describe('Confidence level in this fix (0-1)'),
});

export const AnalyzeRuntimeErrorArgsSchema = z.object({
  errorMessage: z.string().describe('The runtime error message'),
  stackTrace: z.string().optional().describe('Stack trace if available'),
  context: z.string().optional().describe('Additional context about when the error occurs'),
});

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
export function createInitialState(
  error: BuildError,
  projectPath: string,
  projectContext: string,
  buildOutput: string,
  targetVersion: string,
  options?: { maxIterations?: number; maxTokenBudget?: number }
): AgentState {
  return {
    originalError: error,
    projectPath,
    projectContext,
    buildOutput,
    targetVersion,
    
    phase: 'analyzing',
    iteration: 0,
    maxIterations: options?.maxIterations ?? 15,
    tokenUsage: 0,
    maxTokenBudget: options?.maxTokenBudget ?? 500000,
    
    investigationResults: [],
    filesRead: new Map(),
    searchResults: new Map(),
    
    diagnoses: [],
    relatedPackages: [],
    browserCompatibilityIssues: [],
    
    plannedFixes: [],
    currentFixIndex: 0,
    
    fixAttempts: [],
    appliedChanges: [],
    rollbackStack: [],
    
    success: false,
    finalChanges: [],
    reasoning: '',
    confidence: 0,
    suggestionsForUser: [],
    
    messages: [],
  };
}

/**
 * Browser-incompatible packages known to cause issues
 */
export const BROWSER_INCOMPATIBLE_PACKAGES = new Set([
  'whatwg-url',
  'node-fetch',
  'fs',
  'path',
  'crypto',
  'stream',
  'buffer',
  'util',
  'os',
  'child_process',
  'http',
  'https',
  'net',
  'tls',
  'dns',
  'dgram',
  'cluster',
  'readline',
  'repl',
  'vm',
  'v8',
  'worker_threads',
]);

/**
 * Common Angular upgrade issues patterns
 */
export const RUNTIME_ERROR_PATTERNS = [
  {
    pattern: /Cannot convert undefined or null to object/i,
    type: 'browser-compatibility' as IssueType,
    hint: 'Node.js-only package being used in browser context',
  },
  {
    pattern: /is not a function/i,
    type: 'deprecated-api' as IssueType,
    hint: 'API may have changed or been removed in newer version',
  },
  {
    pattern: /Cannot read propert(?:y|ies) of (?:undefined|null)/i,
    type: 'runtime-error' as IssueType,
    hint: 'Object or module not properly initialized',
  },
  {
    pattern: /Module not found|Cannot find module/i,
    type: 'missing-dependency' as IssueType,
    hint: 'Missing or incorrectly installed package',
  },
  {
    pattern: /getPrototypeOf|Object\.prototype/i,
    type: 'node-only-package' as IssueType,
    hint: 'Node.js-specific code running in browser',
  },
];
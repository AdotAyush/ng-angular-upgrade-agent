/**
 * Core configuration types
 */

export interface UpgradeConfig {
  projectPath: string;
  sourceAngularVersion: string;
  targetAngularVersion: string;
  llmApiKey: string;
  llmProvider?: 'bedrock' | 'gemini';
  llmModel?: string;
  awsRegion?: string;
  awsSecretKey?: string;
  geminiApiKey?: string;
  maxBuildAttempts?: number;
  dryRun?: boolean;
  /** Enable/disable response caching (default: true) */
  useCache?: boolean;
  /** Enable/disable agentic mode for complex errors (default: true) */
  useAgenticMode?: boolean;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  npmVersion: string;
  pnpmVersion?: string;
  angularCliVersion?: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: any;
}

export interface VersionConstraints {
  angular: string;
  typescript: string;
  rxjs: string;
  zoneJs: string;
  nodeMin: string;
}

export interface DependencyResolution {
  package: string;
  currentVersion: string;
  targetVersion: string;
  reason: string;
  conflicts?: string[];
}

export interface WorkspaceInfo {
  isWorkspace: boolean;
  projects: ProjectInfo[];
  rootPackageJson: PackageJson;
}

export interface ProjectInfo {
  name: string;
  path: string;
  type: 'application' | 'library';
  isInternal: boolean;
}

/**
 * Error classification types
 */

export enum ErrorCategory {
  COMPILATION = 'COMPILATION',
  TYPESCRIPT = 'TYPESCRIPT',
  TEMPLATE = 'TEMPLATE',
  IMPORT = 'IMPORT',
  DEPENDENCY = 'DEPENDENCY',
  ROUTER = 'ROUTER',
  RXJS = 'RXJS',
  STANDALONE = 'STANDALONE',
  SSR = 'SSR',
  UNKNOWN = 'UNKNOWN',
}

export interface BuildError {
  category: ErrorCategory;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  severity: 'error' | 'warning';
  stackTrace?: string;
}

export interface ErrorPattern {
  category: ErrorCategory;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<BuildError>;
}

/**
 * Code analysis types
 */

export interface CodeIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface AnalysisResult {
  issues: CodeIssue[];
  metadata: {
    hasStandaloneComponents: boolean;
    hasNgModules: boolean;
    usesRouter: boolean;
    usesSSR: boolean;
    rxjsUsage: string[];
  };
}

/**
 * Fix strategy types
 */

export interface FixStrategy {
  name: string;
  category: ErrorCategory;
  canHandle: (error: BuildError) => boolean;
  apply: (error: BuildError, context: FixContext) => Promise<FixResult>;
  isDeterministic: boolean;
}

export interface FixContext {
  projectPath: string;
  targetVersion: string;
  fileContent?: string;
  ast?: any;
  llmClient?: any; // LLMClient for AI-assisted fixes
}

export interface FixResult {
  success: boolean;
  changes?: FileChange[];
  error?: string;
  requiresManualIntervention?: boolean;
  suggestion?: string;
  reasoning?: string;
  confidence?: number;
}

export interface FileChange {
  file: string;
  type: 'modify' | 'create' | 'delete';
  diff?: string;
  content?: string;
  /** SEARCH/REPLACE blocks for targeted changes (preferred over full content) */
  searchReplace?: Array<{ search: string; replace: string }>;
  /** Flag indicating this is a full file replacement (legacy behavior, use with caution) */
  isFullFileReplacement?: boolean;
}

/**
 * LLM integration types
 */

export interface LLMRequest {
  type: 'refactor' | 'template-fix' | 'migration-reasoning';
  context: {
    error: BuildError;
    fileContent: string;
    targetVersion: string;
    constraints: string[];
  };
}

export interface LLMResponse {
  success: boolean;
  changes?: FileChange[];
  reasoning?: string;
  requiresVerification: boolean;
}

/**
 * Reporting types
 */

export interface ChangeLog {
  timestamp: Date;
  entries: ChangeLogEntry[];
}

export interface ChangeLogEntry {
  type: 'environment' | 'dependency' | 'code' | 'config';
  action: string;
  file?: string;
  before?: string;
  after?: string;
  reason: string;
  automated: boolean;
}

export interface UpgradeReport {
  success: boolean;
  startTime: Date;
  endTime: Date;
  sourceVersion: string;
  targetVersion: string;
  modifiedFiles: string[];
  unresolvedIssues: BuildError[];
  manualActions: string[];
  changeLog: ChangeLog;
  buildPassed: boolean;
  testsPassed: boolean;
}

/**
 * State management types
 */

export interface UpgradeState {
  phase: UpgradePhase;
  buildAttempts: number;
  lastBuildErrors: BuildError[];
  resolvedErrors: BuildError[];
  appliedFixes: FixResult[];
  rollbackPoints: RollbackPoint[];
}

export enum UpgradePhase {
  INIT = 'INIT',
  ENVIRONMENT_VALIDATION = 'ENVIRONMENT_VALIDATION',
  DEPENDENCY_RESOLUTION = 'DEPENDENCY_RESOLUTION',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  BUILD_FIX_LOOP = 'BUILD_FIX_LOOP',
  VERIFICATION = 'VERIFICATION',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

export interface RollbackPoint {
  phase: UpgradePhase;
  timestamp: Date;
  files: Map<string, string>;
}

/**
 * LangGraph-based Agentic LLM Client
 *
 * A sophisticated agent that uses LangGraph for state management,
 * structured tool execution, and multi-step reasoning to solve
 * complex Angular upgrade issues including:
 * - Build errors
 * - Runtime errors
 * - Browser compatibility issues
 * - Node.js-only package detection
 */
import { LLMClient } from './llm-client';
import { BuildError, FixResult } from '../types';
import { IssueDiagnosis } from './langgraph';
/**
 * Agentic LLM client configuration
 */
export interface AgenticConfig {
    maxIterations?: number;
    maxTokenBudget?: number;
    enableParallelTools?: boolean;
    verboseLogging?: boolean;
}
/**
 * LangGraph-powered Agentic LLM Client
 *
 * Provides intelligent, multi-step problem solving for Angular upgrades
 * with proper state management and structured tool execution.
 */
export declare class AgenticLLMClient {
    private llmClient;
    private projectPath;
    private config;
    constructor(llmClient: LLMClient, projectPath: string, config?: AgenticConfig);
    /**
     * Request fix using the LangGraph agent
     */
    requestFix(error: BuildError, projectContext: string, buildOutput: string): Promise<FixResult>;
    /**
     * Quick diagnosis for common runtime error patterns
     * This provides fast-track fixes for well-known issues
     */
    private quickDiagnose;
    /**
     * Find files that use a specific package
     */
    private findPackageUsages;
    /**
     * Generate a fast fix for high-confidence diagnoses
     */
    private generateFastFix;
    /**
     * Generate human-readable reasoning for a fix
     */
    private generateReasoning;
    /**
     * Analyze a runtime error directly (useful for console errors)
     */
    analyzeRuntimeError(errorMessage: string, stackTrace?: string): Promise<IssueDiagnosis | null>;
    /**
     * Check if a package is browser-compatible
     */
    checkBrowserCompatibility(packageName: string): Promise<{
        compatible: boolean;
        reason: string;
        alternative?: string;
    }>;
    /**
     * Get a summary of browser compatibility issues in the project
     */
    scanForBrowserIssues(): Promise<{
        issues: Array<{
            package: string;
            files: string[];
            suggestion: string;
        }>;
    }>;
}
//# sourceMappingURL=agentic-llm-client.d.ts.map
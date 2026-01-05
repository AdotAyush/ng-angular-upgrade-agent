/**
 * Unified LLM Client for Angular Upgrade Agent
 *
 * Supports only Bedrock and Gemini providers.
 * Uses LangGraph-based agentic approach for complex problem solving.
 */
import { LLMRequest, LLMResponse } from '../types';
/**
 * LLM Client Options
 */
export interface LLMClientOptions {
    model?: string;
    awsRegion?: string;
    awsSecretKey?: string;
    geminiApiKey?: string;
}
/**
 * Unified LLM Client
 *
 * Provides a consistent interface for interacting with Bedrock and Gemini LLMs.
 * Includes retry logic, request validation, and response parsing.
 */
export declare class LLMClient {
    private bedrockClient?;
    private geminiClient?;
    private provider;
    private retryConfig;
    constructor(apiKey: string, provider?: 'bedrock' | 'gemini', options?: LLMClientOptions);
    /**
     * Get the current provider
     */
    getProvider(): 'bedrock' | 'gemini';
    /**
     * Request a fix from the LLM
     */
    requestFix(request: LLMRequest): Promise<LLMResponse>;
    private requestFixInternal;
    private shouldUseLLM;
    /**
     * Analyze code for migration issues
     */
    analyzeCodeForMigration(code: string, fromVersion: string, toVersion: string): Promise<string[]>;
}
/**
 * LLM Request/Response Guardrails
 *
 * Validates requests and responses to ensure LLM usage stays within safe bounds.
 */
export declare class LLMGuardrails {
    static validateRequest(request: LLMRequest): {
        valid: boolean;
        reason?: string;
    };
    static validateResponse(response: LLMResponse): {
        valid: boolean;
        reason?: string;
    };
}
//# sourceMappingURL=llm-client.d.ts.map
import { LLMRequest, LLMResponse } from '../types/index.js';
export interface GeminiOptions {
    apiKey: string;
    model?: string;
}
/**
 * Google Gemini LLM Client
 * Supports Gemini Pro and Gemini Pro Vision models
 */
export declare class GeminiClient {
    private client;
    private model;
    private modelName;
    constructor(options: GeminiOptions);
    /**
     * Request a code fix from Gemini
     */
    requestFix(request: LLMRequest): Promise<LLMResponse>;
    /**
     * Extract SEARCH/REPLACE blocks from response
     */
    private extractSearchReplaceBlocks;
    /**
     * Build a prompt for Gemini
     */
    private buildPrompt;
    /**
     * Extract code context around the error line
     */
    private extractErrorContext;
    /**
     * Extract fixed code from Gemini response
     */
    private extractCodeFromResponse;
    /**
     * Extract explanation from Gemini response
     */
    private extractExplanationFromResponse;
    /**
     * Calculate confidence score based on response quality
     */
    private calculateConfidence;
    /**
     * Get available Gemini models
     */
    static getAvailableModels(): string[];
}
//# sourceMappingURL=gemini-client.d.ts.map
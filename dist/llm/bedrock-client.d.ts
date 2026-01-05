import { LLMRequest, LLMResponse } from '../types';
export declare class BedrockClient {
    private client;
    private modelId;
    private maxTokens;
    private temperature;
    constructor(accessKeyId: string, region?: string, modelId?: string, secretAccessKey?: string);
    private resolveModelId;
    requestFix(request: LLMRequest): Promise<LLMResponse>;
    private shouldUseLLM;
    /**
     * Sanitize text to prevent AWS SigV4 signing issues
     * Removes/replaces non-ASCII characters that can cause canonical request mismatches
     */
    private sanitizeForSigning;
    private buildPrompts;
    /**
     * Extract code context around the error line
     * Returns lines before and after the error with line numbers
     */
    private extractErrorContext;
    private parseResponse;
    private validateFix;
    analyzeCodeForMigration(code: string, fromVersion: string, toVersion: string): Promise<string[]>;
}
//# sourceMappingURL=bedrock-client.d.ts.map
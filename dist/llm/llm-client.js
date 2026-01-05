"use strict";
/**
 * Unified LLM Client for Angular Upgrade Agent
 *
 * Supports only Bedrock and Gemini providers.
 * Uses LangGraph-based agentic approach for complex problem solving.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMGuardrails = exports.LLMClient = void 0;
const bedrock_client_1 = require("./bedrock-client");
const gemini_client_1 = require("./gemini-client");
/**
 * Utility function to wait with exponential backoff
 */
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Execute function with exponential backoff retry
 */
async function withRetry(fn, config, isRetryable = () => true) {
    let lastError;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!isRetryable(error) || attempt === config.maxRetries) {
                throw error;
            }
            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, config.maxDelayMs);
            console.log(`    ⏳ API call failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${Math.round(delay)}ms...`);
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Check if an error is retryable (rate limit, timeout, server error)
 */
function isRetryableError(error) {
    if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
        return true;
    }
    if (error?.status >= 500 && error?.status < 600) {
        return true;
    }
    if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
        return true;
    }
    if (error?.name === 'ThrottlingException' || error?.name === 'ServiceUnavailableException') {
        return true;
    }
    if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        return true;
    }
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        return true;
    }
    return false;
}
/**
 * Unified LLM Client
 *
 * Provides a consistent interface for interacting with Bedrock and Gemini LLMs.
 * Includes retry logic, request validation, and response parsing.
 */
class LLMClient {
    bedrockClient;
    geminiClient;
    provider;
    retryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
    };
    constructor(apiKey, provider = 'gemini', options) {
        this.provider = provider;
        if (provider === 'bedrock') {
            this.bedrockClient = new bedrock_client_1.BedrockClient(apiKey, options?.awsRegion, options?.model, options?.awsSecretKey);
        }
        else if (provider === 'gemini') {
            this.geminiClient = new gemini_client_1.GeminiClient({
                apiKey: options?.geminiApiKey || apiKey,
                model: options?.model
            });
        }
    }
    /**
     * Get the current provider
     */
    getProvider() {
        return this.provider;
    }
    /**
     * Request a fix from the LLM
     */
    async requestFix(request) {
        // Validate request
        if (!this.shouldUseLLM(request)) {
            return {
                success: false,
                requiresVerification: true,
            };
        }
        return withRetry(() => this.requestFixInternal(request), this.retryConfig, isRetryableError);
    }
    async requestFixInternal(request) {
        if (this.provider === 'gemini' && this.geminiClient) {
            return await this.geminiClient.requestFix(request);
        }
        if (this.provider === 'bedrock' && this.bedrockClient) {
            return await this.bedrockClient.requestFix(request);
        }
        return {
            success: false,
            requiresVerification: true,
            reasoning: 'No LLM client configured',
        };
    }
    shouldUseLLM(request) {
        // Only use LLM for specific cases
        const allowedTypes = [
            'refactor',
            'template-fix',
            'migration-reasoning',
        ];
        return allowedTypes.includes(request.type);
    }
    /**
     * Analyze code for migration issues
     */
    async analyzeCodeForMigration(code, fromVersion, toVersion) {
        if (this.provider === 'gemini' && this.geminiClient) {
            // Use Gemini for analysis
            const request = {
                type: 'migration-reasoning',
                context: {
                    error: {
                        message: 'Analyze for migration',
                        file: 'analysis',
                        line: 0,
                        column: 0,
                        category: 'TYPESCRIPT',
                        severity: 'warning',
                        code: code
                    },
                    fileContent: code,
                    targetVersion: toVersion,
                    constraints: [`Migrating from ${fromVersion} to ${toVersion}`],
                }
            };
            const response = await this.geminiClient.requestFix(request);
            return response.reasoning ? [response.reasoning] : [];
        }
        if (this.provider === 'bedrock' && this.bedrockClient) {
            return await this.bedrockClient.analyzeCodeForMigration(code, fromVersion, toVersion);
        }
        return [];
    }
}
exports.LLMClient = LLMClient;
/**
 * LLM Request/Response Guardrails
 *
 * Validates requests and responses to ensure LLM usage stays within safe bounds.
 */
class LLMGuardrails {
    static validateRequest(request) {
        if (request.context.error.message.toLowerCase().includes('version')) {
            return { valid: false, reason: 'Cannot ask LLM about versions' };
        }
        if (!request.context.fileContent) {
            return { valid: false, reason: 'No file content provided' };
        }
        if (!request.context.constraints || request.context.constraints.length === 0) {
            return { valid: false, reason: 'No constraints provided' };
        }
        return { valid: true };
    }
    static validateResponse(response) {
        if (!response.success) {
            return { valid: true };
        }
        if (!response.changes || response.changes.length === 0) {
            return { valid: false, reason: 'No changes provided' };
        }
        for (const change of response.changes) {
            if (change.file.endsWith('package.json')) {
                return { valid: false, reason: 'Cannot modify package.json via LLM' };
            }
        }
        return { valid: true };
    }
}
exports.LLMGuardrails = LLMGuardrails;
//# sourceMappingURL=llm-client.js.map
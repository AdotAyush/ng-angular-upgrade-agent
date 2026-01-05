"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const generative_ai_1 = require("@google/generative-ai");
/**
 * Google Gemini LLM Client
 * Supports Gemini Pro and Gemini Pro Vision models
 */
class GeminiClient {
    client;
    model;
    modelName;
    constructor(options) {
        this.client = new generative_ai_1.GoogleGenerativeAI(options.apiKey);
        // Use gemini-1.5-flash or gemini-1.5-pro (not gemini-pro)
        this.modelName = options.model || 'gemini-1.5-flash';
        this.model = this.client.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192,
            },
        });
    }
    /**
     * Request a code fix from Gemini
     */
    async requestFix(request) {
        try {
            const prompt = this.buildPrompt(request);
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 4096,
                    topP: 0.8,
                    topK: 40,
                },
            });
            const response = result.response;
            const text = response.text();
            // Try to extract SEARCH/REPLACE blocks first (preferred)
            const searchReplaceBlocks = this.extractSearchReplaceBlocks(text);
            if (searchReplaceBlocks.length > 0) {
                return {
                    success: true,
                    changes: [{
                            file: request.context.error.file || '',
                            type: 'modify',
                            searchReplace: searchReplaceBlocks,
                        }],
                    reasoning: this.extractExplanationFromResponse(text),
                    requiresVerification: true,
                };
            }
            // Fallback to old code block extraction (legacy, may cause issues)
            const fixedCode = this.extractCodeFromResponse(text);
            if (!fixedCode) {
                return {
                    success: false,
                    reasoning: 'Could not extract SEARCH/REPLACE blocks or code from Gemini response',
                    requiresVerification: true,
                };
            }
            console.warn('⚠️ Gemini returned full code block instead of SEARCH/REPLACE. This may cause issues.');
            return {
                success: true,
                changes: [{
                        file: request.context.error.file || '',
                        type: 'modify',
                        content: fixedCode,
                        isFullFileReplacement: true,
                    }],
                reasoning: this.extractExplanationFromResponse(text),
                requiresVerification: true,
            };
        }
        catch (error) {
            return {
                success: false,
                reasoning: `Gemini API Error: ${error.message}`,
                requiresVerification: true,
            };
        }
    }
    /**
     * Extract SEARCH/REPLACE blocks from response
     */
    extractSearchReplaceBlocks(response) {
        const pattern = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
        const blocks = [];
        let match;
        while ((match = pattern.exec(response)) !== null) {
            blocks.push({
                search: match[1],
                replace: match[2],
            });
        }
        return blocks;
    }
    /**
     * Build a prompt for Gemini
     */
    buildPrompt(request) {
        const error = request.context.error;
        const errorContext = this.extractErrorContext(request.context.fileContent, error.line || 1, 30);
        return `You are an expert Angular developer helping to upgrade code to Angular ${request.context.targetVersion}.

**Error Details:**
${error.message}

**File:** ${error.file}
**Location:** Line ${error.line}, Column ${error.column}

**Code Context (around the error):**
\`\`\`typescript
${errorContext}
\`\`\`

**Additional Context:**
- Error Category: ${error.category}

**Instructions:**
1. Analyze the error and determine the root cause
2. Provide ONLY the minimal code changes needed to fix the error
3. Ensure the fix is compatible with Angular ${request.context.targetVersion}
4. Follow Angular best practices and style guidelines

**CRITICAL: Response Format:**
You MUST respond using SEARCH/REPLACE blocks. DO NOT output the entire file.

First provide a brief explanation, then provide the exact changes:

EXPLANATION:
[Your explanation of what caused the error and how to fix it]

<<<<<<< SEARCH
[exact code to find - must match the original code exactly]
=======
[corrected code to replace with]
>>>>>>> REPLACE

You can have multiple SEARCH/REPLACE blocks if needed.
The SEARCH block must match the original code EXACTLY (including whitespace and indentation).`;
    }
    /**
     * Extract code context around the error line
     */
    extractErrorContext(fileContent, errorLine, contextLines = 30) {
        if (!fileContent)
            return '[File content not available]';
        const lines = fileContent.split('\n');
        const startLine = Math.max(0, errorLine - contextLines - 1);
        const endLine = Math.min(lines.length, errorLine + contextLines);
        return lines
            .slice(startLine, endLine)
            .map((line, i) => {
            const lineNum = startLine + i + 1;
            const marker = lineNum === errorLine ? '>>> ' : '    ';
            return `${marker}${lineNum}: ${line}`;
        })
            .join('\n');
    }
    /**
     * Extract fixed code from Gemini response
     */
    extractCodeFromResponse(response) {
        // Try to find code between FIXED_CODE: and end or next section
        const fixedCodeMatch = response.match(/FIXED_CODE:\s*```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/i);
        if (fixedCodeMatch) {
            return fixedCodeMatch[1].trim();
        }
        // Fallback: extract any code block
        const codeBlockMatch = response.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        return undefined;
    }
    /**
     * Extract explanation from Gemini response
     */
    extractExplanationFromResponse(response) {
        const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)(?=FIXED_CODE:|<<<<<<< SEARCH|$)/i);
        if (explanationMatch) {
            return explanationMatch[1].trim();
        }
        // Fallback: return first paragraph
        const firstParagraph = response.split('\n\n')[0];
        return firstParagraph.trim();
    }
    /**
     * Calculate confidence score based on response quality
     */
    calculateConfidence(response) {
        // Gemini doesn't provide direct confidence scores
        // Use safety ratings and finish reason as proxies
        const safetyRatings = response.candidates?.[0]?.safetyRatings || [];
        const finishReason = response.candidates?.[0]?.finishReason;
        // Start with base confidence
        let confidence = 0.85;
        // Reduce confidence if there are safety concerns
        const hasHighRiskRating = safetyRatings.some((rating) => rating.probability === 'HIGH' || rating.probability === 'MEDIUM');
        if (hasHighRiskRating) {
            confidence -= 0.2;
        }
        // Reduce confidence if generation was stopped early
        if (finishReason !== 'STOP') {
            confidence -= 0.3;
        }
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * Get available Gemini models
     */
    static getAvailableModels() {
        return [
            'gemini-pro', // Best for text-only prompts
            'gemini-pro-vision', // Supports both text and images
            'gemini-1.5-pro', // Latest version with improved capabilities
            'gemini-1.5-flash', // Faster, lighter model
        ];
    }
}
exports.GeminiClient = GeminiClient;
//# sourceMappingURL=gemini-client.js.map
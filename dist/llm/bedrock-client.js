"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockClient = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
class BedrockClient {
    client;
    modelId;
    maxTokens = 4000;
    temperature = 0.1;
    constructor(accessKeyId, region = 'us-east-1', modelId, secretAccessKey) {
        // Initialize BedrockRuntimeClient with explicit credentials or default credential chain
        const clientConfig = { region };
        // If access key is provided, require secret key
        if (accessKeyId && secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }
        else if (accessKeyId && !secretAccessKey) {
            // Try environment variables as fallback
            const envSecret = process.env.AWS_SECRET_ACCESS_KEY;
            if (envSecret) {
                console.warn('⚠️  Using AWS_SECRET_ACCESS_KEY from environment variable');
                clientConfig.credentials = {
                    accessKeyId,
                    secretAccessKey: envSecret,
                };
            }
            else {
                throw new Error('AWS Secret Access Key is required. Provide via --aws-secret-key or set AWS_SECRET_ACCESS_KEY environment variable');
            }
        }
        // else: Use AWS default credential chain (IAM role, ~/.aws/credentials, etc.)
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient(clientConfig);
        // Map common model IDs to their inference profile ARNs
        // For newer models like Claude Sonnet 4.5, AWS requires inference profile ARNs
        this.modelId = this.resolveModelId(modelId, region);
    }
    resolveModelId(modelId, region) {
        // Default to Claude 3.5 Sonnet if not specified
        const requestedModel = modelId || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
        // Map of model IDs to their inference profile ARNs
        // For cross-region inference profiles, use full ARN format to avoid URL encoding issues
        const inferenceProfiles = {
            // Claude Sonnet 4.5 (Dec 2024) - requires cross-region inference profile ARN
            'anthropic.claude-sonnet-4-5-20250929-v1:0': `arn:aws:bedrock:${region}::inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
            'claude-sonnet-4.5': `arn:aws:bedrock:${region}::inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
            'us.anthropic.claude-sonnet-4-5-20250929-v1:0': `arn:aws:bedrock:${region}::inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
            // Claude 3.5 Sonnet v2 (Oct 2024) - supports direct invocation
            'anthropic.claude-3-5-sonnet-20241022-v2:0': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            'claude-3.5-sonnet-v2': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            // Older Claude models - support direct invocation
            'anthropic.claude-3-5-sonnet-20240620-v1:0': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            'anthropic.claude-3-sonnet-20240229-v1:0': 'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-v2': 'anthropic.claude-v2',
            'anthropic.claude-v2:1': 'anthropic.claude-v2:1',
        };
        // Check if we have a mapping for this model
        if (inferenceProfiles[requestedModel]) {
            const resolvedId = inferenceProfiles[requestedModel];
            if (resolvedId.includes('inference-profile')) {
                console.log(`🔄 Auto-resolving to cross-region inference profile ARN: ${resolvedId}`);
            }
            return resolvedId;
        }
        // If it's already an ARN, use it as-is
        if (requestedModel.startsWith('arn:aws:bedrock:')) {
            return requestedModel;
        }
        // For cross-region inference profile IDs (us.*, eu.*), convert to full ARN
        // This avoids URL encoding issues with the colon in model IDs
        if (requestedModel.startsWith('us.') || requestedModel.startsWith('eu.')) {
            const inferenceProfileArn = `arn:aws:bedrock:${region}::inference-profile/${requestedModel}`;
            console.log(`🔄 Converting to inference profile ARN: ${inferenceProfileArn}`);
            return inferenceProfileArn;
        }
        // For unknown models, try direct invocation (will fail if inference profile required)
        console.warn(`⚠️  Unknown model "${requestedModel}" - attempting direct invocation. If this fails, provide the inference profile ID.`);
        return requestedModel;
    }
    async requestFix(request) {
        if (!this.shouldUseLLM(request)) {
            return {
                success: false,
                requiresVerification: true,
            };
        }
        try {
            const { systemPrompt, userPrompt } = this.buildPrompts(request);
            // Use Converse API - handles all model formats automatically
            const command = new client_bedrock_runtime_1.ConverseCommand({
                modelId: this.modelId,
                messages: [
                    {
                        role: 'user',
                        content: [{ text: userPrompt }],
                    },
                ],
                system: [{ text: systemPrompt }],
                inferenceConfig: {
                    maxTokens: this.maxTokens,
                    temperature: this.temperature,
                },
            });
            const response = await this.client.send(command);
            // Extract text from response
            const content = response.output?.message?.content?.[0]?.text;
            if (!content) {
                return {
                    success: false,
                    requiresVerification: true,
                };
            }
            return this.parseResponse(content, request);
        }
        catch (error) {
            console.error('Bedrock error:', error);
            return {
                success: false,
                requiresVerification: true,
            };
        }
    }
    shouldUseLLM(request) {
        const allowedTypes = [
            'refactor',
            'template-fix',
            'migration-reasoning',
        ];
        return allowedTypes.includes(request.type);
    }
    /**
     * Sanitize text to prevent AWS SigV4 signing issues
     * Removes/replaces non-ASCII characters that can cause canonical request mismatches
     */
    sanitizeForSigning(text) {
        return text
            // Replace common problematic Unicode characters with ASCII equivalents
            .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
            .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
            .replace(/[\u2013\u2014]/g, '-') // En/em dashes
            .replace(/\u2026/g, '...') // Ellipsis
            .replace(/[\u00A0]/g, ' ') // Non-breaking space
            // Remove any remaining non-ASCII characters
            .replace(/[^\x00-\x7F]/g, '');
    }
    buildPrompts(request) {
        const { error, fileContent, targetVersion, constraints } = request.context;
        // Extract context around the error line (not the whole file)
        const errorContext = this.extractErrorContext(fileContent, error.line || 1, 30);
        // Sanitize all user-provided content to prevent SigV4 signing issues
        const sanitizedErrorMessage = this.sanitizeForSigning(error.message || '');
        const sanitizedErrorFile = this.sanitizeForSigning(error.file || 'unknown');
        const sanitizedContext = this.sanitizeForSigning(errorContext);
        const sanitizedConstraints = constraints.map(c => this.sanitizeForSigning(c));
        const systemPrompt = `You are an expert Angular migration assistant.

CRITICAL RULES:
1. NEVER guess or hallucinate dependency versions
2. ONLY refactor code or fix templates
3. Make minimal, surgical changes - replace ONLY what needs to change
4. Preserve all existing functionality
5. Output ONLY the SEARCH and REPLACE blocks as shown below
6. NO explanations outside the blocks
7. Changes must be verifiable by compilation

IMPORTANT: You MUST use SEARCH/REPLACE format. DO NOT output entire file content.

Response format:
<<<<<<< SEARCH
[exact code to find - must match the file exactly]
=======
[corrected code to replace with]
>>>>>>> REPLACE

You can have multiple SEARCH/REPLACE blocks if needed.
The SEARCH block must match the original code EXACTLY (including whitespace).
The REPLACE block is what will replace the SEARCH content.`;
        const userPrompt = `Fix this Angular ${targetVersion} migration error:

ERROR: ${sanitizedErrorMessage}
FILE: ${sanitizedErrorFile}
LINE: ${error.line || 'unknown'}

CODE CONTEXT (around the error):
\`\`\`
${sanitizedContext}
\`\`\`

CONSTRAINTS:
${sanitizedConstraints.join('\n')}

Provide SEARCH/REPLACE blocks to fix ONLY the problematic code. Do NOT rewrite the entire file.`;
        return { systemPrompt, userPrompt };
    }
    /**
     * Extract code context around the error line
     * Returns lines before and after the error with line numbers
     */
    extractErrorContext(fileContent, errorLine, contextLines = 30) {
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
    parseResponse(content, request) {
        // Extract SEARCH/REPLACE blocks
        const searchReplacePattern = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
        const matches = [];
        let match;
        while ((match = searchReplacePattern.exec(content)) !== null) {
            matches.push({
                search: match[1],
                replace: match[2],
            });
        }
        // Fallback: try old code block format for backward compatibility
        if (matches.length === 0) {
            const codeBlockMatch = content.match(/```(?:typescript|html|ts)?\n([\s\S]+?)\n```/);
            if (codeBlockMatch) {
                // Old format - but warn about it
                console.warn('⚠️ LLM returned full code block instead of SEARCH/REPLACE. This may cause issues.');
                const fixedCode = codeBlockMatch[1];
                if (this.validateFix(fixedCode, request)) {
                    return {
                        success: true,
                        changes: [{
                                file: request.context.error.file || '',
                                type: 'modify',
                                content: fixedCode,
                                // Mark as full-file replacement (legacy behavior)
                                isFullFileReplacement: true,
                            }],
                        reasoning: 'LLM-generated fix (Bedrock) - LEGACY FULL FILE',
                        requiresVerification: true,
                    };
                }
            }
            return {
                success: false,
                reasoning: 'No SEARCH/REPLACE blocks found in response',
                requiresVerification: true,
            };
        }
        // Validate all replacements
        for (const { search, replace } of matches) {
            if (!this.validateFix(replace, request)) {
                return {
                    success: false,
                    reasoning: 'One or more replacements failed validation',
                    requiresVerification: true,
                };
            }
        }
        const changes = [{
                file: request.context.error.file || '',
                type: 'modify',
                searchReplace: matches,
            }];
        return {
            success: true,
            changes,
            reasoning: `LLM-generated fix (Bedrock) - ${matches.length} replacement(s)`,
            requiresVerification: true,
        };
    }
    validateFix(fixedCode, request) {
        // 1. No version numbers (to prevent hallucination)
        if (fixedCode.match(/["']@angular\/[^"']+["']:\s*["']\d+\.\d+/)) {
            return false;
        }
        // 2. No package.json modifications
        if (fixedCode.includes('dependencies') && fixedCode.includes('{')) {
            return false;
        }
        // 3. Must contain actual code
        if (fixedCode.trim().length < 10) {
            return false;
        }
        // 4. Should not contain explanatory text
        if (fixedCode.toLowerCase().includes('explanation:') ||
            fixedCode.toLowerCase().includes('note:')) {
            return false;
        }
        return true;
    }
    async analyzeCodeForMigration(code, fromVersion, toVersion) {
        try {
            // Sanitize code to prevent SigV4 signing issues
            const sanitizedCode = this.sanitizeForSigning(code.substring(0, 1500));
            const systemPrompt = 'You are an Angular migration expert. List potential issues when upgrading Angular.';
            const userPrompt = `Analyze this code for migration from Angular ${fromVersion} to ${toVersion}:\n\n${sanitizedCode}`;
            const command = new client_bedrock_runtime_1.ConverseCommand({
                modelId: this.modelId,
                messages: [
                    {
                        role: 'user',
                        content: [{ text: userPrompt }],
                    },
                ],
                system: [{ text: systemPrompt }],
                inferenceConfig: {
                    maxTokens: 2000,
                    temperature: 0.1,
                },
            });
            const response = await this.client.send(command);
            const content = response.output?.message?.content?.[0]?.text || '';
            return content.split('\n').filter((line) => line.trim().length > 0);
        }
        catch (error) {
            return [];
        }
    }
}
exports.BedrockClient = BedrockClient;
//# sourceMappingURL=bedrock-client.js.map
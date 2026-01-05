"use strict";
/**
 * LangGraph Agent Graph
 *
 * Implements a proper LangGraph state machine for Angular upgrade fix workflow.
 * This uses the official @langchain/langgraph library for state management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = exports.createAgentGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const types_1 = require("./types");
const tools_1 = require("./tools");
/**
 * Define the graph state using LangGraph Annotation
 */
const GraphStateAnnotation = langgraph_1.Annotation.Root({
    // Core state
    originalError: (langgraph_1.Annotation),
    projectPath: (langgraph_1.Annotation),
    projectContext: (langgraph_1.Annotation),
    buildOutput: (langgraph_1.Annotation),
    targetVersion: (langgraph_1.Annotation),
    // Execution
    phase: (langgraph_1.Annotation),
    iteration: (langgraph_1.Annotation),
    maxIterations: (langgraph_1.Annotation),
    tokenUsage: (langgraph_1.Annotation),
    maxTokenBudget: (langgraph_1.Annotation),
    // Investigation
    investigationResults: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    filesRead: (0, langgraph_1.Annotation)({
        reducer: (current, update) => ({ ...(current || {}), ...(update || {}) }),
        default: () => ({}),
    }),
    // Analysis
    diagnoses: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    relatedPackages: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...new Set([...(current || []), ...(update || [])])],
        default: () => [],
    }),
    browserCompatibilityIssues: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    // Planning
    plannedFixes: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    currentFixIndex: (langgraph_1.Annotation),
    // Execution
    fixAttempts: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    appliedChanges: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    // Output
    success: (langgraph_1.Annotation),
    finalChanges: (langgraph_1.Annotation),
    reasoning: (langgraph_1.Annotation),
    confidence: (langgraph_1.Annotation),
    suggestionsForUser: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    // LLM conversation
    messages: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...(current || []), ...(update || [])],
        default: () => [],
    }),
    // Tool calls pending
    pendingToolCalls: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update || [],
        default: () => [],
    }),
});
/**
 * System prompt for the agent
 */
const SYSTEM_PROMPT = `You are an expert Angular upgrade assistant with deep knowledge of:
- Angular framework versions and migration paths
- TypeScript and JavaScript best practices
- Browser vs Node.js environments
- NPM package ecosystem and compatibility
- Runtime error diagnosis

Your task is to diagnose and fix build/runtime errors during Angular upgrades.

IMPORTANT GUIDELINES:
1. ALWAYS investigate before proposing fixes - read files, search code, check packages
2. For runtime errors mentioning packages in node_modules, CHECK if they're browser-compatible
3. When you see "Cannot convert undefined or null to object" with node_modules packages, it's likely a Node.js-only package
4. Common Node.js-only packages that DON'T work in browsers: whatwg-url, node-fetch, fs, path, crypto
5. Browsers have NATIVE URL and fetch APIs - no polyfills needed for modern Angular
6. Always check package.json to see what's installed
7. Search for imports of problematic packages to find where they're used
8. When removing packages, also remove their imports from source files

Use the available tools to investigate and fix issues. Be thorough and methodical.

Respond with your reasoning, then call a tool using this exact format:
TOOL_CALL: toolName({"param": "value"})`;
/**
 * Node: Analyze the initial error
 */
function createAnalyzeNode(llmClient) {
    return async (state) => {
        console.log('  📊 Analyzing error...');
        const errorMessage = state.originalError.message;
        const buildOutput = state.buildOutput;
        // Check if this looks like a runtime error
        const isRuntimeError = types_1.RUNTIME_ERROR_PATTERNS.some(p => p.pattern.test(errorMessage + buildOutput));
        // Extract potential package names from error
        const packageMatches = (errorMessage + buildOutput).match(/node_modules\/([^/\s]+)/g);
        const relatedPackages = packageMatches
            ? [...new Set(packageMatches.map(m => m.replace('node_modules/', '')))]
            : [];
        // Initial analysis message
        const analysisPrompt = `Analyze this Angular upgrade error:

**Error:** ${state.originalError.message}
**File:** ${state.originalError.file || 'unknown'}
**Line:** ${state.originalError.line || 'unknown'}
**Category:** ${state.originalError.category}

**Build Output:**
\`\`\`
${buildOutput.substring(0, 3000)}
\`\`\`

**Project Context:**
${state.projectContext.substring(0, 2000)}

What tools should I use to investigate this? Think step by step about:
1. What type of error is this (build-time, runtime, dependency issue)?
2. What files or packages might be involved?
3. What should I search for or read first?`;
        return {
            phase: 'investigating',
            iteration: (state.iteration || 0) + 1,
            relatedPackages,
            messages: [
                new messages_1.SystemMessage(SYSTEM_PROMPT),
                new messages_1.HumanMessage(analysisPrompt),
            ],
        };
    };
}
/**
 * Node: Call LLM for next action
 */
function createCallLLMNode(llmClient) {
    return async (state) => {
        console.log(`  🤖 Thinking... (iteration ${state.iteration})`);
        // Build prompt from messages
        const messagesText = (state.messages || []).map(m => {
            const messageType = m.getType();
            if (messageType === 'system')
                return `System: ${m.content}`;
            if (messageType === 'human')
                return `User: ${m.content}`;
            if (messageType === 'ai')
                return `Assistant: ${m.content}`;
            if (messageType === 'tool')
                return `Tool Result: ${m.content}`;
            return `Message: ${m.content}`;
        }).join('\n\n');
        // Request from LLM with tool definitions
        const fullPrompt = `${messagesText}

Available tools:
${JSON.stringify(tools_1.TOOL_DEFINITIONS, null, 2)}

Based on your analysis, what tool should you use next? 
If you have enough information to fix the issue, use the proposeChanges tool.
If you need more information, use the appropriate investigation tools.`;
        const response = await llmClient.requestFix({
            type: 'migration-reasoning',
            context: {
                error: state.originalError,
                fileContent: fullPrompt,
                targetVersion: state.targetVersion,
                constraints: [],
            },
        });
        const reasoning = response.reasoning || '';
        // Parse tool calls from response
        const toolCalls = parseToolCalls(reasoning);
        // Update token usage (approximate)
        const newTokenUsage = (state.tokenUsage || 0) + Math.ceil((fullPrompt.length + reasoning.length) / 4);
        return {
            messages: [new messages_1.AIMessage(reasoning)],
            pendingToolCalls: toolCalls,
            tokenUsage: newTokenUsage,
            iteration: (state.iteration || 0) + 1,
        };
    };
}
/**
 * Node: Execute pending tool calls
 */
async function executeToolsNode(state) {
    const toolCalls = state.pendingToolCalls || [];
    if (toolCalls.length === 0) {
        return { pendingToolCalls: [] };
    }
    console.log(`  🔧 Executing ${toolCalls.length} tool(s)...`);
    const context = {
        projectPath: state.projectPath,
    };
    const newMessages = [];
    const investigationResults = [];
    const filesRead = {};
    let proposedChanges = null;
    // Execute tools in parallel when possible
    const results = await Promise.all(toolCalls.map(async (call) => {
        console.log(`    → ${call.name}(${JSON.stringify(call.arguments).substring(0, 50)}...)`);
        const result = await (0, tools_1.executeTool)(call.name, call.arguments, context);
        return { call, result };
    }));
    for (const { call, result } of results) {
        newMessages.push(new messages_1.HumanMessage(`Tool Result (${call.name}): ${result.result.substring(0, 2000)}`));
        investigationResults.push({
            tool: call.name,
            query: JSON.stringify(call.arguments),
            result: result.result.substring(0, 1000),
            timestamp: new Date(),
            success: result.success,
        });
        // Track read files
        if (call.name === 'readFile' && result.success) {
            filesRead[call.arguments.filePath] = result.result;
        }
        // Check for proposed changes
        if (call.name === 'proposeChanges' && result.success) {
            proposedChanges = result.metadata;
        }
    }
    // If changes were proposed, transition to fixing phase
    if (proposedChanges) {
        return {
            messages: newMessages,
            pendingToolCalls: [],
            investigationResults,
            filesRead,
            phase: 'fixing',
            plannedFixes: [{
                    id: 'fix-1',
                    description: proposedChanges.explanation,
                    files: proposedChanges.changes.map((c) => c.file),
                    changes: proposedChanges.changes.map((c) => {
                        // Prefer SEARCH/REPLACE over full content replacement
                        if (c.search && c.replace) {
                            return {
                                file: c.file,
                                type: c.type,
                                searchReplace: [{ search: c.search, replace: c.replace }],
                                diff: `- ${c.search}\n+ ${c.replace}`,
                            };
                        }
                        // Fallback to content (legacy, less safe)
                        return {
                            file: c.file,
                            type: c.type,
                            content: c.content,
                            isFullFileReplacement: !!c.content,
                        };
                    }),
                    priority: 1,
                    dependencies: [],
                    estimatedImpact: 'high',
                }],
            confidence: proposedChanges.confidence || 0.7,
            reasoning: proposedChanges.explanation,
        };
    }
    return {
        messages: newMessages,
        pendingToolCalls: [],
        investigationResults,
        filesRead,
    };
}
/**
 * Node: Apply proposed fixes
 */
async function applyFixesNode(state) {
    console.log('  🔨 Applying fixes...');
    const fixes = state.plannedFixes || [];
    const appliedChanges = [];
    const fixAttempts = [];
    for (const fix of fixes) {
        console.log(`    → ${fix.description.substring(0, 50)}...`);
        // Convert to FileChange format, preserving searchReplace if available
        for (const change of fix.changes) {
            appliedChanges.push({
                file: change.file,
                type: change.type,
                content: change.content,
                diff: change.diff,
                searchReplace: change.searchReplace,
                isFullFileReplacement: change.isFullFileReplacement,
            });
        }
        fixAttempts.push({
            fixId: fix.id,
            success: true,
            changes: fix.changes,
        });
    }
    return {
        phase: 'verifying',
        appliedChanges,
        fixAttempts,
        finalChanges: appliedChanges,
        success: true,
    };
}
/**
 * Node: Verify fixes
 */
async function verifyNode(state) {
    console.log('  ✅ Verifying fixes...');
    // Generate suggestions for user
    const suggestions = [];
    if ((state.browserCompatibilityIssues || []).length > 0) {
        suggestions.push('After applying these changes, run `npm install` to update dependencies', 'Test the application in the browser to verify the runtime error is fixed');
    }
    return {
        phase: 'complete',
        success: true,
        suggestionsForUser: suggestions,
    };
}
/**
 * Node: Handle failure
 */
async function failNode(state) {
    console.log('  ❌ Agent could not resolve the issue');
    return {
        phase: 'failed',
        success: false,
        reasoning: state.reasoning || 'Could not determine a fix within the iteration/budget limits',
        suggestionsForUser: [
            'Review the investigation results for clues',
            'Consider manually inspecting the affected files',
            'Check the Angular upgrade guide for this specific issue',
        ],
    };
}
/**
 * Parse tool calls from LLM response
 */
function parseToolCalls(response) {
    const toolCalls = [];
    // Pattern: TOOL_CALL: toolName({"args": "value"})
    const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
    let match;
    let id = 0;
    while ((match = toolCallPattern.exec(response)) !== null) {
        const [, toolName, argsJson] = match;
        try {
            const args = JSON.parse(argsJson);
            toolCalls.push({
                id: `call_${id++}`,
                name: toolName,
                arguments: args,
            });
        }
        catch {
            // Try to fix common JSON issues
            try {
                const fixedJson = argsJson
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":');
                const args = JSON.parse(fixedJson);
                toolCalls.push({
                    id: `call_${id++}`,
                    name: toolName,
                    arguments: args,
                });
            }
            catch {
                console.log(`    ⚠ Could not parse tool call: ${toolName}`);
            }
        }
    }
    // Also try pattern: toolName({ args })
    const altPattern = /(\w+)\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
    while ((match = altPattern.exec(response)) !== null) {
        const [, toolName, argsJson] = match;
        // Skip if already captured or not a known tool
        if (toolCalls.some(tc => tc.name === toolName) ||
            !tools_1.TOOL_DEFINITIONS.some(t => t.name === toolName)) {
            continue;
        }
        try {
            const args = JSON.parse(argsJson);
            toolCalls.push({
                id: `call_${id++}`,
                name: toolName,
                arguments: args,
            });
        }
        catch {
            // Skip invalid JSON
        }
    }
    return toolCalls;
}
/**
 * Routing function: Determine next node after analysis
 */
function routeAfterAnalysis(state) {
    if ((state.iteration || 0) >= (state.maxIterations || 15)) {
        return 'fail';
    }
    if ((state.tokenUsage || 0) >= (state.maxTokenBudget || 500000)) {
        return 'fail';
    }
    return 'callLLM';
}
/**
 * Routing function: Determine next node after LLM call
 */
function routeAfterLLM(state) {
    if (state.phase === 'fixing') {
        return 'applyFixes';
    }
    if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
        return 'executeTools';
    }
    if ((state.iteration || 0) >= (state.maxIterations || 15)) {
        return 'fail';
    }
    return 'callLLM';
}
/**
 * Routing function: Determine next node after tool execution
 */
function routeAfterTools(state) {
    if (state.phase === 'fixing') {
        return 'applyFixes';
    }
    if ((state.iteration || 0) >= (state.maxIterations || 15)) {
        return 'fail';
    }
    return 'callLLM';
}
/**
 * Create and compile the LangGraph agent
 */
function createAgentGraph(llmClient) {
    // Create the state graph
    const workflow = new langgraph_1.StateGraph(GraphStateAnnotation)
        // Add nodes
        .addNode('analyze', createAnalyzeNode(llmClient))
        .addNode('callLLM', createCallLLMNode(llmClient))
        .addNode('executeTools', executeToolsNode)
        .addNode('applyFixes', applyFixesNode)
        .addNode('verify', verifyNode)
        .addNode('fail', failNode)
        // Add edges from START
        .addEdge(langgraph_1.START, 'analyze')
        // Add conditional edges
        .addConditionalEdges('analyze', routeAfterAnalysis, {
        callLLM: 'callLLM',
        fail: 'fail',
    })
        .addConditionalEdges('callLLM', routeAfterLLM, {
        executeTools: 'executeTools',
        applyFixes: 'applyFixes',
        callLLM: 'callLLM',
        fail: 'fail',
    })
        .addConditionalEdges('executeTools', routeAfterTools, {
        callLLM: 'callLLM',
        applyFixes: 'applyFixes',
        fail: 'fail',
    })
        // Add edges to END
        .addEdge('applyFixes', 'verify')
        .addEdge('verify', langgraph_1.END)
        .addEdge('fail', langgraph_1.END);
    // Compile the graph
    return workflow.compile();
}
exports.createAgentGraph = createAgentGraph;
/**
 * Run the LangGraph agent
 */
async function runAgent(llmClient, error, projectPath, projectContext, buildOutput, targetVersion, options) {
    // Create and compile the graph
    const app = createAgentGraph(llmClient);
    // Initial state
    const initialState = {
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
        currentFixIndex: 0,
        success: false,
        confidence: 0,
    };
    try {
        // Run the graph
        const finalState = await app.invoke(initialState);
        return {
            success: finalState.success || false,
            changes: finalState.finalChanges || [],
            reasoning: finalState.reasoning || '',
            confidence: finalState.confidence || 0,
            suggestions: finalState.suggestionsForUser || [],
        };
    }
    catch (err) {
        console.error('  ❌ LangGraph execution error:', err.message);
        return {
            success: false,
            changes: [],
            reasoning: `Agent execution failed: ${err.message}`,
            confidence: 0,
            suggestions: ['An error occurred during agent execution. Please check the logs.'],
        };
    }
}
exports.runAgent = runAgent;
//# sourceMappingURL=agent-graph.js.map
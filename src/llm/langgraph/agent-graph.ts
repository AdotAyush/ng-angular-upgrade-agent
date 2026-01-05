/**
 * LangGraph Agent Graph
 * 
 * Implements a proper LangGraph state machine for Angular upgrade fix workflow.
 * This uses the official @langchain/langgraph library for state management.
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import {
  AgentState,
  AgentPhase,
  IssueDiagnosis,
  PlannedFix,
  FixAttemptResult,
  InvestigationResult,
  IssueType,
  RUNTIME_ERROR_PATTERNS,
} from './types';
import {
  executeTool,
  TOOL_DEFINITIONS,
  ToolContext,
} from './tools';
import { BuildError, FileChange } from '../../types';
import { LLMClient } from '../llm-client';

/**
 * Define the graph state using LangGraph Annotation
 */
const GraphStateAnnotation = Annotation.Root({
  // Core state
  originalError: Annotation<BuildError>,
  projectPath: Annotation<string>,
  projectContext: Annotation<string>,
  buildOutput: Annotation<string>,
  targetVersion: Annotation<string>,
  
  // Execution
  phase: Annotation<AgentPhase>,
  iteration: Annotation<number>,
  maxIterations: Annotation<number>,
  tokenUsage: Annotation<number>,
  maxTokenBudget: Annotation<number>,
  
  // Investigation
  investigationResults: Annotation<InvestigationResult[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  filesRead: Annotation<Record<string, string>>({
    reducer: (current, update) => ({ ...(current || {}), ...(update || {}) }),
    default: () => ({}),
  }),
  
  // Analysis
  diagnoses: Annotation<IssueDiagnosis[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  relatedPackages: Annotation<string[]>({
    reducer: (current, update) => [...new Set([...(current || []), ...(update || [])])],
    default: () => [],
  }),
  browserCompatibilityIssues: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  
  // Planning
  plannedFixes: Annotation<PlannedFix[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  currentFixIndex: Annotation<number>,
  
  // Execution
  fixAttempts: Annotation<FixAttemptResult[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  appliedChanges: Annotation<FileChange[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  
  // Output
  success: Annotation<boolean>,
  finalChanges: Annotation<FileChange[]>,
  reasoning: Annotation<string>,
  confidence: Annotation<number>,
  suggestionsForUser: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  
  // LLM conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  
  // Tool calls pending
  pendingToolCalls: Annotation<Array<{ id: string; name: string; arguments: Record<string, unknown> }>>({
    reducer: (_, update) => update || [],
    default: () => [],
  }),
});

type GraphState = typeof GraphStateAnnotation.State;

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
function createAnalyzeNode(llmClient: LLMClient) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log('  📊 Analyzing error...');
    
    const errorMessage = state.originalError.message;
    const buildOutput = state.buildOutput;
    
    // Check if this looks like a runtime error
    const isRuntimeError = RUNTIME_ERROR_PATTERNS.some(p => p.pattern.test(errorMessage + buildOutput));
    
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
      phase: 'investigating' as AgentPhase,
      iteration: (state.iteration || 0) + 1,
      relatedPackages,
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(analysisPrompt),
      ],
    };
  };
}

/**
 * Node: Call LLM for next action
 */
function createCallLLMNode(llmClient: LLMClient) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`  🤖 Thinking... (iteration ${state.iteration})`);
    
    // Build prompt from messages
    const messagesText = (state.messages || []).map(m => {
      const messageType = m.getType();
      if (messageType === 'system') return `System: ${m.content}`;
      if (messageType === 'human') return `User: ${m.content}`;
      if (messageType === 'ai') return `Assistant: ${m.content}`;
      if (messageType === 'tool') return `Tool Result: ${m.content}`;
      return `Message: ${m.content}`;
    }).join('\n\n');

    // Request from LLM with tool definitions
    const fullPrompt = `${messagesText}

Available tools:
${JSON.stringify(TOOL_DEFINITIONS, null, 2)}

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
      messages: [new AIMessage(reasoning)],
      pendingToolCalls: toolCalls,
      tokenUsage: newTokenUsage,
      iteration: (state.iteration || 0) + 1,
    };
  };
}

/**
 * Node: Execute pending tool calls
 */
async function executeToolsNode(state: GraphState): Promise<Partial<GraphState>> {
  const toolCalls = state.pendingToolCalls || [];
  
  if (toolCalls.length === 0) {
    return { pendingToolCalls: [] };
  }

  console.log(`  🔧 Executing ${toolCalls.length} tool(s)...`);
  
  const context: ToolContext = {
    projectPath: state.projectPath,
  };

  const newMessages: BaseMessage[] = [];
  const investigationResults: InvestigationResult[] = [];
  const filesRead: Record<string, string> = {};
  let proposedChanges: any = null;

  // Execute tools in parallel when possible
  const results = await Promise.all(
    toolCalls.map(async (call) => {
      console.log(`    → ${call.name}(${JSON.stringify(call.arguments).substring(0, 50)}...)`);
      
      const result = await executeTool(call.name, call.arguments, context);
      
      return { call, result };
    })
  );

  for (const { call, result } of results) {
    newMessages.push(new HumanMessage(`Tool Result (${call.name}): ${result.result.substring(0, 2000)}`));

    investigationResults.push({
      tool: call.name,
      query: JSON.stringify(call.arguments),
      result: result.result.substring(0, 1000),
      timestamp: new Date(),
      success: result.success,
    });

    // Track read files
    if (call.name === 'readFile' && result.success) {
      filesRead[call.arguments.filePath as string] = result.result;
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
      phase: 'fixing' as AgentPhase,
      plannedFixes: [{
        id: 'fix-1',
        description: proposedChanges.explanation,
        files: proposedChanges.changes.map((c: any) => c.file),
        changes: proposedChanges.changes.map((c: any) => {
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
        estimatedImpact: 'high' as const,
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
async function applyFixesNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log('  🔨 Applying fixes...');
  
  const fixes = state.plannedFixes || [];
  const appliedChanges: FileChange[] = [];
  const fixAttempts: FixAttemptResult[] = [];

  for (const fix of fixes) {
    console.log(`    → ${fix.description.substring(0, 50)}...`);
    
    // Convert to FileChange format, preserving searchReplace if available
    for (const change of fix.changes) {
      appliedChanges.push({
        file: change.file,
        type: change.type as 'modify' | 'create' | 'delete',
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
    phase: 'verifying' as AgentPhase,
    appliedChanges,
    fixAttempts,
    finalChanges: appliedChanges,
    success: true,
  };
}

/**
 * Node: Verify fixes
 */
async function verifyNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log('  ✅ Verifying fixes...');
  
  // Generate suggestions for user
  const suggestions: string[] = [];
  
  if ((state.browserCompatibilityIssues || []).length > 0) {
    suggestions.push(
      'After applying these changes, run `npm install` to update dependencies',
      'Test the application in the browser to verify the runtime error is fixed'
    );
  }

  return {
    phase: 'complete' as AgentPhase,
    success: true,
    suggestionsForUser: suggestions,
  };
}

/**
 * Node: Handle failure
 */
async function failNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log('  ❌ Agent could not resolve the issue');
  
  return {
    phase: 'failed' as AgentPhase,
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
function parseToolCalls(response: string): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
  
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
    } catch {
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
      } catch {
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
        !TOOL_DEFINITIONS.some(t => t.name === toolName)) {
      continue;
    }
    try {
      const args = JSON.parse(argsJson);
      toolCalls.push({
        id: `call_${id++}`,
        name: toolName,
        arguments: args,
      });
    } catch {
      // Skip invalid JSON
    }
  }

  return toolCalls;
}

/**
 * Routing function: Determine next node after analysis
 */
function routeAfterAnalysis(state: GraphState): string {
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
function routeAfterLLM(state: GraphState): string {
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
function routeAfterTools(state: GraphState): string {
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
export function createAgentGraph(llmClient: LLMClient) {
  // Create the state graph
  const workflow = new StateGraph(GraphStateAnnotation)
    // Add nodes
    .addNode('analyze', createAnalyzeNode(llmClient))
    .addNode('callLLM', createCallLLMNode(llmClient))
    .addNode('executeTools', executeToolsNode)
    .addNode('applyFixes', applyFixesNode)
    .addNode('verify', verifyNode)
    .addNode('fail', failNode)
    
    // Add edges from START
    .addEdge(START, 'analyze')
    
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
    .addEdge('verify', END)
    .addEdge('fail', END);

  // Compile the graph
  return workflow.compile();
}

/**
 * Run the LangGraph agent
 */
export async function runAgent(
  llmClient: LLMClient,
  error: BuildError,
  projectPath: string,
  projectContext: string,
  buildOutput: string,
  targetVersion: string,
  options?: { maxIterations?: number; maxTokenBudget?: number }
): Promise<{
  success: boolean;
  changes: FileChange[];
  reasoning: string;
  confidence: number;
  suggestions: string[];
}> {
  // Create and compile the graph
  const app = createAgentGraph(llmClient);
  
  // Initial state
  const initialState: Partial<GraphState> = {
    originalError: error,
    projectPath,
    projectContext,
    buildOutput,
    targetVersion,
    phase: 'analyzing' as AgentPhase,
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
  } catch (err: any) {
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

export type { GraphState };

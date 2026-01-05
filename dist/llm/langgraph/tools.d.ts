/**
 * LangGraph Agent Tools
 * Structured tool implementations with proper error handling
 */
import { ReadFileArgs, SearchCodeArgs, ListFilesArgs, RunCommandArgs, CheckPackageArgs, AnalyzeRuntimeErrorArgs } from './types';
/**
 * Tool execution context
 */
export interface ToolContext {
    projectPath: string;
    maxFileSize?: number;
    commandTimeout?: number;
}
/**
 * Base tool result
 */
export interface ToolExecutionResult {
    success: boolean;
    result: string;
    metadata?: Record<string, unknown>;
}
/**
 * Tool: Read file contents
 */
export declare function readFileTool(args: ReadFileArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: Search code patterns
 */
export declare function searchCodeTool(args: SearchCodeArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: List files in directory
 */
export declare function listFilesTool(args: ListFilesArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: Run shell command
 */
export declare function runCommandTool(args: RunCommandArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: Check package browser compatibility
 */
export declare function checkPackageTool(args: CheckPackageArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: Analyze runtime error
 */
export declare function analyzeRuntimeErrorTool(args: AnalyzeRuntimeErrorArgs, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool: Find usages of a package or import
 */
export declare function findUsagesTool(packageName: string, context: ToolContext): Promise<ToolExecutionResult>;
/**
 * Tool definitions for LangGraph
 */
export declare const TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            filePath: {
                type: string;
                description: string;
            };
            startLine: {
                type: string;
                description: string;
            };
            endLine: {
                type: string;
                description: string;
            };
            pattern?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            directory?: undefined;
            recursive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            pattern: {
                type: string;
                description: string;
            };
            filePattern: {
                type: string;
                description: string;
            };
            caseSensitive: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            directory?: undefined;
            recursive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            directory: {
                type: string;
                description: string;
            };
            recursive: {
                type: string;
                description: string;
            };
            pattern: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
            cwd: {
                type: string;
                description: string;
            };
            timeout: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            pattern?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            directory?: undefined;
            recursive?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            packageName: {
                type: string;
                description: string;
            };
            checkBrowserCompat: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            pattern?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            directory?: undefined;
            recursive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            errorMessage: {
                type: string;
                description: string;
            };
            stackTrace: {
                type: string;
                description: string;
            };
            context: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            pattern?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            directory?: undefined;
            recursive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            changes?: undefined;
            explanation?: undefined;
            confidence?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            changes: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        file: {
                            type: string;
                            description: string;
                        };
                        type: {
                            type: string;
                            enum: string[];
                        };
                        content: {
                            type: string;
                            description: string;
                        };
                        search: {
                            type: string;
                            description: string;
                        };
                        replace: {
                            type: string;
                            description: string;
                        };
                        reasoning: {
                            type: string;
                            description: string;
                        };
                    };
                    required: string[];
                };
            };
            explanation: {
                type: string;
                description: string;
            };
            confidence: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            pattern?: undefined;
            filePattern?: undefined;
            caseSensitive?: undefined;
            directory?: undefined;
            recursive?: undefined;
            command?: undefined;
            cwd?: undefined;
            timeout?: undefined;
            packageName?: undefined;
            checkBrowserCompat?: undefined;
            errorMessage?: undefined;
            stackTrace?: undefined;
            context?: undefined;
        };
        required: string[];
    };
})[];
/**
 * Execute a tool by name
 */
export declare function executeTool(toolName: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolExecutionResult>;
//# sourceMappingURL=tools.d.ts.map
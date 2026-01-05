/**
 * LangGraph Agent Graph
 *
 * Implements a proper LangGraph state machine for Angular upgrade fix workflow.
 * This uses the official @langchain/langgraph library for state management.
 */
import { BaseMessage } from '@langchain/core/messages';
import { AgentPhase, IssueDiagnosis, PlannedFix, FixAttemptResult, InvestigationResult } from './types';
import { BuildError, FileChange } from '../../types';
import { LLMClient } from '../llm-client';
/**
 * Define the graph state using LangGraph Annotation
 */
declare const GraphStateAnnotation: import("@langchain/langgraph").AnnotationRoot<{
    originalError: {
        (): import("@langchain/langgraph").LastValue<BuildError>;
        (annotation: import("@langchain/langgraph").SingleReducer<BuildError, BuildError>): import("@langchain/langgraph").BinaryOperatorAggregate<BuildError, BuildError>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectPath: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectContext: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    buildOutput: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    targetVersion: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    phase: {
        (): import("@langchain/langgraph").LastValue<AgentPhase>;
        (annotation: import("@langchain/langgraph").SingleReducer<AgentPhase, AgentPhase>): import("@langchain/langgraph").BinaryOperatorAggregate<AgentPhase, AgentPhase>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    iteration: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxIterations: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    tokenUsage: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxTokenBudget: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    investigationResults: import("@langchain/langgraph").BinaryOperatorAggregate<InvestigationResult[], InvestigationResult[]>;
    filesRead: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, string>, Record<string, string>>;
    diagnoses: import("@langchain/langgraph").BinaryOperatorAggregate<IssueDiagnosis[], IssueDiagnosis[]>;
    relatedPackages: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    browserCompatibilityIssues: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    plannedFixes: import("@langchain/langgraph").BinaryOperatorAggregate<PlannedFix[], PlannedFix[]>;
    currentFixIndex: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    fixAttempts: import("@langchain/langgraph").BinaryOperatorAggregate<FixAttemptResult[], FixAttemptResult[]>;
    appliedChanges: import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
    success: {
        (): import("@langchain/langgraph").LastValue<boolean>;
        (annotation: import("@langchain/langgraph").SingleReducer<boolean, boolean>): import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    finalChanges: {
        (): import("@langchain/langgraph").LastValue<FileChange[]>;
        (annotation: import("@langchain/langgraph").SingleReducer<FileChange[], FileChange[]>): import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    reasoning: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    confidence: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    suggestionsForUser: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    pendingToolCalls: import("@langchain/langgraph").BinaryOperatorAggregate<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[], {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[]>;
}>;
type GraphState = typeof GraphStateAnnotation.State;
/**
 * Create and compile the LangGraph agent
 */
export declare function createAgentGraph(llmClient: LLMClient): import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
    originalError: {
        (): import("@langchain/langgraph").LastValue<BuildError>;
        (annotation: import("@langchain/langgraph").SingleReducer<BuildError, BuildError>): import("@langchain/langgraph").BinaryOperatorAggregate<BuildError, BuildError>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectPath: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectContext: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    buildOutput: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    targetVersion: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    phase: {
        (): import("@langchain/langgraph").LastValue<AgentPhase>;
        (annotation: import("@langchain/langgraph").SingleReducer<AgentPhase, AgentPhase>): import("@langchain/langgraph").BinaryOperatorAggregate<AgentPhase, AgentPhase>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    iteration: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxIterations: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    tokenUsage: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxTokenBudget: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    investigationResults: import("@langchain/langgraph").BinaryOperatorAggregate<InvestigationResult[], InvestigationResult[]>;
    filesRead: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, string>, Record<string, string>>;
    diagnoses: import("@langchain/langgraph").BinaryOperatorAggregate<IssueDiagnosis[], IssueDiagnosis[]>;
    relatedPackages: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    browserCompatibilityIssues: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    plannedFixes: import("@langchain/langgraph").BinaryOperatorAggregate<PlannedFix[], PlannedFix[]>;
    currentFixIndex: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    fixAttempts: import("@langchain/langgraph").BinaryOperatorAggregate<FixAttemptResult[], FixAttemptResult[]>;
    appliedChanges: import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
    success: {
        (): import("@langchain/langgraph").LastValue<boolean>;
        (annotation: import("@langchain/langgraph").SingleReducer<boolean, boolean>): import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    finalChanges: {
        (): import("@langchain/langgraph").LastValue<FileChange[]>;
        (annotation: import("@langchain/langgraph").SingleReducer<FileChange[], FileChange[]>): import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    reasoning: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    confidence: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    suggestionsForUser: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    pendingToolCalls: import("@langchain/langgraph").BinaryOperatorAggregate<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[], {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[]>;
}>, import("@langchain/langgraph").UpdateType<{
    originalError: {
        (): import("@langchain/langgraph").LastValue<BuildError>;
        (annotation: import("@langchain/langgraph").SingleReducer<BuildError, BuildError>): import("@langchain/langgraph").BinaryOperatorAggregate<BuildError, BuildError>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectPath: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectContext: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    buildOutput: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    targetVersion: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    phase: {
        (): import("@langchain/langgraph").LastValue<AgentPhase>;
        (annotation: import("@langchain/langgraph").SingleReducer<AgentPhase, AgentPhase>): import("@langchain/langgraph").BinaryOperatorAggregate<AgentPhase, AgentPhase>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    iteration: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxIterations: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    tokenUsage: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxTokenBudget: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    investigationResults: import("@langchain/langgraph").BinaryOperatorAggregate<InvestigationResult[], InvestigationResult[]>;
    filesRead: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, string>, Record<string, string>>;
    diagnoses: import("@langchain/langgraph").BinaryOperatorAggregate<IssueDiagnosis[], IssueDiagnosis[]>;
    relatedPackages: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    browserCompatibilityIssues: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    plannedFixes: import("@langchain/langgraph").BinaryOperatorAggregate<PlannedFix[], PlannedFix[]>;
    currentFixIndex: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    fixAttempts: import("@langchain/langgraph").BinaryOperatorAggregate<FixAttemptResult[], FixAttemptResult[]>;
    appliedChanges: import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
    success: {
        (): import("@langchain/langgraph").LastValue<boolean>;
        (annotation: import("@langchain/langgraph").SingleReducer<boolean, boolean>): import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    finalChanges: {
        (): import("@langchain/langgraph").LastValue<FileChange[]>;
        (annotation: import("@langchain/langgraph").SingleReducer<FileChange[], FileChange[]>): import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    reasoning: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    confidence: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    suggestionsForUser: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    pendingToolCalls: import("@langchain/langgraph").BinaryOperatorAggregate<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[], {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[]>;
}>, "fail" | "callLLM" | "applyFixes" | "executeTools" | "__start__" | "analyze" | "verify", {
    originalError: {
        (): import("@langchain/langgraph").LastValue<BuildError>;
        (annotation: import("@langchain/langgraph").SingleReducer<BuildError, BuildError>): import("@langchain/langgraph").BinaryOperatorAggregate<BuildError, BuildError>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectPath: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectContext: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    buildOutput: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    targetVersion: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    phase: {
        (): import("@langchain/langgraph").LastValue<AgentPhase>;
        (annotation: import("@langchain/langgraph").SingleReducer<AgentPhase, AgentPhase>): import("@langchain/langgraph").BinaryOperatorAggregate<AgentPhase, AgentPhase>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    iteration: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxIterations: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    tokenUsage: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxTokenBudget: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    investigationResults: import("@langchain/langgraph").BinaryOperatorAggregate<InvestigationResult[], InvestigationResult[]>;
    filesRead: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, string>, Record<string, string>>;
    diagnoses: import("@langchain/langgraph").BinaryOperatorAggregate<IssueDiagnosis[], IssueDiagnosis[]>;
    relatedPackages: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    browserCompatibilityIssues: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    plannedFixes: import("@langchain/langgraph").BinaryOperatorAggregate<PlannedFix[], PlannedFix[]>;
    currentFixIndex: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    fixAttempts: import("@langchain/langgraph").BinaryOperatorAggregate<FixAttemptResult[], FixAttemptResult[]>;
    appliedChanges: import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
    success: {
        (): import("@langchain/langgraph").LastValue<boolean>;
        (annotation: import("@langchain/langgraph").SingleReducer<boolean, boolean>): import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    finalChanges: {
        (): import("@langchain/langgraph").LastValue<FileChange[]>;
        (annotation: import("@langchain/langgraph").SingleReducer<FileChange[], FileChange[]>): import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    reasoning: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    confidence: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    suggestionsForUser: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    pendingToolCalls: import("@langchain/langgraph").BinaryOperatorAggregate<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[], {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[]>;
}, {
    originalError: {
        (): import("@langchain/langgraph").LastValue<BuildError>;
        (annotation: import("@langchain/langgraph").SingleReducer<BuildError, BuildError>): import("@langchain/langgraph").BinaryOperatorAggregate<BuildError, BuildError>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectPath: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    projectContext: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    buildOutput: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    targetVersion: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    phase: {
        (): import("@langchain/langgraph").LastValue<AgentPhase>;
        (annotation: import("@langchain/langgraph").SingleReducer<AgentPhase, AgentPhase>): import("@langchain/langgraph").BinaryOperatorAggregate<AgentPhase, AgentPhase>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    iteration: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxIterations: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    tokenUsage: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    maxTokenBudget: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    investigationResults: import("@langchain/langgraph").BinaryOperatorAggregate<InvestigationResult[], InvestigationResult[]>;
    filesRead: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, string>, Record<string, string>>;
    diagnoses: import("@langchain/langgraph").BinaryOperatorAggregate<IssueDiagnosis[], IssueDiagnosis[]>;
    relatedPackages: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    browserCompatibilityIssues: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    plannedFixes: import("@langchain/langgraph").BinaryOperatorAggregate<PlannedFix[], PlannedFix[]>;
    currentFixIndex: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    fixAttempts: import("@langchain/langgraph").BinaryOperatorAggregate<FixAttemptResult[], FixAttemptResult[]>;
    appliedChanges: import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
    success: {
        (): import("@langchain/langgraph").LastValue<boolean>;
        (annotation: import("@langchain/langgraph").SingleReducer<boolean, boolean>): import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    finalChanges: {
        (): import("@langchain/langgraph").LastValue<FileChange[]>;
        (annotation: import("@langchain/langgraph").SingleReducer<FileChange[], FileChange[]>): import("@langchain/langgraph").BinaryOperatorAggregate<FileChange[], FileChange[]>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    reasoning: {
        (): import("@langchain/langgraph").LastValue<string>;
        (annotation: import("@langchain/langgraph").SingleReducer<string, string>): import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    confidence: {
        (): import("@langchain/langgraph").LastValue<number>;
        (annotation: import("@langchain/langgraph").SingleReducer<number, number>): import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    suggestionsForUser: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    pendingToolCalls: import("@langchain/langgraph").BinaryOperatorAggregate<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[], {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[]>;
}, import("@langchain/langgraph").StateDefinition>;
/**
 * Run the LangGraph agent
 */
export declare function runAgent(llmClient: LLMClient, error: BuildError, projectPath: string, projectContext: string, buildOutput: string, targetVersion: string, options?: {
    maxIterations?: number;
    maxTokenBudget?: number;
}): Promise<{
    success: boolean;
    changes: FileChange[];
    reasoning: string;
    confidence: number;
    suggestions: string[];
}>;
export type { GraphState };
//# sourceMappingURL=agent-graph.d.ts.map
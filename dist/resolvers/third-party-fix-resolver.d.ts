/**
 * Handles compatibility issues with third-party libraries (MobX, etc.)
 * that have TypeScript type definition conflicts with newer Angular/TypeScript versions
 */
export declare class ThirdPartyFixResolver {
    /**
     * Detect if project has MobX compatibility issues
     */
    detectMobXIssues(projectPath: string): Promise<boolean>;
    /**
     * Create TypeScript declaration overrides for MobX iterator compatibility
     */
    createMobXTypeOverrides(projectPath: string): Promise<void>;
    /**
     * Update tsconfig.json to include type overrides and skipLibCheck
     * Handles all tsconfig files in Angular projects (base, app, spec)
     */
    updateTsConfig(projectPath: string): Promise<boolean>;
    /**
     * Parse JSON with comments (Angular tsconfig files have comments)
     */
    private parseJsonWithComments;
    /**
     * Apply all MobX compatibility fixes
     */
    applyMobXFixes(projectPath: string): Promise<{
        applied: boolean;
        actions: string[];
    }>;
    /**
     * Check for other common third-party library issues
     */
    detectOtherThirdPartyIssues(projectPath: string): Promise<string[]>;
    /**
     * Generate a report of third-party compatibility recommendations
     */
    generateThirdPartyReport(projectPath: string): Promise<string>;
}
//# sourceMappingURL=third-party-fix-resolver.d.ts.map
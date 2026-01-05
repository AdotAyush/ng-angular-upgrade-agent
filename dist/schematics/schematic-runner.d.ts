/**
 * Runs Angular CLI's official ng update migrations
 * These handle most common Angular upgrade scenarios automatically
 */
export declare class AngularSchematicRunner {
    /**
     * Run Angular CLI and Core migrations
     * This executes the official Angular update schematics
     */
    runOfficialMigrations(projectPath: string, targetVersion: string): Promise<{
        success: boolean;
        output: string;
        migrationsRun: string[];
    }>;
    /**
     * Run additional common migrations
     */
    runCommonMigrations(projectPath: string, targetVersion: string): Promise<string[]>;
    /**
     * Extract migration details from output
     */
    extractMigrationInfo(output: string): {
        filesModified: string[];
        migrationsApplied: string[];
    };
}
//# sourceMappingURL=schematic-runner.d.ts.map
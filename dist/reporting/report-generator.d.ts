import { ChangeLog, ChangeLogEntry, UpgradeReport, BuildError } from '../types';
export declare class ReportGenerator {
    private changeLog;
    constructor();
    addEntry(entry: ChangeLogEntry): void;
    generateReport(sourceVersion: string, targetVersion: string, startTime: Date, endTime: Date, success: boolean, modifiedFiles: string[], unresolvedIssues: BuildError[], buildPassed: boolean, testsPassed: boolean): Promise<UpgradeReport>;
    private generateManualActions;
    saveReportToFile(report: UpgradeReport, outputPath: string): Promise<void>;
    private formatReport;
    getChangeLog(): ChangeLog;
}
//# sourceMappingURL=report-generator.d.ts.map
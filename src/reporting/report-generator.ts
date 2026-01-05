import * as fs from 'fs';
import { promisify } from 'util';
import { ChangeLog, ChangeLogEntry, UpgradeReport, BuildError } from '../types';

const writeFile = promisify(fs.writeFile);

export class ReportGenerator {
    private changeLog: ChangeLog;

    constructor() {
        this.changeLog = {
            timestamp: new Date(),
            entries: [],
        };
    }

    addEntry(entry: ChangeLogEntry): void {
        this.changeLog.entries.push(entry);
    }

    async generateReport(
        sourceVersion: string,
        targetVersion: string,
        startTime: Date,
        endTime: Date,
        success: boolean,
        modifiedFiles: string[],
        unresolvedIssues: BuildError[],
        buildPassed: boolean,
        testsPassed: boolean
    ): Promise<UpgradeReport> {
        const manualActions = this.generateManualActions(unresolvedIssues);

        const report: UpgradeReport = {
            success,
            startTime,
            endTime,
            sourceVersion,
            targetVersion,
            modifiedFiles,
            unresolvedIssues,
            manualActions,
            changeLog: this.changeLog,
            buildPassed,
            testsPassed,
        };

        return report;
    }

    private generateManualActions(unresolvedIssues: BuildError[]): string[] {
        const actions: string[] = [];

        for (const issue of unresolvedIssues) {
            if (issue.file) {
                actions.push(
                `Review ${issue.file}:${issue.line || '?'} - ${issue.message}`
                );
            } else {
                actions.push(`Address: ${issue.message}`);
            }
        }

        // Add general recommendations
        if (unresolvedIssues.length > 0) {
            actions.push('Run `ng build` to verify all changes');
            actions.push('Run `ng test` to ensure tests pass');
            actions.push('Review and update any third-party library usage');
        }

        return actions;
    }

    async saveReportToFile(report: UpgradeReport, outputPath: string): Promise<void> {
        const content = this.formatReport(report);
        await writeFile(outputPath, content, 'utf-8');
    }

    private formatReport(report: UpgradeReport): string {
        const duration = report.endTime.getTime() - report.startTime.getTime();
        const durationMin = Math.floor(duration / 60000);
        const durationSec = Math.floor((duration % 60000) / 1000);

        let output = `# Angular Upgrade Report\n\n`;
        output += `## Summary\n\n`;
        output += `- **Status**: ${report.success ? '✓ Success' : '✗ Failed'}\n`;
        output += `- **Source Version**: ${report.sourceVersion}\n`;
        output += `- **Target Version**: ${report.targetVersion}\n`;
        output += `- **Duration**: ${durationMin}m ${durationSec}s\n`;
        output += `- **Build Status**: ${report.buildPassed ? '✓ Passed' : '✗ Failed'}\n`;
        output += `- **Test Status**: ${report.testsPassed ? '✓ Passed' : '✗ Failed'}\n`;
        output += `\n`;

        output += `## Modified Files (${report.modifiedFiles.length})\n\n`;
        for (const file of report.modifiedFiles) {
            output += `- ${file}\n`;
        }
        output += `\n`;

        if (report.unresolvedIssues.length > 0) {
            output += `## Unresolved Issues (${report.unresolvedIssues.length})\n\n`;
            for (const issue of report.unresolvedIssues) {
                output += `### ${issue.category}\n`;
                output += `- **File**: ${issue.file || 'N/A'}\n`;
                output += `- **Line**: ${issue.line || 'N/A'}\n`;
                output += `- **Message**: ${issue.message}\n`;
                output += `\n`;
            }
        }

        if (report.manualActions.length > 0) {
            output += `## Manual Actions Required\n\n`;
            for (const action of report.manualActions) {
                output += `- [ ] ${action}\n`;
            }
            output += `\n`;
        }

        output += `## Change Log\n\n`;
        for (const entry of report.changeLog.entries) {
            output += `### ${entry.type.toUpperCase()}: ${entry.action}\n`;
            if (entry.file) {
                output += `- **File**: ${entry.file}\n`;
            }
            if (entry.before && entry.after) {
                output += `- **Before**: ${entry.before}\n`;
                output += `- **After**: ${entry.after}\n`;
            }
            output += `- **Reason**: ${entry.reason}\n`;
            output += `- **Automated**: ${entry.automated ? 'Yes' : 'No'}\n`;
            output += `\n`;
        }

        return output;
    }

    getChangeLog(): ChangeLog {
        return this.changeLog;
    }
}

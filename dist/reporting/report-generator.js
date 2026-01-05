"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs.writeFile);
class ReportGenerator {
    changeLog;
    constructor() {
        this.changeLog = {
            timestamp: new Date(),
            entries: [],
        };
    }
    addEntry(entry) {
        this.changeLog.entries.push(entry);
    }
    async generateReport(sourceVersion, targetVersion, startTime, endTime, success, modifiedFiles, unresolvedIssues, buildPassed, testsPassed) {
        const manualActions = this.generateManualActions(unresolvedIssues);
        const report = {
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
    generateManualActions(unresolvedIssues) {
        const actions = [];
        for (const issue of unresolvedIssues) {
            if (issue.file) {
                actions.push(`Review ${issue.file}:${issue.line || '?'} - ${issue.message}`);
            }
            else {
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
    async saveReportToFile(report, outputPath) {
        const content = this.formatReport(report);
        await writeFile(outputPath, content, 'utf-8');
    }
    formatReport(report) {
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
    getChangeLog() {
        return this.changeLog;
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=report-generator.js.map
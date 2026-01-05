import { patch } from "semver";

export class DiffGenerator {
    static generalUnifiedDiff(
        original: string,
        modified: string,
        filename: string
    ): string {
        const originalLines = original.split('\n');
        const modifiedLines = modified.split('\n');

        let diff = `--- ${filename}\n`;
        diff += `+++ ${filename}\n`;

        const changes = this.computeDiff(originalLines, modifiedLines);

        let lineNum = 0;

        for (const change of changes) {
            if (change.type === 'context'){
                diff += ` ${change.line}\n`;
                lineNum++;
            }else if (change.type === 'delete') {
                diff += `-${change.line}\n`;
            }else if (change.type === 'insert') {
                diff += `+${change.line}\n`;
            }
        }
        return diff;
    }

    private static computeDiff(
        original: string[],
        modified: string[]
    ): Array<{ type: 'context' | 'insert' | 'delete'; line: string }> {
        const changes: Array<{ type: 'context' | 'insert' | 'delete'; line: string }> = [];

        let i = 0, j = 0;

        while (i < original.length || j < modified.length) {
            if (i < original.length && j < modified.length && original[i] === modified[j]) {
                changes.push({ type: 'context', line: original[i] });
                i++;
                j++;
            } else if (j < modified.length && (i >= original.length || original[i] !== modified[j])) {
                changes.push({ type: 'insert', line: modified[j] });
                j++;
            } else if (i < original.length && (j >= modified.length || original[i] !== modified[j])) {
                changes.push({ type: 'delete', line: original[i] });
                i++;
            }
        }

        return changes;
    }

    static applyPatch(original: string, patch: string): string {
        const lines = original.split('\n');
        const patchLines = patch.split('\n').filter(line => line && !line.startsWith('-') && !line.startsWith('+'));

        const result: string[] = [];
        let originalIndex = 0;

        for (const line of patchLines) {
            const type = line[0];
            const content = line.substring(1);

            if (type === ' ') {
                result.push(lines[originalIndex]);
                originalIndex++;
            } else if (type === '-') {
                originalIndex++;
            } else if (type === '+') {
                result.push(content);
            }
        }

        return result.join('\n');
    }
}
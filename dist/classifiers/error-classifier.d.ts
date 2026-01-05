import { BuildError, ErrorCategory } from '../types';
export declare class ErrorClassifier {
    private patterns;
    classifyErrors(buildOutput: string): BuildError[];
    private isErrorLine;
    private classifyError;
    private deduplicateErrors;
    groupErrorsByCategory(errors: BuildError[]): Map<ErrorCategory, BuildError[]>;
}
//# sourceMappingURL=error-classifier.d.ts.map
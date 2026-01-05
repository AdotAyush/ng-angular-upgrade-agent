import { BuildError, ErrorCategory, FixStrategy, FixContext, FixResult } from '../types';
export declare class FixStrategyRegistry {
    private strategies;
    constructor();
    private registerDefaultStrategies;
    applyFix(error: BuildError, context: FixContext): Promise<FixResult>;
    getStrategy(category: ErrorCategory): FixStrategy | undefined;
}
//# sourceMappingURL=fix-strategies.d.ts.map
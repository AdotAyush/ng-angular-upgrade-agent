import { BuildError, FixResult } from '../types';
export declare class LLMResponseCache {
    private cacheDir;
    private enabled;
    private maxAgeMs;
    constructor(projectPath: string, options?: {
        enabled?: boolean;
        maxAgeMs?: number;
    });
    get(error: BuildError, context: string): Promise<FixResult | null>;
    set(error: BuildError, context: string, result: FixResult): Promise<void>;
    clear(): Promise<void>;
    getStats(): Promise<{
        size: number;
        entries: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    }>;
    private hashError;
    private ensureCacheDir;
}
//# sourceMappingURL=response-cache.d.ts.map
import { UpgradeConfig, UpgradeReport } from './types';
export declare class UpgradeOrchestrator {
    private config;
    private state;
    private reportGenerator;
    private llmClient;
    private agenticClient;
    private schematicRunner;
    constructor(config: UpgradeConfig);
    execute(): Promise<UpgradeReport>;
    private executePhase;
}
//# sourceMappingURL=upgrade-orchestrator.d.ts.map
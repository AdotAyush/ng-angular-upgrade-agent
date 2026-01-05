import { BuildError, FixStrategy, FixContext, FixResult, ErrorCategory } from '../types';
/**
 * Migrates HttpClient from HttpClientModule to provideHttpClient
 * Handles Angular 15+ standalone components
 */
export declare class HttpClientMigrationStrategy implements FixStrategy {
    name: string;
    category: ErrorCategory;
    isDeterministic: boolean;
    canHandle(error: BuildError): boolean;
    apply(error: BuildError, context: FixContext): Promise<FixResult>;
}
/**
 * Migrates Router from RouterModule to provideRouter
 */
export declare class RouterMigrationStrategy implements FixStrategy {
    name: string;
    category: ErrorCategory;
    isDeterministic: boolean;
    canHandle(error: BuildError): boolean;
    apply(error: BuildError, context: FixContext): Promise<FixResult>;
}
/**
 * Auto-imports common RxJS operators
 */
export declare class RxJSImportStrategy implements FixStrategy {
    name: string;
    category: ErrorCategory;
    isDeterministic: boolean;
    private rxjsOperators;
    canHandle(error: BuildError): boolean;
    apply(error: BuildError, context: FixContext): Promise<FixResult>;
    private getImportPath;
}
//# sourceMappingURL=angular-migrations.d.ts.map
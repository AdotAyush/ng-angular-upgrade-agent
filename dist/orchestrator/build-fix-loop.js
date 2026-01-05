"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildFixLoop = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const error_classifier_1 = require("../classifiers/error-classifier");
const fix_strategies_1 = require("../strategies/fix-strategies");
const llm_client_1 = require("../llm/llm-client");
const agentic_llm_client_1 = require("../llm/agentic-llm-client");
const response_cache_1 = require("../llm/response-cache");
const schematic_runner_1 = require("../schematics/schematic-runner");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class BuildFixLoop {
    errorClassifier;
    fixRegistry;
    llmClient;
    agenticClient = null;
    responseCache = null;
    schematicRunner;
    maxAttempts;
    fileBackups = new Map(); // Track original file contents
    useAgenticMode;
    useCache;
    useSchematics;
    verbose;
    schematicsRunThisSession = new Set(); // Track which schematics have been run
    constructor(options) {
        this.errorClassifier = new error_classifier_1.ErrorClassifier();
        this.fixRegistry = new fix_strategies_1.FixStrategyRegistry();
        this.schematicRunner = new schematic_runner_1.AngularSchematicRunner();
        this.llmClient = new llm_client_1.LLMClient(options.llmApiKey, options.llmProvider || 'gemini', {
            model: options.llmModel,
            awsRegion: options.awsRegion,
            awsSecretKey: options.awsSecretKey,
            geminiApiKey: options.geminiApiKey,
        });
        this.maxAttempts = options.maxAttempts || 10;
        this.useAgenticMode = options.useAgenticMode !== false; // Default enabled
        this.useCache = options.useCache !== false; // Default enabled
        this.useSchematics = options.useSchematics !== false; // Default enabled
        this.verbose = options.verbose || false;
    }
    /**
     * Initialize project-specific components
     */
    initializeForProject(projectPath) {
        // Initialize agentic client if enabled
        if (this.useAgenticMode && !this.agenticClient) {
            this.agenticClient = new agentic_llm_client_1.AgenticLLMClient(this.llmClient, projectPath, {
                maxIterations: 10,
                maxTokenBudget: 500000,
            });
            if (this.verbose) {
                console.log('  ✓ Agentic mode enabled');
            }
        }
        // Initialize cache if enabled
        if (this.useCache && !this.responseCache) {
            this.responseCache = new response_cache_1.LLMResponseCache(projectPath, { enabled: true });
            if (this.verbose) {
                console.log('  ✓ Response caching enabled');
            }
        }
    }
    // Legacy constructor signature for backwards compatibility
    static create(llmApiKey, maxAttempts = 10, llmProvider = 'gemini', llmOptions) {
        return new BuildFixLoop({
            llmApiKey,
            maxAttempts,
            llmProvider,
            llmModel: llmOptions?.model,
            awsRegion: llmOptions?.awsRegion,
            awsSecretKey: llmOptions?.awsSecretKey,
            geminiApiKey: llmOptions?.geminiApiKey,
        });
    }
    async execute(projectPath, targetVersion, environment) {
        // Initialize project-specific components
        this.initializeForProject(projectPath);
        const resolvedErrors = [];
        const appliedFixes = [];
        let attempts = 0;
        let unresolvedErrors = [];
        let previousErrorCount = null;
        let consecutiveWorseAttempts = 0;
        const maxWorseAttempts = 2; // Rollback if errors increase for 2 consecutive attempts
        let cacheHits = 0;
        let cacheMisses = 0;
        while (attempts < this.maxAttempts) {
            attempts++;
            console.log(`\n[Build Attempt ${attempts}/${this.maxAttempts}]`);
            // Run build
            const buildResult = await this.runBuild(projectPath, environment);
            if (buildResult.success) {
                console.log('✓ Build successful');
                return {
                    success: true,
                    attempts,
                    resolvedErrors,
                    unresolvedErrors: [],
                    appliedFixes,
                    cacheStats: this.useCache ? { hits: cacheHits, misses: cacheMisses } : undefined,
                };
            }
            // Classify errors
            const errors = this.errorClassifier.classifyErrors(buildResult.output);
            console.log(`Found ${errors.length} errors`);
            if (errors.length === 0) {
                console.log('No classifiable errors found');
                break;
            }
            // Check if errors increased - rollback if so
            if (previousErrorCount !== null && errors.length > previousErrorCount) {
                consecutiveWorseAttempts++;
                console.log(`⚠ Error count increased from ${previousErrorCount} to ${errors.length} (attempt ${consecutiveWorseAttempts}/${maxWorseAttempts})`);
                if (consecutiveWorseAttempts >= maxWorseAttempts) {
                    console.log(`\n🔄 Rolling back changes - AI fixes made things worse`);
                    await this.rollbackAllChanges();
                    // Re-run build after rollback
                    const rollbackBuild = await this.runBuild(projectPath, environment);
                    const rollbackErrors = this.errorClassifier.classifyErrors(rollbackBuild.output);
                    console.log(`✓ Rolled back to original code with ${rollbackErrors.length} errors`);
                    unresolvedErrors = rollbackErrors;
                    break;
                }
            }
            else if (previousErrorCount !== null && errors.length < previousErrorCount) {
                // Errors decreased, reset counter
                consecutiveWorseAttempts = 0;
                console.log(`✓ Progress: ${previousErrorCount} → ${errors.length} errors`);
            }
            previousErrorCount = errors.length;
            // Group errors by category
            const grouped = this.errorClassifier.groupErrorsByCategory(errors);
            console.log('Error categories:', Array.from(grouped.keys()));
            // Apply fixes
            let fixedAny = false;
            for (const [category, categoryErrors] of grouped) {
                for (const error of categoryErrors) {
                    // Skip errors in node_modules - these are third-party library issues
                    if (error.file && error.file.includes('node_modules')) {
                        console.log(`  ⊗ Skipping node_modules error: ${error.message.substring(0, 60)}...`);
                        console.log(`    → This indicates a package compatibility issue, not a code error`);
                        unresolvedErrors.push(error);
                        continue;
                    }
                    const context = {
                        projectPath,
                        targetVersion,
                        llmClient: this.llmClient, // Pass LLM client for AI-assisted fixes
                    };
                    // Try deterministic fix first
                    console.log(`  Attempting to fix: ${error.message.substring(0, 80)}...`);
                    const fixResult = await this.fixRegistry.applyFix(error, context);
                    if (fixResult.success) {
                        console.log(`  ✓ Fixed: ${error.message.substring(0, 60)}...`);
                        resolvedErrors.push(error);
                        appliedFixes.push(fixResult);
                        fixedAny = true;
                        // Apply changes
                        if (fixResult.changes) {
                            await this.applyChanges(fixResult.changes);
                        }
                    }
                    else {
                        // Deterministic fix failed - try schematics for certain error types
                        let schematicFixed = false;
                        if (this.useSchematics && this.isSchematicFixableError(error)) {
                            console.log(`  → Trying Angular schematic migration...`);
                            const schematicResult = await this.trySchematicFix(error, projectPath, targetVersion);
                            if (schematicResult.success) {
                                console.log(`  ✓ Fixed via schematic: ${error.message.substring(0, 60)}...`);
                                resolvedErrors.push(error);
                                appliedFixes.push(schematicResult);
                                fixedAny = true;
                                schematicFixed = true;
                            }
                        }
                        if (!schematicFixed) {
                            // Schematics didn't fix it - try LLM as fallback
                            console.log(`  → Deterministic fix failed, trying AI...`);
                            // Backup file before AI makes changes
                            if (error.file) {
                                await this.backupFile(error.file);
                            }
                            const llmResult = await this.tryLLMFix(error, context, buildResult.output);
                            // Track cache statistics
                            if ('fromCache' in llmResult && llmResult.fromCache) {
                                cacheHits++;
                            }
                            else {
                                cacheMisses++;
                            }
                            if (llmResult.success) {
                                console.log(`  ✓ Fixed via AI: ${error.message.substring(0, 60)}...`);
                                resolvedErrors.push(error);
                                appliedFixes.push(llmResult);
                                fixedAny = true;
                                if (llmResult.changes) {
                                    await this.applyChanges(llmResult.changes);
                                }
                            }
                            else {
                                console.log(`  ✗ Could not fix: ${error.message.substring(0, 60)}...`);
                                if (llmResult.suggestion) {
                                    console.log(`    Suggestion: ${llmResult.suggestion}`);
                                }
                            }
                        }
                    }
                }
            }
            if (!fixedAny) {
                console.log('No fixes could be applied automatically');
                // Check if all errors are from node_modules
                const nodeModuleErrors = errors.filter(e => e.file && e.file.includes('node_modules'));
                if (nodeModuleErrors.length > 0) {
                    const packages = new Set(nodeModuleErrors
                        .map(e => e.file?.match(/node_modules\/(@?[^/]+(?:\/[^/]+)?)/)?.[1])
                        .filter(Boolean));
                    console.log(`\n⚠ Found ${nodeModuleErrors.length} errors in node_modules packages:`);
                    packages.forEach(pkg => console.log(`  - ${pkg}`));
                    console.log(`\n💡 Suggestion: These packages may need to be upgraded to versions compatible with Angular ${targetVersion}`);
                }
                unresolvedErrors = errors;
                break;
            }
        }
        return {
            success: false,
            attempts,
            resolvedErrors,
            unresolvedErrors,
            appliedFixes,
            cacheStats: this.useCache ? { hits: cacheHits, misses: cacheMisses } : undefined,
        };
    }
    async runBuild(projectPath, environment) {
        try {
            const { stdout, stderr } = await execAsync('ng build', {
                cwd: projectPath,
                maxBuffer: 10 * 1024 * 1024, // 10MB
            });
            return {
                success: true,
                output: stdout + stderr,
            };
        }
        catch (error) {
            return {
                success: false,
                output: error.stdout + error.stderr,
            };
        }
    }
    async runTests(projectPath, environment) {
        try {
            const { stdout, stderr } = await execAsync('ng test --watch=false', {
                cwd: projectPath,
                maxBuffer: 10 * 1024 * 1024,
            });
            return {
                success: true,
                output: stdout + stderr,
            };
        }
        catch (error) {
            return {
                success: false,
                output: error.stdout + error.stderr,
            };
        }
    }
    async tryLLMFix(error, context, buildOutput) {
        const fs = await import('fs');
        const { promisify } = await import('util');
        const readFile = promisify(fs.readFile);
        const access = promisify(fs.access);
        // For errors without files (like global compilation warnings), try to find context or provide general guidance
        if (!error.file) {
            console.log(`    → No file context, searching project for relevant files...`);
            // Try agentic mode for complex errors without file context
            if (this.useAgenticMode && this.agenticClient && buildOutput) {
                console.log(`    → Using agentic mode to investigate...`);
                try {
                    const agenticResult = await this.agenticClient.requestFix(error, `Project: ${context.projectPath}, Target: Angular ${context.targetVersion}`, buildOutput);
                    if (agenticResult.success) {
                        return agenticResult;
                    }
                }
                catch (err) {
                    console.log(`    ⚠ Agentic mode failed: ${err}, falling back to standard LLM`);
                }
            }
            // Try to extract relevant context from error message
            const searchContext = await this.findRelevantContext(error, context.projectPath);
            if (searchContext.files.length > 0) {
                console.log(`    ✓ Found ${searchContext.files.length} relevant file(s)`);
                try {
                    // Use the first most relevant file for AI fix
                    const targetFile = searchContext.files[0];
                    const fileContent = await readFile(targetFile, 'utf-8');
                    console.log(`    → Requesting AI fix for ${targetFile}...`);
                    const response = await this.llmClient.requestFix({
                        type: 'refactor',
                        context: {
                            error,
                            fileContent,
                            targetVersion: context.targetVersion,
                            constraints: [
                                'Fix the specific error mentioned',
                                'Make minimal changes',
                                'Preserve existing functionality',
                                'Follow Angular best practices',
                            ],
                        },
                    });
                    if (response.success && response.changes) {
                        // Update the file path in the response
                        response.changes[0].file = targetFile;
                        console.log(`    ✓ AI provided fix for ${targetFile}`);
                    }
                    return response;
                }
                catch (err) {
                    console.log(`    ✗ AI fix failed: ${err}`);
                }
            }
            // If no context found, provide general guidance
            console.log(`    → Requesting general AI guidance...`);
            try {
                const response = await this.llmClient.requestFix({
                    type: 'refactor',
                    context: {
                        error,
                        fileContent: `Build error without specific file: ${error.message}\nSearch context: ${searchContext.searchInfo}`,
                        targetVersion: context.targetVersion,
                        constraints: [
                            'Explain the issue',
                            'Suggest configuration changes (tsconfig.json, angular.json, package.json)',
                            'Provide actionable steps',
                        ],
                    },
                });
                console.log(`    ✓ AI provided guidance`);
                return {
                    success: false,
                    requiresManualIntervention: true,
                    suggestion: response.reasoning || 'AI could not provide specific guidance. Check project configuration files.',
                };
            }
            catch (err) {
                console.log(`    ✗ AI guidance failed: ${err}`);
                return {
                    success: false,
                    requiresManualIntervention: true,
                    suggestion: `No file specified. Error: ${error.message}. Check tsconfig.json or angular.json for configuration issues.`,
                };
            }
        }
        // Check if file exists before trying to read it
        try {
            await access(error.file, fs.constants.R_OK);
        }
        catch {
            console.log(`    ✗ File does not exist or is not readable: ${error.file}`);
            return {
                success: false,
                requiresManualIntervention: true,
                suggestion: `File path extraction error. File not found: ${error.file}. Check build output for actual file location.`,
            };
        }
        const fileContent = await readFile(error.file, 'utf-8');
        // Check cache first
        if (this.responseCache) {
            const cachedResult = await this.responseCache.get(error, fileContent);
            if (cachedResult) {
                console.log(`    💾 Using cached fix`);
                return { ...cachedResult, fromCache: true };
            }
        }
        // Try agentic mode for complex errors
        if (this.useAgenticMode && this.agenticClient && buildOutput) {
            console.log(`    → Using agentic mode...`);
            try {
                const agenticResult = await this.agenticClient.requestFix(error, `File: ${error.file}\n${fileContent.substring(0, 2000)}`, buildOutput);
                if (agenticResult.success) {
                    // Cache successful agentic result
                    if (this.responseCache) {
                        await this.responseCache.set(error, fileContent, agenticResult);
                    }
                    return agenticResult;
                }
            }
            catch (err) {
                console.log(`    ⚠ Agentic mode failed: ${err}, falling back to standard LLM`);
            }
        }
        console.log(`    → Requesting AI fix from LLM...`);
        const request = {
            type: 'refactor',
            context: {
                error,
                fileContent,
                targetVersion: context.targetVersion,
                constraints: [
                    'Make minimal changes',
                    'Preserve existing functionality',
                    'Follow Angular style guide',
                    'Do not modify versions',
                    'Fix the specific error mentioned',
                ],
            },
        };
        // Validate request
        const validation = llm_client_1.LLMGuardrails.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.reason,
                requiresManualIntervention: true,
            };
        }
        try {
            const response = await this.llmClient.requestFix(request);
            console.log(`    ✓ AI responded`);
            // Validate response
            const responseValidation = llm_client_1.LLMGuardrails.validateResponse(response);
            if (!responseValidation.valid) {
                console.log(`    ✗ AI response validation failed: ${responseValidation.reason}`);
                return {
                    success: false,
                    error: responseValidation.reason,
                    requiresManualIntervention: true,
                    suggestion: `AI response invalid: ${responseValidation.reason}`,
                };
            }
            if (response.success && response.changes) {
                console.log(`    ✓ AI provided ${response.changes.length} fix(es)`);
                // Cache successful result
                if (this.responseCache) {
                    await this.responseCache.set(error, fileContent, response);
                }
            }
            return response;
        }
        catch (llmError) {
            console.log(`    ✗ AI fix attempt failed: ${llmError}`);
            return {
                success: false,
                error: String(llmError),
                requiresManualIntervention: true,
                suggestion: `LLM failed: ${llmError}. Check API key, network, and service availability. Manual fix required.`,
            };
        }
    }
    async applyChanges(changes) {
        const fs = await import('fs');
        const { promisify } = await import('util');
        const readFile = promisify(fs.readFile);
        const writeFile = promisify(fs.writeFile);
        for (const change of changes) {
            if (change.type !== 'modify')
                continue;
            // NEW: Apply search/replace patches (safe, targeted changes)
            if (change.searchReplace && change.searchReplace.length > 0) {
                let fileContent = await readFile(change.file, 'utf-8');
                let appliedCount = 0;
                for (const { search, replace } of change.searchReplace) {
                    // Clean up the search string (remove line number prefixes if present)
                    const cleanSearch = search
                        .split('\n')
                        .map(line => line.replace(/^(?:>>>\s+|\s{4})\d+:\s/, ''))
                        .join('\n');
                    const cleanReplace = replace
                        .split('\n')
                        .map(line => line.replace(/^(?:>>>\s+|\s{4})\d+:\s/, ''))
                        .join('\n');
                    if (fileContent.includes(cleanSearch)) {
                        fileContent = fileContent.replace(cleanSearch, cleanReplace);
                        appliedCount++;
                        console.log(`      ✓ Applied replacement ${appliedCount} in ${change.file}`);
                    }
                    else {
                        // Try fuzzy match (ignore whitespace differences)
                        const fuzzyResult = this.fuzzyReplace(fileContent, cleanSearch, cleanReplace);
                        if (fuzzyResult.success) {
                            fileContent = fuzzyResult.content;
                            appliedCount++;
                            console.log(`      ✓ Applied fuzzy replacement ${appliedCount} in ${change.file}`);
                        }
                        else {
                            console.warn(`      ⚠ Could not find search text in ${change.file}. Search was:\n${cleanSearch.substring(0, 200)}...`);
                        }
                    }
                }
                if (appliedCount > 0) {
                    await writeFile(change.file, fileContent, 'utf-8');
                    console.log(`    ✓ Saved ${appliedCount} change(s) to ${change.file}`);
                }
            }
            // LEGACY: Full file replacement (only if explicitly marked or no searchReplace)
            else if (change.content) {
                if (change.isFullFileReplacement) {
                    console.warn(`    ⚠ FULL FILE REPLACEMENT on ${change.file} - this may cause issues!`);
                }
                await writeFile(change.file, change.content, 'utf-8');
            }
        }
    }
    /**
     * Fuzzy replace - try to match ignoring whitespace differences
     */
    fuzzyReplace(content, search, replace) {
        // Normalize whitespace for comparison
        const normalizeWs = (s) => s.replace(/[ \t]+/g, ' ').replace(/\r\n/g, '\n');
        const normalizedContent = normalizeWs(content);
        const normalizedSearch = normalizeWs(search);
        if (normalizedContent.includes(normalizedSearch)) {
            // Find the actual position in original content
            const lines = content.split('\n');
            const searchLines = search.split('\n').map(l => l.trim());
            // Find start line
            let startLineIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === searchLines[0].trim()) {
                    // Check if subsequent lines match
                    let matches = true;
                    for (let j = 1; j < searchLines.length && i + j < lines.length; j++) {
                        if (lines[i + j].trim() !== searchLines[j].trim()) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) {
                        startLineIdx = i;
                        break;
                    }
                }
            }
            if (startLineIdx >= 0) {
                // Get the indentation of the original first line
                const originalIndent = lines[startLineIdx].match(/^(\s*)/)?.[1] || '';
                const replaceLines = replace.split('\n').map((line, idx) => {
                    if (idx === 0)
                        return originalIndent + line.trim();
                    // Preserve relative indentation from replacement
                    const lineIndent = line.match(/^(\s*)/)?.[1] || '';
                    return originalIndent + line.trimStart();
                });
                lines.splice(startLineIdx, searchLines.length, ...replaceLines);
                return { success: true, content: lines.join('\n') };
            }
        }
        return { success: false, content };
    }
    /**
     * Backup a file before making changes
     */
    async backupFile(filePath) {
        // Only backup once per file
        if (this.fileBackups.has(filePath)) {
            return;
        }
        try {
            const fs = await import('fs');
            const { promisify } = await import('util');
            const readFile = promisify(fs.readFile);
            const content = await readFile(filePath, 'utf-8');
            this.fileBackups.set(filePath, content);
            console.log(`    📦 Backed up: ${filePath}`);
        }
        catch (error) {
            console.log(`    ⚠ Could not backup ${filePath}: ${error}`);
        }
    }
    /**
     * Rollback all backed up files to original state
     */
    async rollbackAllChanges() {
        const fs = await import('fs');
        const { promisify } = await import('util');
        const writeFile = promisify(fs.writeFile);
        let rolledBack = 0;
        for (const [filePath, originalContent] of this.fileBackups.entries()) {
            try {
                await writeFile(filePath, originalContent, 'utf-8');
                rolledBack++;
                console.log(`  ✓ Restored: ${filePath}`);
            }
            catch (error) {
                console.log(`  ✗ Failed to restore ${filePath}: ${error}`);
            }
        }
        console.log(`Rolled back ${rolledBack}/${this.fileBackups.size} files`);
        this.fileBackups.clear();
    }
    /**
     * Find relevant files for errors without file context
     * Searches project for files that might be related to the error
     */
    async findRelevantContext(error, projectPath) {
        const fs = await import('fs');
        const path = await import('path');
        const { promisify } = await import('util');
        const readdir = promisify(fs.readdir);
        const readFile = promisify(fs.readFile);
        const stat = promisify(fs.stat);
        const relevantFiles = [];
        const searchTerms = [];
        // Extract search terms from error message
        // Example: "Cannot find module 'lodash'" -> search for "lodash"
        const moduleMatch = error.message.match(/Cannot find module ['"](.+?)['"]/);
        if (moduleMatch) {
            searchTerms.push(moduleMatch[1]);
        }
        // Generic search terms
        const generalTerms = error.message.match(/['"]([a-zA-Z0-9_-]+)['"]/g);
        if (generalTerms) {
            searchTerms.push(...generalTerms.map(t => t.replace(/['"]/g, '')));
        }
        if (searchTerms.length === 0) {
            return { files: [], searchInfo: 'No search terms extracted from error' };
        }
        console.log(`    → Searching for: ${searchTerms.join(', ')}`);
        // Search through TypeScript files
        const searchDirs = ['src', 'projects'];
        for (const dir of searchDirs) {
            const fullPath = path.join(projectPath, dir);
            try {
                const files = await this.recursiveFileSearch(fullPath, searchTerms, readdir, readFile, stat);
                relevantFiles.push(...files);
                if (relevantFiles.length >= 3)
                    break; // Limit to first 3 files
            }
            catch {
                // Directory might not exist, continue
            }
        }
        return {
            files: relevantFiles,
            searchInfo: `Searched for: ${searchTerms.join(', ')} in project directories`,
        };
    }
    /**
     * Recursively search files for terms
     */
    async recursiveFileSearch(dir, searchTerms, readdir, readFile, stat, depth = 0) {
        if (depth > 4)
            return []; // Limit recursion depth
        const path = await import('path');
        const matches = [];
        try {
            const entries = await readdir(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = await stat(fullPath);
                if (stats.isDirectory()) {
                    // Skip node_modules, dist, etc.
                    if (['node_modules', 'dist', '.git', '.angular'].includes(entry)) {
                        continue;
                    }
                    const subMatches = await this.recursiveFileSearch(fullPath, searchTerms, readdir, readFile, stat, depth + 1);
                    matches.push(...subMatches);
                }
                else if (stats.isFile() && /\.(ts|js)$/.test(entry)) {
                    // Search file content
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        for (const term of searchTerms) {
                            if (content.includes(term)) {
                                matches.push(fullPath);
                                break;
                            }
                        }
                    }
                    catch {
                        // Skip files that can't be read
                    }
                }
                if (matches.length >= 3)
                    break; // Limit results
            }
        }
        catch {
            // Ignore errors
        }
        return matches;
    }
    /**
     * Check if an error might be fixable by Angular schematics
     */
    isSchematicFixableError(error) {
        // Errors that are typically fixed by Angular schematics
        const schematicFixablePatterns = [
            // HttpClient migration
            /HttpClientModule/i,
            /provideHttpClient/i,
            // Router migration
            /RouterModule\.forRoot/i,
            /provideRouter/i,
            // Standalone migration
            /standalone.*component/i,
            /imports.*array/i,
            // Control flow migration (@if, @for, etc.)
            /@if|@for|@switch|@defer/,
            /\*ngIf|\*ngFor|\*ngSwitch/,
            // Signal migration
            /signal\(|computed\(|effect\(/,
            /input\(|output\(|model\(/,
            // Zone.js changes
            /provideZoneChangeDetection/i,
            // SSR/Hydration
            /provideClientHydration/i,
            // Material/CDK updates
            /@angular\/material|@angular\/cdk/,
        ];
        return schematicFixablePatterns.some(pattern => pattern.test(error.message));
    }
    /**
     * Try to fix an error using Angular schematics
     */
    async trySchematicFix(error, projectPath, targetVersion) {
        // Determine which schematic to run based on error
        const schematicToRun = this.determineSchematic(error);
        if (!schematicToRun) {
            return { success: false, suggestion: 'No applicable schematic found' };
        }
        // Don't run the same schematic twice in one session
        if (this.schematicsRunThisSession.has(schematicToRun)) {
            if (this.verbose) {
                console.log(`    → Schematic ${schematicToRun} already run this session, skipping`);
            }
            return { success: false, suggestion: 'Schematic already attempted' };
        }
        try {
            console.log(`    → Running schematic: ${schematicToRun}...`);
            this.schematicsRunThisSession.add(schematicToRun);
            const { stdout, stderr } = await execAsync(`npx @angular/cli@${targetVersion} generate ${schematicToRun} --defaults`, {
                cwd: projectPath,
                maxBuffer: 50 * 1024 * 1024,
            });
            const output = stdout + stderr;
            const migrationInfo = this.schematicRunner.extractMigrationInfo(output);
            if (migrationInfo.filesModified.length > 0) {
                console.log(`    ✓ Schematic modified ${migrationInfo.filesModified.length} files`);
                return {
                    success: true,
                    changes: migrationInfo.filesModified.map(file => ({
                        file,
                        type: 'modify',
                    })),
                    reasoning: `Applied schematic: ${schematicToRun}`,
                };
            }
            // Try running ng update --migrate-only for the specific package
            const packageToUpdate = this.getPackageForSchematic(schematicToRun);
            if (packageToUpdate) {
                console.log(`    → Trying ng update migrations for ${packageToUpdate}...`);
                const { stdout: updateOut, stderr: updateErr } = await execAsync(`npx @angular/cli@${targetVersion} update ${packageToUpdate} --migrate-only --allow-dirty --force`, {
                    cwd: projectPath,
                    maxBuffer: 50 * 1024 * 1024,
                });
                const updateOutput = updateOut + updateErr;
                const updateInfo = this.schematicRunner.extractMigrationInfo(updateOutput);
                if (updateInfo.filesModified.length > 0 || updateInfo.migrationsApplied.length > 0) {
                    console.log(`    ✓ ng update modified ${updateInfo.filesModified.length} files`);
                    return {
                        success: true,
                        changes: updateInfo.filesModified.map(file => ({
                            file,
                            type: 'modify',
                        })),
                        reasoning: `Applied ng update migrations for ${packageToUpdate}`,
                    };
                }
            }
            return { success: false, suggestion: 'Schematic ran but made no changes' };
        }
        catch (err) {
            if (this.verbose) {
                console.log(`    ⚠ Schematic failed: ${err.message}`);
            }
            return { success: false, error: err.message };
        }
    }
    /**
     * Determine which schematic to run for an error
     */
    determineSchematic(error) {
        const msg = error.message.toLowerCase();
        // Control flow migration
        if (msg.includes('*ngif') || msg.includes('*ngfor') || msg.includes('*ngswitch')) {
            return '@angular/core:control-flow-migration';
        }
        // Standalone migration
        if (msg.includes('standalone') || msg.includes('imports array')) {
            return '@angular/core:standalone-migration';
        }
        // Signal migration
        if (msg.includes('signal') || msg.includes('computed') || msg.includes('effect')) {
            return '@angular/core:signal-migration';
        }
        // Route lazy loading migration
        if (msg.includes('loadchildren') && msg.includes('string')) {
            return '@angular/core:route-lazy-loading';
        }
        // Inject migration
        if (msg.includes('inject(') || msg.includes('injection context')) {
            return '@angular/core:inject-migration';
        }
        return null;
    }
    /**
     * Get the package name for running ng update
     */
    getPackageForSchematic(schematic) {
        if (schematic.startsWith('@angular/core')) {
            return '@angular/core';
        }
        if (schematic.startsWith('@angular/material')) {
            return '@angular/material';
        }
        if (schematic.startsWith('@angular/cdk')) {
            return '@angular/cdk';
        }
        if (schematic.startsWith('@ngrx')) {
            return '@ngrx/store';
        }
        return null;
    }
    async verifyBuildAndTests(projectPath, environment) {
        const buildResult = await this.runBuild(projectPath, environment);
        const testResult = await this.runTests(projectPath, environment);
        return {
            buildPassed: buildResult.success,
            testsPassed: testResult.success,
        };
    }
}
exports.BuildFixLoop = BuildFixLoop;
//# sourceMappingURL=build-fix-loop.js.map
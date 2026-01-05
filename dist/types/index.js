"use strict";
/**
 * Core configuration types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradePhase = exports.ErrorCategory = void 0;
/**
 * Error classification types
 */
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["COMPILATION"] = "COMPILATION";
    ErrorCategory["TYPESCRIPT"] = "TYPESCRIPT";
    ErrorCategory["TEMPLATE"] = "TEMPLATE";
    ErrorCategory["IMPORT"] = "IMPORT";
    ErrorCategory["DEPENDENCY"] = "DEPENDENCY";
    ErrorCategory["ROUTER"] = "ROUTER";
    ErrorCategory["RXJS"] = "RXJS";
    ErrorCategory["STANDALONE"] = "STANDALONE";
    ErrorCategory["SSR"] = "SSR";
    ErrorCategory["UNKNOWN"] = "UNKNOWN";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
var UpgradePhase;
(function (UpgradePhase) {
    UpgradePhase["INIT"] = "INIT";
    UpgradePhase["ENVIRONMENT_VALIDATION"] = "ENVIRONMENT_VALIDATION";
    UpgradePhase["DEPENDENCY_RESOLUTION"] = "DEPENDENCY_RESOLUTION";
    UpgradePhase["CODE_ANALYSIS"] = "CODE_ANALYSIS";
    UpgradePhase["BUILD_FIX_LOOP"] = "BUILD_FIX_LOOP";
    UpgradePhase["VERIFICATION"] = "VERIFICATION";
    UpgradePhase["COMPLETE"] = "COMPLETE";
    UpgradePhase["FAILED"] = "FAILED";
})(UpgradePhase || (exports.UpgradePhase = UpgradePhase = {}));
//# sourceMappingURL=index.js.map
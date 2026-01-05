"use strict";
/**
 * Angular Upgrade Agent - Compatibility Configuration
 *
 * NOTE: Dependency versions are now resolved DYNAMICALLY from npm metadata.
 * The ANGULAR_COMPATIBILITY matrix below is DEPRECATED and kept only for reference.
 *
 * The DependencyResolver reads peer dependencies directly from:
 * - @angular/core → for rxjs, zone.js constraints
 * - @angular/compiler-cli → for typescript constraints
 * - @angular/cli → for Node.js version requirements
 * - @angular-eslint/schematics → for eslint compatibility
 *
 * This approach is future-proof and always accurate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVATE_PACKAGE_URLS = exports.PRIVATE_PACKAGE_VERSIONS = exports.KNOWN_PACKAGES = exports.RXJS_MIGRATIONS = exports.ANGULAR_COMPATIBILITY = void 0;
/**
 * @deprecated - Versions are now resolved dynamically from npm peer dependencies.
 * This matrix is kept for reference only and may be removed in future versions.
 */
exports.ANGULAR_COMPATIBILITY = {
// This is now resolved dynamically from npm package metadata
// See DependencyResolver.resolveDependencies()
};
/**
 * Deprecated RxJS operators and their replacements
 */
exports.RXJS_MIGRATIONS = {
    'switchMap': 'switchMap', // no change
    'mergeMap': 'mergeMap', // no change
    'concatMap': 'concatMap', // no change
    'exhaustMap': 'exhaustMap', // no change
};
/**
 * Known third-party package compatibility
 */
exports.KNOWN_PACKAGES = {
    '@ngrx/store': {
        minAngularVersion: '15.0.0',
    },
    '@ngxs/store': {
        minAngularVersion: '15.0.0',
    },
    'ng-zorro-antd': {
        minAngularVersion: '15.0.0',
    },
    'primeng': {
        minAngularVersion: '15.0.0',
    },
};
/**
 * Private/custom package version overrides
 * Use this to hardcode major versions for private repositories or packages with specific requirements
 * The resolver will automatically find the latest compatible minor/patch version
 * Format: 'package-name': { 'angularVersion': 'majorVersion' }
 */
exports.PRIVATE_PACKAGE_VERSIONS = {
    '@iam/ngx-dynamic-forms': {
        '12': '12',
        '13': '13',
        '14': '14',
        '15': '15',
        '16': '16',
        '17': '17',
        '18': '18',
        '19': '19',
        '20': '20',
    },
    '@ux-aspects/ux-aspects': {
        '12': '7',
        '13': '7',
        '14': '7',
        '15': '7',
        '16': '8',
        '17': '10',
        '18': '12',
        '19': '13',
        '20': '13', // v13 supports Angular 19-20
    },
    '@ux-aspects/angular-tree-component': {
        '12': '7',
        '13': '7',
        '14': '7',
        '15': '7',
        '16': '16',
        '17': '16',
        '18': '16',
        '19': '16',
        '20': '16',
    },
    '@micro-focus/ux-aspects': {
        '12': '7',
        '13': '7',
        '14': '7',
        '15': '7',
        '16': '8',
        '17': '10',
        '18': '12',
        '19': '13',
        '20': '13',
    },
    '@micro-focus/quantum-ux-aspects': {
        '20': '9',
    },
    'ngx-monaco-editor-v2': {
        '12': '12',
        '13': '13',
        '14': '14',
        '15': '15',
        '16': '16',
        '17': '17',
        '18': '18',
        '19': '19',
        '20': '20',
    },
    '@ghs/othhjs': {
        '12': '24',
        '13': '24',
        '14': '24',
        '15': '24',
        '16': '24',
        '17': '24',
        '18': '24',
        '19': '24',
        '20': '24',
    },
};
/**
 * Private package URL overrides
 * Use this for packages that should be installed from custom URLs instead of npm registry
 * Format: 'package-name': 'url'
 */
exports.PRIVATE_PACKAGE_URLS = {
    '@ghs/othhjs': 'https://amondal.idm.labs.blr.novell.com/ghs-othhjs-24.3.0.tgz',
};
//# sourceMappingURL=compatibility.js.map
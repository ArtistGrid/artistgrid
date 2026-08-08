// types/index.d.ts

// This tells TypeScript that whenever we import a file ending in .csv,
// its default export will be a string.
declare module "*.csv" {
  const content: string;
  export default content;
}

declare const __APP_VERSION__: string;

declare module "uglify-js" {
  export interface UglifyOptions {
    compress?: Record<string, unknown> | boolean;
    mangle?: Record<string, unknown> | boolean;
    output?: Record<string, unknown>;
    module?: boolean;
  }
  export interface MinifyOutput {
    code?: string;
    map?: unknown;
    error?: Error;
  }
  export function minify(
    files: string | string[] | Record<string, string>,
    options?: UglifyOptions,
  ): MinifyOutput;
}

declare module "csso" {
  export interface MinifyOptions {
    restructure?: boolean;
    forceMediaMerge?: boolean;
  }
  export interface MinifyResult {
    css?: string;
    map?: unknown;
  }
  export function minify(source: string, options?: MinifyOptions): MinifyResult;
}

declare module "clean-css" {
  export interface CleanCSSOptions {
    level?: number | string | Record<string, unknown>;
    compatibility?: string;
    inline?: boolean | string[];
    returnPromise?: boolean;
  }
  export interface MinifyOutput {
    styles?: string;
    errors?: string[];
    warnings?: string[];
    inlinedStylesheets?: string[];
  }
  export default class CleanCSS {
    constructor(options?: CleanCSSOptions);
    minify(source: string | object): MinifyOutput;
  }
}

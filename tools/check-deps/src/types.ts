export type Severity = 'INFO' | 'WARN' | 'ERROR';

export interface Finding {
  packageName: string;
  packageDir: string;
  rule: string;
  severity: Severity;
  message: string;
  because?: string; // rationale from matched policy/condition
}

export interface RepoConfig {
  allowSkipLibCheck: string[];
}

export interface PackageMeta {
  name: string;
  dir: string;
  pkgJson: any;
  tsconfig: any;
  externals: string[];
  deps: Set<string>;
  peers: Set<string>;
  devs: Set<string>;
  attrs: Set<string>; // e.g., ui, publishable, usesTsup, browser, node, hasTsx, skipLibCheck
}

export type Condition = (m: PackageMeta) => { ok: boolean; because?: string };

export interface Policy {
  id: string;
  when: Condition;
  because: string; // human-readable rationale surfaced on findings
  rules: string[]; // list of rule ids to enforce
  severityOverride?: Partial<Record<string, Severity>>; // optional per-rule severity overrides
}


import type { Policy } from './types';
import { all, any, hasSkipLibCheck, isPublishable, isUI, usesTsup } from './conditions';

// Condition-driven policies with explicit rationales.
export const policies: Policy[] = [
  {
    id: 'ui-externals-and-peers',
    when: isUI(),
    because: 'UI packages should not bundle React/MUI and must rely on host app singletons.',
    rules: ['ui-in-deps', 'ui-missing-peer', 'peer-in-external'],
  },
  {
    id: 'publishable-tsconfig-hygiene',
    when: isPublishable(),
    because: 'Publishable packages should extend the repo TS baseline and avoid direct ../src or built dist/*.d.ts references.',
    rules: ['tsconfig-no-base', 'paths-direct-src', 'paths-to-dist-dts'],
  },
  {
    id: 'tsup-peer-hygiene',
    when: usesTsup(),
    because: 'Packages using tsup must keep peers marked as externals to prevent double bundling.',
    rules: ['peer-in-external', 'external-in-deps'],
  },
  {
    id: 'skipLibCheck-governance',
    when: hasSkipLibCheck(),
    because: 'skipLibCheck is a debt toggle and must be explicitly justified or disabled.',
    rules: ['skipLibCheck-no-reason', 'skipLibCheck-not-allowed'],
    severityOverride: { 'skipLibCheck-no-reason': 'WARN', 'skipLibCheck-not-allowed': 'ERROR' },
  },
  {
    id: 'jsx-option-for-tsx',
    when: all(isPublishable(), isUI()),
    because: 'TSX sources need jsx: react-jsx for correct type inference and JSX emit.',
    rules: ['jsx-mismatch'],
  },
];

import type {
  YamlStorageProductionPreflightMode,
  YamlStorageProductionPreflightResult,
} from './runYamlStorageProductionPreflight.js';

export interface InitializeYamlStorageProductionPreflightInput {
  readonly document: Document;
  readonly mode: YamlStorageProductionPreflightMode;
  readonly releaseVersion: string;
  readonly execute: () => Promise<YamlStorageProductionPreflightResult>;
}

interface PreflightElements {
  readonly mode: HTMLElement;
  readonly release: HTMLElement;
  readonly state: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly output: HTMLElement;
}

function requireElement<T extends HTMLElement>(
  document: Document,
  id: string,
  expected: { new (...args: never[]): T }
): T {
  const element = document.getElementById(id);
  if (!(element instanceof expected)) throw new Error(`missing-required-element:${id}`);
  return element;
}

function readElements(document: Document): PreflightElements {
  return Object.freeze({
    mode: requireElement(document, 'preflight-mode', HTMLElement),
    release: requireElement(document, 'preflight-release', HTMLElement),
    state: requireElement(document, 'preflight-state', HTMLElement),
    button: requireElement(document, 'run-preflight', HTMLButtonElement),
    output: requireElement(document, 'preflight-output', HTMLElement),
  });
}

export function parseYamlStorageProductionPreflightMode(
  url: URL
): YamlStorageProductionPreflightMode | null {
  const modes = url.searchParams.getAll('mode');
  return modes.length === 1 && (modes[0] === 'pre' || modes[0] === 'post') ? modes[0] : null;
}

export function renderYamlStorageProductionPreflightModeFailure(
  document: Document,
  releaseVersion: string
): void {
  const elements = readElements(document);
  elements.mode.textContent = 'invalid';
  elements.release.textContent = releaseVersion;
  elements.state.textContent = 'rejected';
  elements.button.disabled = true;
  elements.output.textContent = JSON.stringify(
    { status: 'rejected', code: 'PREFLIGHT_MODE_INVALID' },
    null,
    2
  );
}

export function initializeYamlStorageProductionPreflight(
  input: InitializeYamlStorageProductionPreflightInput
): void {
  const elements = readElements(input.document);
  elements.mode.textContent = input.mode;
  elements.release.textContent = input.releaseVersion;
  elements.state.textContent = 'idle';
  let started = false;
  elements.button.addEventListener(
    'click',
    () => {
      if (started) return;
      started = true;
      elements.button.disabled = true;
      elements.state.textContent = 'running';
      elements.output.textContent = '';
      void input.execute().then(
        (result) => {
          elements.state.textContent = result.status;
          elements.output.textContent = JSON.stringify(result, null, 2);
        },
        () => {
          elements.state.textContent = 'rejected';
          elements.output.textContent = JSON.stringify(
            { mode: input.mode, status: 'rejected', code: 'PREFLIGHT_UI_EXECUTION_FAILED' },
            null,
            2
          );
        }
      );
    },
    { once: true }
  );
}

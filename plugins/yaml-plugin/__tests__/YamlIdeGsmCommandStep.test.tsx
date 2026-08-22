import type { NodeId } from '@hierarchidb/core-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YamlIdeGsmCommandStep } from '../src/ui/components/steps/YamlIdeGsmCommandStep.js';
import type {
  YamlIdeGsmExecutionResult,
  YamlIdeGsmExecutorLike,
} from '../src/ui/components/steps/YamlIdeGsmCommandStepTypes.js';

const parentId = 'parent-node' as NodeId;

function renderCommandStep(executor?: YamlIdeGsmExecutorLike) {
  return render(
    <YamlIdeGsmCommandStep
      mode="edit"
      parentId={parentId}
      data={{
        name: 'scenario.yml',
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        content: 'name: test-scenario\n',
      }}
      disabled={false}
      onChange={() => {}}
      setValid={() => {}}
      setError={() => {}}
      step4Runtime={{
        enabled: true,
        executor,
        defaultProjectRelativePath: 'project-a',
      }}
    />
  );
}

describe('YamlIdeGsmCommandStep', () => {
  it('runs only commands exposed by the selected subtype', async () => {
    const execute = vi.fn<YamlIdeGsmExecutorLike['execute']>(
      async (_input, onStatus): Promise<YamlIdeGsmExecutionResult> => {
        onStatus?.({
          phase: 'command',
          task: { id: 'task-command', status: 'FINISHED' },
        });
        return { ok: true, commandTaskId: 'task-command' };
      }
    );
    renderCommandStep({ execute });

    expect(screen.getByText('check')).toBeTruthy();
    expect(screen.queryByText('init')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId,
        filename: 'scenario.yml',
        commandId: 'check',
        runtimeInput: { projectRelativePath: 'project-a' },
      }),
      expect.any(Function)
    );
    expect(await screen.findByText('Command task task-command finished.')).toBeTruthy();
  });

  it('renders editor-only subtype as an empty command set', () => {
    render(
      <YamlIdeGsmCommandStep
        mode="edit"
        parentId={parentId}
        data={{
          name: 'calib.yml',
          subtype: 'calib',
          schemaId: 'ide-gsm/calib',
          content: 'calibrationId: c1\n',
        }}
        disabled={false}
        onChange={() => {}}
        setValid={() => {}}
        setError={() => {}}
        step4Runtime={{ enabled: true, executor: { execute: vi.fn() } }}
      />
    );

    expect(screen.getByText('No commands are available for Calibration.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
  });

  it('blocks command start when canonical validation fails', () => {
    const execute = vi.fn<YamlIdeGsmExecutorLike['execute']>();
    render(
      <YamlIdeGsmCommandStep
        mode="edit"
        parentId={parentId}
        data={{
          name: 'scenario.yml',
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'description: missing required name\n',
        }}
        disabled={false}
        onChange={() => {}}
        setValid={() => {}}
        setError={() => {}}
        step4Runtime={{
          enabled: true,
          executor: { execute },
          defaultProjectRelativePath: 'project-a',
        }}
      />
    );

    expect(screen.getByText('YAML content does not match the canonical contract.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();
  });
});

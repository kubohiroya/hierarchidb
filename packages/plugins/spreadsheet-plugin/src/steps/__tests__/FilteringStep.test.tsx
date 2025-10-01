import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilteringStep } from '../FilteringStep.js';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue?: string) => defaultValue ?? _key }),
}));

const getTableMetadataMock = vi.fn();

vi.mock('../../ui/facade/index.js', () => ({
  createSpreadsheetCSVApi: vi.fn(() => ({
    getTableMetadata: getTableMetadataMock,
  })),
}));

describe('FilteringStep', () => {
  beforeEach(() => {
    getTableMetadataMock.mockResolvedValue({
      columns: [
        { name: 'country' },
        { name: 'value' },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderFilteringStep = () => {
    const onChange = vi.fn();
    render(
      <FilteringStep
        mode="create"
        data={{
          spreadsheetMetadataId: 'meta-1',
          filters: { rows: [], columns: [] },
        }}
        onChange={onChange}
        setValid={vi.fn()}
        setError={vi.fn()}
      />,
    );
    return onChange;
  };

  it('toggles column visibility and propagates updates', async () => {
    const onChange = renderFilteringStep();

    const columnChip = await screen.findByText('country');
    fireEvent.click(columnChip);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.filters?.columns?.find((c: any) => c.name === 'country')?.visible).toBe(false);
  });

  it('adds a row filter using the first available column', async () => {
    const onChange = renderFilteringStep();

    const addButton = await screen.findByRole('button', { name: 'Add Filter' });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.filters?.rows).toHaveLength(1);
    expect(lastCall?.filters?.rows?.[0]).toMatchObject({ column: 'country', enabled: true });
  });
});

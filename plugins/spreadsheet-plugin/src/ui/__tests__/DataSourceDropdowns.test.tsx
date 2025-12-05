import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  TabularFileImportStep,
  TabularProvider,
  type TabularDataApi,
} from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';

const baseMetadata: TabularTableMetadata = {
  id: 'meta-1',
  filename: 'sample.csv',
  contentHash: 'hash',
  fileSizeBytes: 10,
  totalRows: 1,
  columns: [],
  createdAt: Date.now(),
  referenceCount: 0,
  referencingPlugins: [],
};

const createStubApi = (): TabularDataApi => ({
  uploadTabularFile: vi.fn().mockResolvedValue(baseMetadata),
  downloadTabularFromUrl: vi.fn().mockResolvedValue(baseMetadata),
  getTableMetadata: vi.fn().mockResolvedValue(baseMetadata),
  listTables: vi.fn().mockResolvedValue({ tables: [], total: 0 }),
  deleteTable: vi.fn().mockResolvedValue(undefined),
  getFilteredPreview: vi.fn().mockResolvedValue({ columns: [], rows: [], totalRows: 0 }),
  getFilteredData: vi.fn().mockResolvedValue({ columns: [], rows: [], totalRows: 0 }),
  addTableReference: vi.fn().mockResolvedValue(undefined),
  removeTableReference: vi.fn().mockResolvedValue(undefined),
  getProcessingStatus: vi.fn().mockResolvedValue(null),
});

let modalRoot: HTMLDivElement | null = null;

afterEach(() => {
  cleanup();
  if (modalRoot && modalRoot.parentNode) {
    modalRoot.parentNode.removeChild(modalRoot);
  }
  modalRoot = null;
});

const renderUploadStep = () => {
  const tabularApi = createStubApi();
  modalRoot = document.createElement('div');
  document.body.appendChild(modalRoot);
  render(
    <ThemeProvider theme={createTheme()}>
      <TabularProvider tabularApi={tabularApi}>
        <TabularFileImportStep
          intialUploadMethod={'url'}
          pluginId="spreadsheet"
          onFileUploaded={vi.fn()}
          onError={vi.fn()}
          menuContainer={modalRoot}
        />
      </TabularProvider>
    </ThemeProvider>,
  );
};

describe('TabularFileUploadStep dropdowns', () => {
  it('opens Import Method menu on click', async () => {
    renderUploadStep();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/Import Method/i));

    expect(await screen.findByRole('option', { name: /URL Download/i })).toBeVisible();
    expect(await screen.findByRole('option', { name: /Local File/i })).toBeVisible();
  });

  it('opens Tabular Processing Options menus on click', async () => {
    renderUploadStep();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/Delimiter/i));
    expect(await screen.findByRole('option', { name: /Semicolon/ })).toBeVisible();

    await user.click(screen.getByLabelText(/Encoding/i));
    expect(await screen.findByRole('option', { name: /Windows-1252/i })).toBeVisible();
  });
});

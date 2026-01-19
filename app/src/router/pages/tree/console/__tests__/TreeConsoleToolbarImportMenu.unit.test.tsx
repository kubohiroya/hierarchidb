import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  TreeConsoleToolbar,
  type TreeConsoleToolbarProps,
} from '@hierarchidb/ui-treeconsole-toolbar';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

function renderToolbar(props?: Partial<TreeConsoleToolbarProps>) {
  const defaultController = {
    searchText: '',
    handleSearchTextChange: vi.fn(),
    handleSearchCommit: vi.fn(),
    onSearchModeChange: vi.fn(),
  };

  const defaultProps: TreeConsoleToolbarProps = {
    controller: defaultController,
    hasTrashItems: false,
    availableTemplates: [],
  };

  return render(
    <ThemeProvider theme={createTheme()}>
      <TreeConsoleToolbar {...defaultProps} {...props} />
    </ThemeProvider>
  );
}

describe('TreeConsoleToolbar import menu restrictions', () => {
  it('disables Import menu entries when allowImport is false', async () => {
    const onAction = vi.fn();
    renderToolbar({
      allowImport: false,
      onAction,
      availableTemplates: [{ id: 'template-1', label: 'Folder Template' }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'aria.importExportButton' }));

    const importItem = await screen.findByRole('menuitem', {
      name: 'importExportMenu.import',
    });
    expect(importItem).toHaveAttribute('aria-disabled', 'true');

    expect(
      screen.queryByRole('menuitem', {
        name: 'importExportMenu.importTemplate',
      })
    ).toBeNull();
  });

  it('enables Import menu entries when allowImport is true', async () => {
    const onAction = vi.fn();
    renderToolbar({
      allowImport: true,
      onAction,
      availableTemplates: [{ id: 'template-1', label: 'Folder Template' }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'aria.importExportButton' }));

    const templateItem = await screen.findByRole('menuitem', {
      name: 'importExportMenu.importTemplate',
    });
    expect(templateItem).not.toHaveAttribute('aria-disabled', 'true');

    const importItem = await screen.findByRole('menuitem', {
      name: 'importExportMenu.import',
    });
    expect(importItem).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(importItem);
    expect(onAction).toHaveBeenCalledWith('import', undefined);
  });

  it('hides developer IndexedDB reset option when developer mode is disabled', async () => {
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'aria.settingsButton' }));

    expect(
      screen.queryByRole('menuitem', {
        name: 'developerMenu.clearIndexedDb',
      })
    ).toBeNull();
  });

  it('emits clear-indexeddb action when developer option is clicked', async () => {
    const onAction = vi.fn();
    renderToolbar({ developerModeEnabled: true, onAction });

    fireEvent.click(screen.getByRole('button', { name: 'aria.settingsButton' }));

    expect(
      screen.queryByRole('menuitem', {
        name: 'developerMenu.clearIndexedDb',
      })
    ).toBeNull();
  });
});

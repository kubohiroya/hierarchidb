import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import {
  TreeConsoleToolbar,
  type TreeConsoleToolbarProps,
} from '../../../../../../../packages/ui/treeconsole/toolbar/src/index.ts';

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

    fireEvent.click(
      screen.getByRole('button', { name: 'treeConsole.toolbar.aria.importExportButton' })
    );

    const importItem = await screen.findByRole('menuitem', {
      name: 'treeConsole.toolbar.importExportMenu.import',
    });
    expect(importItem).toHaveAttribute('aria-disabled', 'true');

    const templateItem = await screen.findByRole('menuitem', {
      name: 'treeConsole.toolbar.importExportMenu.importTemplate',
    });
    expect(templateItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables Import menu entries when allowImport is true', async () => {
    const onAction = vi.fn();
    renderToolbar({
      allowImport: true,
      onAction,
      availableTemplates: [{ id: 'template-1', label: 'Folder Template' }],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'treeConsole.toolbar.aria.importExportButton' })
    );

    const templateItem = await screen.findByRole('menuitem', {
      name: 'treeConsole.toolbar.importExportMenu.importTemplate',
    });
    expect(templateItem).not.toHaveAttribute('aria-disabled', 'true');

    const importItem = await screen.findByRole('menuitem', {
      name: 'treeConsole.toolbar.importExportMenu.import',
    });
    expect(importItem).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(importItem);
    expect(onAction).toHaveBeenCalledWith('import', undefined);
  });
});

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
    hasArchiveItems: false,
    availableTemplates: [],
  };

  return render(
    <ThemeProvider theme={createTheme()}>
      <TreeConsoleToolbar {...defaultProps} {...props} />
    </ThemeProvider>
  );
}

describe('TreeConsoleToolbar import menu restrictions', () => {
  it('does not render Import/Export toolbar button', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'aria.importExportButton' })).toBeNull();
  });

  it('hides developer IndexedDB reset option when developer mode is disabled', async () => {
    renderToolbar();

    fireEvent.click(
      screen.getByRole('button', { name: 'treeConsole.toolbar.aria.settingsButton' })
    );

    expect(
      screen.queryByRole('menuitem', {
        name: 'developerMenu.clearIndexedDb',
      })
    ).toBeNull();
  });

  it('does not expose the legacy clear-indexeddb action in developer mode', async () => {
    const onAction = vi.fn();
    renderToolbar({ developerModeEnabled: true, onAction });

    fireEvent.click(
      screen.getByRole('button', { name: 'treeConsole.toolbar.aria.settingsButton' })
    );

    expect(
      screen.queryByRole('menuitem', {
        name: 'developerMenu.clearIndexedDb',
      })
    ).toBeNull();
  });
});

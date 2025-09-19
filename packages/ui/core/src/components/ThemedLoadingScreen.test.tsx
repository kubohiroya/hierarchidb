import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ThemedCircularProgress, ThemedLinearProgress, ThemedLoadingScreen } from './ThemedLoadingScreen.js';

const renderWithTheme = (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  const theme = createTheme({ palette: { mode } });
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('ThemedLoadingScreen', () => {
  it('renders linear and circular variants without errors', () => {
    const { rerender } = renderWithTheme(<ThemedLoadingScreen variant="linear" />);
    expect(screen.getByRole('progressbar', { name: /loading progress/i })).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <ThemedLoadingScreen variant="circular" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('progressbar', { name: /loading progress/i })).toBeInTheDocument();
  });

  it('shows message and children for circular variant', () => {
    renderWithTheme(
      <ThemedLoadingScreen variant="circular" message="Loading message">
        <div data-testid="child" />
      </ThemedLoadingScreen>,
    );
    expect(screen.getByText('Loading message')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('exports helper components that render successfully', () => {
    const { container } = renderWithTheme(<ThemedLinearProgress />);
    expect(container.firstChild).toBeInTheDocument();

    const { container: c2 } = renderWithTheme(<ThemedCircularProgress message="Hello" size={48} />);
    expect(c2.firstChild).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});


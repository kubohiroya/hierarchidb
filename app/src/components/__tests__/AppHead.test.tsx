import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mockConfig = {
  appPrefix: '/hierarchidb/',
  appName: 'HierarchiDB',
  appTitle: 'HierarchiDB',
  appDescription: 'Desc',
  appDetails: '',
  appHomepage: '',
  appLogo: 'logo.png',
  appFavicon: 'favicon.svg',
  appTheme: 'light',
  appLocale: 'en-US',
  appDefaultLocale: 'en-US',
  appDefaultLanguage: 'en',
  appAttribution: '',
};

describe('AppHead', () => {
  beforeEach(() => {
    vi.mock('~/contexts/AppConfigContext.js', () => ({
      useAppConfig: () => mockConfig,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('renders favicon links using resolved paths', async () => {
    const { AppHead } = await import('../AppHead.js');
    const { container } = render(<AppHead />);

    const svgLink = container.querySelector('link[rel="icon"][type="image/svg+xml"]');
    expect(svgLink?.getAttribute('href')).toBe('/hierarchidb/favicon.svg');

    const appleIcon = container.querySelector('link[rel="apple-touch-icon"]');
    expect(appleIcon?.getAttribute('href')).toBe('/hierarchidb/favicon.svg');
  });
});

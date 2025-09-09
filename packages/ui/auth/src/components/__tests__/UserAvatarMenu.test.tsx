/**
 * @file UserAvatarMenu.test.tsx
 * @description Test suite for UserAvatarMenu component with authentication integration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { UserAvatarMenu, UserProfile } from '../UserAvatarMenu';
import type { AuthContextProps } from 'react-oidc-context';

// Mock dependencies
vi.mock('../utils/logger', () => ({
  devError: vi.fn(),
}));

// Mock external components that are not implemented yet
vi.mock('../UserAvatar', () => ({
  UserAvatar: ({ pictureUrl, email, name, size }: any) => (
    <div
      data-testid="user-avatar"
      data-picture-url={pictureUrl}
      data-email={email}
      data-name={name}
      data-size={size}
    >
      Avatar
    </div>
  ),
}));

vi.mock('@hierarchidb/ui-core', () => ({
  DropdownMenu: ({ children, id, items }: any) => (
    <div data-testid="dropdown-menu" data-id={id}>
      {children}
      <div data-testid="dropdown-items">
        {items?.map((item: any, index: number) =>
          item ? (
            <button
              key={index}
              data-testid={`dropdown-item-${index}`}
              onClick={item.onClick}
              style={{ color: item.color === 'error' ? 'red' : 'inherit' }}
            >
              {item.icon}
              {item.label || item.name}
            </button>
          ) : (
            <hr key={index} data-testid={`dropdown-separator-${index}`} />
          ),
        )}
      </div>
    </div>
  ),
}));

// Mock provider-oidc-context
vi.mock('provider-oidc-context', () => ({
  withAuth: (component: any) => component,
}));

const mockUseAuth = {
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock browser APIs
const mockCaches = {
  keys: vi.fn(),
  delete: vi.fn(),
};

const mockIndexedDB = {
  databases: vi.fn(),
  deleteDatabase: vi.fn(),
};

describe('UserProfile', () => {
  const theme = createTheme();
  let originalWindow: typeof window;

  const mockAuthenticatedUser: AuthContextProps = {
    user: {
      profile: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        picture: 'https://example.com/avatar.jpg',
        sub: '123456',
        iss: 'https://example.com',
        aud: 'client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      access_token: 'mock-access-token',
      id_token: 'mock-id-token',
      expires_at: Date.now() + 3600000,
      scope: 'openid profile email',
      token_type: 'Bearer',
      session_state: 'mock-session-state',
      state: 'mock-state',
      expires_in: 3600,
      expired: false,
      scopes: ['openid', 'profile', 'email'],
      toStorageString: () => 'mock-storage-string',
    },
    isAuthenticated: true,
    isLoading: false,
    activeNavigator: 'signinSilent',
    signinRedirect: vi.fn(),
    signinPopup: vi.fn(),
    signinSilent: vi.fn(),
    signoutRedirect: vi.fn(),
    signoutPopup: vi.fn(),
    signoutSilent: vi.fn(),
    removeUser: vi.fn(),
    clearStaleState: vi.fn(),
    querySessionStatus: vi.fn(),
    revokeTokens: vi.fn(),
    startSilentRenew: vi.fn(),
    stopSilentRenew: vi.fn(),
    events: {} as any,
    settings: {} as any,
    signinResourceOwnerCredentials: vi.fn(),
  };

  const mockUnauthenticatedUser: AuthContextProps = {
    ...mockAuthenticatedUser,
    user: null,
    isAuthenticated: false,
  };

  const renderWithTheme = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };

  beforeEach(() => {
    originalWindow = globalThis.window;

    // Mock browser APIs
    Object.assign(globalThis.window, {
      ...originalWindow,
      caches: mockCaches as any,
      indexedDB: mockIndexedDB as any,
      location: {
        ...originalWindow.location,
        reload: vi.fn(),
      },
      localStorage: {
        clear: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('Unauthenticated State', () => {
    it('should render login button when user is not authenticated', () => {
      renderWithTheme(<UserProfile auth={mockUnauthenticatedUser} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      expect(loginButton).toBeInTheDocument();
      expect(loginButton).toHaveTextContent('LOGIN');
    });

    it('should call signIn when login button is clicked', async () => {
      renderWithTheme(<UserProfile auth={mockUnauthenticatedUser} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockUseAuth.login).toHaveBeenCalledOnce();
      });
    });

    it('should display login icon in login button', () => {
      renderWithTheme(<UserProfile auth={mockUnauthenticatedUser} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      expect(loginButton).toBeInTheDocument();
      // Check that the button contains the login icon (MUI icons render as SVGs)
      expect(loginButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    it('should render user profile when user is authenticated', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    });

    it('should display user avatar with correct props', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toHaveAttribute('data-picture-url', 'https://example.com/avatar.jpg');
      expect(avatar).toHaveAttribute('data-email', 'john.doe@example.com');
      expect(avatar).toHaveAttribute('data-name', 'John Doe');
      expect(avatar).toHaveAttribute('data-size', '32');
    });

    it('should render dropdown menu with correct items', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const dropdownItems = screen.getByTestId('dropdown-items');
      expect(dropdownItems).toBeInTheDocument();

      // Check for logout option
      expect(screen.getByTestId('dropdown-item-0')).toHaveTextContent('Logout');

      // Check for separator
      expect(screen.getByTestId('dropdown-separator-1')).toBeInTheDocument();

      // Check for clear cache option
      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      expect(clearCacheButton).toHaveTextContent('Clear All Cache');
      expect(clearCacheButton).toHaveStyle({ color: 'red' });
    });

    it('should call signOut when logout is clicked', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const logoutButton = screen.getByTestId('dropdown-item-0');
      fireEvent.click(logoutButton);

      expect(mockUseAuth.logout).toHaveBeenCalledOnce();
    });

    it('should set button title with user name and email', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const userButton = screen.getByTitle('John Doe john.doe@example.com');
      expect(userButton).toBeInTheDocument();
    });
  });

  describe('Clear Cache Functionality', () => {
    beforeEach(() => {
      mockCaches.keys.mockResolvedValue(['cache1', 'cache2']);
      mockCaches.delete.mockResolvedValue(true);
      mockIndexedDB.databases.mockResolvedValue([
        { name: 'db1', version: 1 },
        { name: 'db2', version: 2 },
      ]);
    });

    it('should open clear cache base-dialog when menu item is clicked', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      expect(screen.getByText('Clear All Cache Data?')).toBeInTheDocument();
      expect(screen.getByText(/This will clear all cached data including:/)).toBeInTheDocument();
    });

    it('should close base-dialog when cancel is clicked', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      // Open base-dialog
      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      // Close base-dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Clear All Cache Data?')).not.toBeInTheDocument();
    });

    it('should clear all cache types when confirmed', async () => {
      const mockDeleteRequest = {
        onsuccess: null as any,
        onerror: null as any,
      };
      mockIndexedDB.deleteDatabase.mockReturnValue(mockDeleteRequest);

      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      // Open base-dialog
      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      // Confirm clear
      const confirmButton = screen.getByRole('button', { name: /clear cache/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockCaches.keys).toHaveBeenCalled();
        expect(mockCaches.delete).toHaveBeenCalledWith('cache1');
        expect(mockCaches.delete).toHaveBeenCalledWith('cache2');
        expect(mockIndexedDB.databases).toHaveBeenCalled();
        expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('db1');
        expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('db2');
        expect(globalThis.window.localStorage.clear).toHaveBeenCalled();
      });

      // Simulate successful IndexedDB deletion
      if (mockDeleteRequest.onsuccess) {
        mockDeleteRequest.onsuccess();
      }

      await waitFor(() => {
        expect(globalThis.window.location.reload).toHaveBeenCalled();
      });
    });

    it('should handle errors during cache clearing', async () => {
      const { devError } = require('../utils/logger');
      mockCaches.keys.mockRejectedValue(new Error('Cache error'));

      // Mock window.alert
      globalThis.window.alert = vi.fn();

      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      // Open base-dialog and confirm
      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      const confirmButton = screen.getByRole('button', { name: /clear cache/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(devError).toHaveBeenCalledWith('Failed to clear cache:', expect.any(Error));
        expect(globalThis.window.alert).toHaveBeenCalledWith(
          'Failed to clear some cache data. Please try again.',
        );
      });
    });

    it('should handle databases without names', async () => {
      mockIndexedDB.databases.mockResolvedValue([
        { name: 'db1', version: 1 },
        { name: null, version: 2 }, // Database without name
        { name: 'db3', version: 3 },
      ]);

      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      const confirmButton = screen.getByRole('button', { name: /clear cache/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('db1');
        expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('db3');
        expect(mockIndexedDB.deleteDatabase).not.toHaveBeenCalledWith(null);
      });
    });
  });

  describe('Dialog Accessibility', () => {
    it('should have proper ARIA labels on clear cache base-dialog', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'clear-cache-base-dialog-title');

      const dialogContent = screen.getByText(/This will clear all cached data including:/);
      expect(dialogContent).toHaveAttribute('id', 'clear-cache-base-dialog-description');
    });

    it('should focus confirm button by default', () => {
      renderWithTheme(<UserProfile auth={mockAuthenticatedUser} />);

      const clearCacheButton = screen.getByTestId('dropdown-item-2');
      fireEvent.click(clearCacheButton);

      const confirmButton = screen.getByRole('button', { name: /clear cache/i });
      expect(confirmButton).toHaveAttribute('autoFocus');
    });
  });
});

describe('UserAvatarMenu', () => {
  it('should export UserAvatarMenu as a React component', () => {
    expect(UserAvatarMenu).toBeDefined();
    expect(typeof UserAvatarMenu).toBe('function');
  });

  it('should be a function (wrapped with HOC)', () => {
    // Since we're mocking withAuth, we just verify the export is a function
    // The actual HOC wrapping would be tested in integration tests
    expect(typeof UserAvatarMenu).toBe('function');
  });
});

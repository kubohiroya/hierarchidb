/**
 * Vitest Test Setup
 * Jest完全排除、Vitestネイティブ設定
 */

// @testing-library/jest-dom matchers (Vitestでも互換使用可能)
import '@testing-library/jest-dom';

// Vitestグローバル設定
import { vi } from 'vitest';

// WebAPIモック (VitestのviでJest.mockを置換)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ResizeObserver mock (Vitestのvi.fn()使用)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver mock (Vitestのvi.fn()使用)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

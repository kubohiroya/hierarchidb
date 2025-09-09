/**
  * Vitest Test Setup
 * JestVitest
  */

//  @testing-library/jest-dom matchers (Vitest)
import '@testing-library/jest-dom';

//  Vitest
import { vi } from 'vitest';

//  WebAPI (VitestviJest.mock)
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

//  ResizeObserver mock (Vitestvi.fn())
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

//  IntersectionObserver mock (Vitestvi.fn())
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

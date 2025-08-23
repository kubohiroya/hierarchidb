/**
 * @file i18nLogger.test.ts
 * @description Tests for i18n logging utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as i18nLogger from './i18nLogger';

// Mock i18next
vi.mock('../i18n', () => ({
  default: {
    t: vi.fn((key: string, options?: any) => {
      // Simple mock implementation
      const mockTranslations: Record<string, string> = {
        'common.enabled': 'ENABLED',
        'common.disabled': 'DISABLED',
        'api.request': 'API Request',
        'errors.assertionFailed': 'Assertion failed',
      };

      if (options && typeof options === 'object') {
        let text = mockTranslations[key] || key;
        Object.entries(options).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
        return text;
      }

      return mockTranslations[key] || key;
    }),
  },
}));

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  group: vi.fn(),
  groupCollapsed: vi.fn(),
  groupEnd: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn(),
};

// Replace global console
Object.assign(console, mockConsole);

describe('i18nLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('in development mode', () => {
    it('should log translated messages', () => {
      i18nLogger.i18nLog('common.enabled');
      expect(mockConsole.log).toHaveBeenCalledWith('ENABLED');
    });

    it('should warn with translated messages', () => {
      i18nLogger.i18nWarn('common.disabled');
      expect(mockConsole.warn).toHaveBeenCalledWith('DISABLED');
    });

    it('should error with translated messages', () => {
      i18nLogger.i18nError('api.request');
      expect(mockConsole.error).toHaveBeenCalledWith('API Request');
    });

    it('should support interpolation', () => {
      i18nLogger.i18nLog('test.interpolation', { name: 'John' });
      expect(mockConsole.log).toHaveBeenCalledWith('test.interpolation');
    });

    it('should handle feature logging', () => {
      i18nLogger.i18nFeature('testFeature', true);
      expect(mockConsole.log).toHaveBeenCalledWith('✅ Feature testFeature:', 'ENABLED');
    });

    it('should handle API logging', () => {
      i18nLogger.i18nAPI.request('/test', { method: 'GET' });
      expect(mockConsole.log).toHaveBeenCalledWith('🌐 API Request:', '/test', { method: 'GET' });
    });

    it('should handle assertion logging', () => {
      i18nLogger.i18nAssert(false, 'errors.assertionFailed');
      expect(mockConsole.error).toHaveBeenCalledWith('❌ Assertion failed:', 'Assertion failed');
    });
  });

  describe('conditional logging', () => {
    it('should log when condition is true', () => {
      i18nLogger.i18nLogIf(true, 'common.enabled');
      expect(mockConsole.log).toHaveBeenCalledWith('ENABLED');
    });

    it('should not log when condition is false', () => {
      i18nLogger.i18nLogIf(false, 'common.enabled');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });
});

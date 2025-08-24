/**
 * @file workerLogger.ts
 * @description Simple i18n logging for worker environment
 *
 * Worker environment has limited access to full i18next setup,
 * so we use a simplified translation system for logging.
 */

// Simple translation map for worker logging
const translations = {
  en: {
    'worker.initialized': 'Worker API initialized',
    'worker.initializationFailed': 'Failed to initialize Worker API',
    'worker.processingCommand': 'Processing command',
    'worker.commandCompleted': 'Command completed',
    'worker.commandFailed': 'Command failed',
  },
  ja: {
    'worker.initialized': 'Worker API が初期化されました',
    'worker.initializationFailed': 'Worker API の初期化に失敗しました',
    'worker.processingCommand': 'コマンドを処理中',
    'worker.commandCompleted': 'コマンド処理完了',
    'worker.commandFailed': 'コマンド処理失敗',
  },
};

// Get current language from localStorage or default to English
const getCurrentLanguage = (): 'en' | 'ja' => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null;
    return stored === 'ja' ? 'ja' : 'en';
  } catch {
    return 'en';
  }
};

// Simple translation function
const t = (key: string, interpolations?: Record<string, any>): string => {
  const currentLang = getCurrentLanguage();
  let text = translations[currentLang][key as keyof (typeof translations)['en']] || key;

  if (interpolations) {
    Object.entries(interpolations).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }

  return text;
};

// Worker logging functions with i18n
export const workerLog = (
  key: string,
  interpolations?: Record<string, any>,
  ...args: unknown[]
) => {
  console.log(t(key, interpolations), ...args);
};

export const workerError = (
  key: string,
  interpolations?: Record<string, any>,
  ...args: unknown[]
) => {
  console.error(t(key, interpolations), ...args);
};

export const workerWarn = (
  key: string,
  interpolations?: Record<string, any>,
  ...args: unknown[]
) => {
  console.warn(t(key, interpolations), ...args);
};

export const workerInfo = (
  key: string,
  interpolations?: Record<string, any>,
  ...args: unknown[]
) => {
  console.info(t(key, interpolations), ...args);
};

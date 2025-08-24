# @hierarchidb/ui-i18n

Internationalization (i18n) package for HierarchiDB, providing comprehensive translation support for both UI components and console logging.

## Features

- **Complete i18n setup** with i18next and react-i18next
- **LanguageProvider** with theme integration
- **Internationalized console logging** for development
- **Pre-configured translations** for English and Japanese
- **Worker-compatible logging** for service workers
- **TypeScript support** with full type safety

## Quick Start

### 1. Setup LanguageProvider

Wrap your app with the LanguageProvider:

```tsx
import { LanguageProvider } from '@hierarchidb/ui-i18n';

function App() {
  return (
    <LanguageProvider>
      <YourAppComponent />
    </LanguageProvider>
  );
}
```

### 2. Using Translations in Components

```tsx
import { useTranslation } from '@hierarchidb/ui-i18n';

function MyComponent() {
  const { t } = useTranslation('common');
  
  return (
    <button aria-label={t('auth.login')}>
      {t('navigation.theme')}
    </button>
  );
}
```

### 3. Using i18n Console Logging

Replace regular console logging with i18n versions:

```tsx
import { i18nLog, i18nError, i18nWarn } from '@hierarchidb/ui-i18n';

// Instead of: console.log('Feature enabled')
i18nLog('common.enabled');

// Instead of: console.error('API request failed')
i18nError('api.error');

// Feature flag logging
i18nFeature('darkMode', true);

// API logging
i18nAPI.request('/api/users', { method: 'GET' });
```

### 4. Worker Environment Logging

For service workers or web workers:

```tsx
import { workerLog, workerError } from '@hierarchidb/ui-i18n/worker';

workerLog('worker.initialized');
workerError('worker.initializationFailed');
```

## Available Translation Keys

### Authentication
- `auth.login` - Login button
- `auth.logout` - Logout button  
- `auth.userMenu` - User menu aria-label
- `auth.authMethod` - Authentication method label
- `auth.popup` - Popup method
- `auth.redirect` - Redirect method

### Navigation
- `navigation.language` - Language selector
- `navigation.theme` - Theme selector

### Common
- `common.enabled` - Feature enabled status
- `common.disabled` - Feature disabled status
- `common.loading` - Loading state
- `common.error` - Error state

### API
- `api.request` - API request logging
- `api.response` - API response logging
- `api.error` - API error logging

### Errors
- `errors.assertionFailed` - Assertion failure
- `errors.failedToClearData` - Cache clear failure
- `errors.languageNotSupported` - Language not supported

## Logging Functions

### Basic Logging
- `i18nLog(key, options?, ...args)` - Translated console.log
- `i18nWarn(key, options?, ...args)` - Translated console.warn  
- `i18nError(key, options?, ...args)` - Translated console.error
- `i18nInfo(key, options?, ...args)` - Translated console.info
- `i18nDebug(key, options?, ...args)` - Translated console.debug

### Specialized Logging
- `i18nFeature(name, enabled, ...args)` - Feature flag logging
- `i18nAPI.request(url, options)` - API request logging
- `i18nAPI.response(url, status, data)` - API response logging
- `i18nAPI.error(url, error)` - API error logging
- `i18nAssert(condition, messageKey, options, ...args)` - Assertion logging

### Conditional Logging
- `i18nLogIf(condition, key, options?, ...args)` - Conditional log
- `i18nWarnIf(condition, key, options?, ...args)` - Conditional warn
- `i18nErrorIf(condition, key, options?, ...args)` - Conditional error

### Performance Logging
- `i18nPerf(labelKey, fn, options?)` - Sync performance timing
- `i18nPerfAsync(labelKey, fn, options?)` - Async performance timing

## Language Support

Currently supported languages:
- **English** (en) - Default
- **Japanese** (ja)

### Adding New Languages

1. Create translation files in `public/locales/{lang}/common.json`
2. Update supported languages in `LanguageProvider.tsx`
3. Add date-fns locale import

```tsx
// In LanguageProvider.tsx
import { fr } from 'date-fns/locale';

const SUPPORTED_LANGUAGES = [
  // ... existing languages
  {
    code: "fr",
    name: "French", 
    nativeName: "Français",
    flag: "🇫🇷",
    direction: "ltr",
    dateLocale: fr,
  }
];
```

## Migration Guide

### From Regular Console Logging

```tsx
// Before
console.log('User authenticated');
console.error('Authentication failed:', error);

// After  
i18nLog('auth.userAuthenticated');
i18nError('auth.authenticationFailed', {}, error);
```

### From Hardcoded UI Text

```tsx
// Before
<button aria-label="Login">Login</button>

// After
<button aria-label={t('auth.login')}>
  {t('auth.login')}
</button>
```

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm run typecheck
```

### Building
```bash
pnpm run build
```

## Architecture

The i18n system is built on:
- **i18next** - Core translation engine
- **react-i18next** - React integration
- **i18next-browser-languagedetector** - Automatic language detection
- **i18next-http-backend** - Translation file loading

Console logging preserves source location using `console.log.bind(console)` pattern while adding translation support.
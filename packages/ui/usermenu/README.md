# @hierarchidb/ui-usermenu

User menu component that integrates authentication, theme management, language selection, and system utilities.

## Features

This package provides a comprehensive user menu component that combines functionality from multiple UI packages:

- **Authentication**: Login/logout functionality (from @hierarchidb/ui-auth)
- **Theme Management**: Light/dark/system theme switching (from @hierarchidb/ui-theme)  
- **Internationalization**: Language selection (from @hierarchidb/ui-i18n)
- **System Utilities**: Memory monitor, cache clearing (development features)

## Components

- `UserLoginButton`: Main user menu component with all integrated features

## Dependencies

This package integrates functionality from:
- `@hierarchidb/ui-auth` - Authentication components and hooks
- `@hierarchidb/ui-theme` - Theme management utilities  
- `@hierarchidb/ui-i18n` - Internationalization support

## Usage

```tsx
import { UserLoginButton } from '@hierarchidb/ui-usermenu';

function App() {
  return (
    <div>
      <UserLoginButton />
    </div>
  );
}
```

## Design Philosophy

This component separates concerns properly unlike monolithic implementations:
- Presentation logic is contained within the component
- Business logic is handled by the respective UI packages
- State management is distributed across appropriate domains (auth, theme, i18n)
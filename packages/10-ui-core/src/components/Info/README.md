# Info Components

A collection of generic, reusable components for displaying application information, licenses, and help content.

## Components

### InfoDialog

A modal dialog for displaying information with customizable content and actions.

```tsx
import { InfoDialog } from '@hierarchidb/ui-core';

function MyApp() {
  const [open, setOpen] = useState(false);
  
  return (
    <InfoDialog
      open={open}
      onClose={() => setOpen(false)}
      title="About MyApp"
      fullScreen={true}
    >
      <MyAppInfo />
    </InfoDialog>
  );
}
```

### InfoContent

A structured component for displaying application information with logo, title, description, and links.

```tsx
import { InfoContent } from '@hierarchidb/ui-core';

function MyAppInfo() {
  return (
    <InfoContent
      logo={<MyAppLogo />}
      title="MyApp"
      description="An amazing application"
      details="Built with love and care"
      attribution="© 2024 MyCompany"
      githubUrl="https://github.com/mycompany/myapp"
    />
  );
}
```

### InfoPanel

A panel with information content and optional action buttons.

```tsx
import { InfoPanel } from '@hierarchidb/ui-core';

function MyInfoPanel() {
  return (
    <InfoPanel
      showActions={true}
      onInfoClick={() => navigate('/info')}
      onHelpClick={() => startTour()}
    >
      <MyAppInfo />
    </InfoPanel>
  );
}
```

### LicenseInfo

A comprehensive license information display with search, sort, and expand functionality.

```tsx
import { LicenseInfo } from '@hierarchidb/ui-core';
import licenseData from './licenses.json';

function MyLicenseInfo() {
  return (
    <LicenseInfo
      licenseData={licenseData}
      title="Open Source Licenses"
      showSearch={true}
      showCount={true}
    />
  );
}
```

## Complete Example

Here's how to combine these components for a complete info page:

```tsx
import { useState, lazy, Suspense } from 'react';
import { 
  InfoDialog, 
  InfoContent, 
  InfoPanel,
  LicenseInfo 
} from '@hierarchidb/ui-core';
import { Alert, LinearProgress, Box } from '@mui/material';
import licenseData from './licenses.json';

// Lazy load license data if it's large
const LazyLicenseInfo = lazy(() => 
  import('./licenses.json').then(module => ({
    default: () => <LicenseInfo licenseData={module.default} />
  }))
);

function InfoPage() {
  const navigate = useNavigate();
  
  return (
    <InfoDialog
      open={true}
      onClose={() => navigate('/')}
      title="About HierarchiDB"
      fullScreen={true}
    >
      <Box sx={{ width: '100%' }}>
        <InfoContent
          logo={<HierarchiDBLogo />}
          title="HierarchiDB"
          description="High-performance tree-structured data management framework"
          details="A powerful framework for managing hierarchical data in browser environments"
          attribution="Developed by Hiroya Kubo"
          githubUrl="https://github.com/kubohiroya/hierarchidb"
        />
        
        <Alert severity="info" sx={{ mt: 4 }}>
          <Suspense fallback={<LinearProgress />}>
            <LazyLicenseInfo />
          </Suspense>
        </Alert>
      </Box>
    </InfoDialog>
  );
}
```

## Customization

All components support extensive customization through props:

- **Styling**: Colors, typography variants, spacing
- **Content**: Titles, descriptions, icons, logos
- **Behavior**: Search, sort, expand/collapse
- **Actions**: Custom buttons and callbacks

## License Data Format

The `LicenseInfo` component expects license data in this format:

```json
{
  "package-name@version": {
    "licenses": "MIT",
    "repository": "https://github.com/...",
    "publisher": "Author Name",
    "email": "author@example.com",
    "url": "https://package-homepage.com",
    "licenseFile": "path/to/LICENSE"
  }
}
```

This can be generated using tools like `license-checker`:

```bash
npx license-checker --json > licenses.json
```
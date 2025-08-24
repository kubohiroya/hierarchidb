# FileInputWithUrl Component

A reusable component that combines file upload, drag & drop, and URL download functionality.

## Features

- File selection via button click
- Drag and drop file upload
- URL download with CORS proxy support
- Loading states and error handling
- Customizable file types and labels
- Built-in validation

## Usage

```tsx
import { FileInputWithUrl } from "@/containers/ui/FileInputWithUrl";

// Basic usage
<FileInputWithUrl
  onFileSelect={handleFile}
  accept=".csv,.xlsx"
  buttonLabel="Select File"
  supportedFormatsText="Supported: CSV, Excel"
/>

// With URL download disabled
<FileInputWithUrl
  onFileSelect={handleFile}
  accept=".json"
  buttonLabel="Upload JSON"
  showUrlDownload={false}
/>

// With custom URL handler
<FileInputWithUrl
  onFileSelect={handleFile}
  onUrlDownload={handleCustomUrlDownload}
  accept=".zip"
/>

// With custom instructions
<FileInputWithUrl
  onFileSelect={handleFile}
  instructions={
    <Typography>
      Upload your data file or paste a URL
    </Typography>
  }
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onFileSelect` | `(file: File) => void \| Promise<void>` | **required** | Callback when file is selected |
| `accept` | `string` | `"*"` | Accepted file types (e.g., ".csv,.xlsx") |
| `buttonLabel` | `string` | `"Select File"` | Label for the file selection button |
| `supportedFormatsText` | `string` | - | Description of supported formats |
| `loading` | `boolean` | `false` | Loading state |
| `error` | `string \| null` | `null` | Error message to display |
| `showUrlDownload` | `boolean` | `true` | Show URL download option |
| `instructions` | `ReactNode` | - | Custom instructions |
| `disabled` | `boolean` | `false` | Disable the component |
| `sx` | `object` | - | Additional MUI styles |
| `onUrlDownload` | `(url: string) => Promise<void>` | - | Custom URL download handler |

## Example Implementation

```tsx
const MyComponent = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setLoading(true);
    setError(null);
    
    try {
      // Process the file
      await processFile(selectedFile);
      setFile(selectedFile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FileInputWithUrl
      onFileSelect={handleFileSelect}
      accept=".csv,.xlsx,.xls,.zip"
      buttonLabel="Upload Data File"
      supportedFormatsText="Supported: CSV, Excel, ZIP archives"
      loading={loading}
      error={error}
    />
  );
};
```

## Notes

- The component automatically handles CORS proxy for URL downloads when needed
- File validation is performed based on the `accept` prop
- Drag and drop is fully integrated with visual feedback
- Authentication tokens are automatically included for CORS proxy requests
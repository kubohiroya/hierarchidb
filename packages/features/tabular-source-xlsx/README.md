@hierarchidb/tabular-source-xlsx
===============================

Optional XLSX parser for `@hierarchidb/tabular-source`. Keeps Excel support out of the core bundle unless installed.

## How it works
- Depends on `xlsx`.
- `installTabularXlsx()` registers an XLSX parser in the tabular registry.
- Runtime-worker attempts dynamic import; if present, Excel parsing is enabled.

## Usage
```ts
import { installTabularXlsx } from '@hierarchidb/tabular-source-xlsx';
installTabularXlsx(); // once at startup
```

## Notes / roadmap
- Reads the first worksheet, yields row-oriented chunks.
- For very large XLSX, consider converting to CSV for performance.
- Future: sheet selection, better date/number inference.

@hierarchidb/tabular-xlsx
=========================

Optional XLSX parser for `@hierarchidb/tabular`. Installs an Excel parser into the core registry without bloating the core bundle when Excel is not required.

Why optional?
-------------
XLSX libraries are sizable. Keeping Excel support in a separate package allows projects that do not need it to stay lean.

How it works
------------
- Dependency: `xlsx`
- Exports `installTabularXlsx()` which registers an `xlsx` parser with the core `@hierarchidb/tabular` registry.
- The runtime-worker tries dynamic import; if present, Excel becomes available.

Usage
-----
```ts
import { installTabularXlsx } from '@hierarchidb/tabular-source-xlsx';
installTabularXlsx(); // once at startup
```

Notes
-----
- The parser reads the first worksheet and produces row-oriented JSON, then yields chunks.
- For very large .xlsx files, consider pre-converting to CSV for best performance.

Roadmap
-------
- Sheet selection option
- Basic type inference for dates/numbers


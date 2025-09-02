@hierarchidb/download
======================

Reliable download foundation with resume-ready design. Provides a Facade + Ports for network, storage, and integrity so environments can plug in the right implementations (browser, worker, server).

Goals
-----
- Centralize download logic: retries, range support, integrity verification, and progress.
- Keep network and storage pluggable, allowing IndexedDB/Cache API/FS in different builds.

Architecture
------------
- Facade: `DownloadService`
- Ports: `NetworkPort`, `StoragePort`, `IntegrityPort`
- Today: minimal serial download; multi-part range and resume are planned.

Quick start
-----------
```ts
import { DownloadService } from '@hierarchidb/download';

const svc = new DownloadService(myNetworkPort, myStoragePort, myIntegrityPort);
const res = await svc.download('https://example.com/data.csv', 'file-001', { expectedHash: undefined });
console.log(res);
```

Usage notes
-----------
- Provide `NetworkPort` wrappers over `fetch` (or Axios) and a `StoragePort` (e.g., IndexedDB buckets) for persistence.
- Integrity is optional; WebCrypto SHA-256 is recommended.

Roadmap
-------
- HTTP range-based multi-part downloads
- Bandwidth/concurrency limits and per-host throttling
- Zip/tar/gzip processors as optional steps


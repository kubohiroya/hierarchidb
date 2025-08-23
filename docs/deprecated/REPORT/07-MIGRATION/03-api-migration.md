# API Migration

## Overview

This document covers API migration strategies when transitioning between different API versions or architectures in HierarchiDB, including backward compatibility, deprecation strategies, and client migration approaches.

## Prerequisites

- Understanding of current API architecture
- Knowledge of Comlink RPC patterns
- Familiarity with TypeScript interfaces

## When to Read This Document

- When planning API breaking changes
- When implementing backward compatibility layers
- When migrating from direct to RPC-based APIs

## API Evolution Strategy

### Semantic Versioning

```typescript
// api-version.ts
export const API_VERSION = {
  major: 2,  // Breaking changes
  minor: 1,  // New features (backward compatible)
  patch: 3,  // Bug fixes
  
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  
  isCompatible(clientVersion: string): boolean {
    const [major] = clientVersion.split('.').map(Number);
    return major === this.major;
  }
};
```

### API Lifecycle Stages

```typescript
enum APIStatus {
  EXPERIMENTAL = 'experimental',  // May change without notice
  STABLE = 'stable',              // Production ready
  DEPRECATED = 'deprecated',      // Will be removed
  REMOVED = 'removed'             // No longer available
}

interface APIEndpoint {
  path: string;
  status: APIStatus;
  since: string;
  deprecatedIn?: string;
  removedIn?: string;
  replacement?: string;
}
```

## Migration from Direct to Worker API

### Legacy Direct API (v1.x)

```typescript
// v1: Direct database access
import { Dexie } from 'dexie';

class LegacyTreeService {
  private db: Dexie;
  
  async createNode(data: NodeData): Promise<TreeNode> {
    return await this.db.table('nodes').add(data);
  }
  
  async updateNode(id: string, data: Partial<NodeData>): Promise<void> {
    await this.db.table('nodes').update(id, data);
  }
  
  async deleteNode(id: string): Promise<void> {
    await this.db.table('nodes').delete(id);
  }
}
```

### Modern Worker API (v2.x)

```typescript
// v2: Worker-based API via Comlink
import * as Comlink from 'comlink';
import { WorkerAPI } from '@hierarchidb/api';

// Worker implementation
class WorkerAPIImpl implements WorkerAPI {
  async createNode(data: CreateNodeRequest): Promise<TreeNode> {
    // Validate request
    this.validateNodeData(data);
    
    // Process in worker thread
    const node = await this.nodeHandler.create(data);
    
    // Emit events
    await this.eventEmitter.emit('node:created', node);
    
    return node;
  }
  
  async updateNode(request: UpdateNodeRequest): Promise<TreeNode> {
    const { nodeId, updates } = request;
    
    // Create working copy
    const workingCopy = await this.workingCopyHandler.create(nodeId);
    
    // Apply updates
    await this.workingCopyHandler.update(workingCopy.id, updates);
    
    // Commit changes
    return await this.workingCopyHandler.commit(workingCopy.id);
  }
}

// Expose via Comlink
Comlink.expose(new WorkerAPIImpl(), self);
```

### Migration Adapter

```typescript
// migration-adapter.ts
export class APICompatibilityAdapter {
  private legacyAPI: LegacyTreeService;
  private workerAPI: WorkerAPI;
  
  constructor() {
    // Initialize based on available API
    if (this.isWorkerSupported()) {
      this.initializeWorkerAPI();
    } else {
      this.initializeLegacyAPI();
    }
  }
  
  async createNode(data: NodeData): Promise<TreeNode> {
    // Route to appropriate API
    if (this.workerAPI) {
      return await this.workerAPI.createNode({
        ...data,
        nodeId: data.id as NodeId,
        parentNodeId: data.parentId as NodeId
      });
    } else {
      // Fallback to legacy
      console.warn('Using legacy API - consider upgrading');
      return await this.legacyAPI.createNode(data);
    }
  }
  
  private isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined' && 
           typeof SharedArrayBuffer !== 'undefined';
  }
}
```

## Deprecation Strategy

### Deprecation Decorator

```typescript
// deprecation.ts
export function deprecated(
  message: string,
  removeInVersion?: string
): MethodDecorator {
  return function(
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      console.warn(
        `⚠️ ${String(propertyKey)} is deprecated: ${message}` +
        (removeInVersion ? ` Will be removed in v${removeInVersion}` : '')
      );
      
      // Track usage for metrics
      trackDeprecatedUsage(String(propertyKey));
      
      return original.apply(this, args);
    };
    
    return descriptor;
  };
}

// Usage
class TreeAPI {
  @deprecated('Use createNode instead', '3.0.0')
  async addNode(data: any): Promise<any> {
    return this.createNode(data);
  }
  
  async createNode(data: CreateNodeRequest): Promise<TreeNode> {
    // Current implementation
  }
}
```

### Gradual Migration Path

```typescript
// gradual-migration.ts
export class GradualMigrationAPI {
  private version: string;
  
  constructor(clientVersion?: string) {
    this.version = clientVersion || API_VERSION.toString();
  }
  
  async createNode(data: any): Promise<any> {
    // Version-specific handling
    const [major] = this.version.split('.').map(Number);
    
    switch(major) {
      case 1:
        // v1 API shape
        return await this.createNodeV1(data);
      
      case 2:
        // v2 API shape with validation
        return await this.createNodeV2(data);
      
      default:
        throw new Error(`Unsupported API version: ${this.version}`);
    }
  }
  
  private async createNodeV1(data: V1NodeData): Promise<V1Node> {
    // Transform to v2
    const v2Data = this.transformV1ToV2(data);
    const v2Node = await this.createNodeV2(v2Data);
    
    // Transform response back to v1
    return this.transformV2ToV1(v2Node);
  }
  
  private async createNodeV2(data: V2NodeData): Promise<V2Node> {
    // Current implementation
    return await this.workerAPI.createNode(data);
  }
}
```

## Breaking Changes Management

### Version Detection

```typescript
// version-detector.ts
export class VersionDetector {
  static async detectClientVersion(
    request: Request
  ): Promise<string> {
    // Check header
    const headerVersion = request.headers.get('X-API-Version');
    if (headerVersion) return headerVersion;
    
    // Check query parameter
    const url = new URL(request.url);
    const queryVersion = url.searchParams.get('api_version');
    if (queryVersion) return queryVersion;
    
    // Check user agent
    const userAgent = request.headers.get('User-Agent');
    const match = userAgent?.match(/HierarchiDB\/(\d+\.\d+\.\d+)/);
    if (match) return match[1];
    
    // Default to latest
    return API_VERSION.toString();
  }
}
```

### Feature Flags

```typescript
// feature-flags.ts
export class FeatureFlags {
  private flags: Map<string, boolean> = new Map();
  
  constructor(private clientVersion: string) {
    this.initializeFlags();
  }
  
  private initializeFlags() {
    const [major, minor] = this.clientVersion.split('.').map(Number);
    
    // Enable features based on version
    this.flags.set('workingCopyPattern', major >= 2);
    this.flags.set('brandedTypes', major >= 2);
    this.flags.set('subscriptions', major >= 2 && minor >= 1);
    this.flags.set('bulkOperations', major >= 2 && minor >= 2);
  }
  
  isEnabled(feature: string): boolean {
    return this.flags.get(feature) || false;
  }
  
  requireFeature(feature: string): void {
    if (!this.isEnabled(feature)) {
      throw new Error(
        `Feature '${feature}' requires API version 2.1.0 or higher`
      );
    }
  }
}
```

## Client Migration

### SDK Version Management

```typescript
// sdk-client.ts
export class HierarchiDBClient {
  private apiVersion: string;
  private transport: Transport;
  
  constructor(config: ClientConfig) {
    this.apiVersion = config.apiVersion || 'latest';
    this.transport = this.createTransport(config);
  }
  
  private createTransport(config: ClientConfig): Transport {
    if (config.apiVersion === 'latest' || 
        config.apiVersion.startsWith('2.')) {
      // Use Worker transport for v2+
      return new WorkerTransport(config);
    } else {
      // Use HTTP transport for v1
      return new HTTPTransport(config);
    }
  }
  
  async connect(): Promise<void> {
    // Version negotiation
    const serverVersion = await this.transport.getVersion();
    
    if (!this.isCompatible(serverVersion)) {
      throw new Error(
        `Client version ${this.apiVersion} incompatible with ` +
        `server version ${serverVersion}`
      );
    }
  }
}
```

### Auto-upgrade Mechanism

```typescript
// auto-upgrade.ts
export class AutoUpgradeClient {
  private client: HierarchiDBClient;
  private upgradeAvailable = false;
  
  async checkForUpgrade(): Promise<void> {
    const response = await fetch('/api/version');
    const { latest, current } = await response.json();
    
    if (this.shouldUpgrade(current, latest)) {
      this.upgradeAvailable = true;
      this.notifyUpgrade(latest);
    }
  }
  
  private shouldUpgrade(current: string, latest: string): boolean {
    const [currentMajor] = current.split('.').map(Number);
    const [latestMajor] = latest.split('.').map(Number);
    
    // Only auto-upgrade minor/patch versions
    return currentMajor === latestMajor && current < latest;
  }
  
  private async performUpgrade(version: string): Promise<void> {
    // Download new client
    const response = await fetch(`/sdk/v${version}/client.js`);
    const code = await response.text();
    
    // Hot reload
    const module = await import(`data:text/javascript,${code}`);
    this.client = new module.HierarchiDBClient();
    
    // Reconnect with new version
    await this.client.connect();
  }
}
```

## Response Transformation

### Version-specific Serialization

```typescript
// response-transformer.ts
export class ResponseTransformer {
  transform(data: any, targetVersion: string): any {
    const [major] = targetVersion.split('.').map(Number);
    
    switch(major) {
      case 1:
        return this.transformToV1(data);
      case 2:
        return this.transformToV2(data);
      default:
        return data;
    }
  }
  
  private transformToV1(data: V2Response): V1Response {
    if (Array.isArray(data)) {
      return data.map(item => this.transformNodeToV1(item));
    }
    return this.transformNodeToV1(data);
  }
  
  private transformNodeToV1(node: V2Node): V1Node {
    return {
      id: node.treeNodeId,
      parentId: node.parentNodeId,
      name: node.name,
      type: this.mapNodeTypeToV1(node.nodeType),
      // Omit v2-specific fields
    };
  }
  
  private transformToV2(data: V1Response): V2Response {
    // Add required v2 fields with defaults
    if (Array.isArray(data)) {
      return data.map(item => this.transformNodeToV2(item));
    }
    return this.transformNodeToV2(data);
  }
  
  private transformNodeToV2(node: V1Node): V2Node {
    return {
      treeNodeId: node.id as NodeId,
      parentNodeId: node.parentId as NodeId,
      name: node.name,
      nodeType: this.mapNodeTypeToV2(node.type),
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Add v2 required fields
    };
  }
}
```

## Testing Migration

### Compatibility Tests

```typescript
// compatibility.test.ts
describe('API Compatibility', () => {
  let v1Client: V1Client;
  let v2Client: V2Client;
  let adapter: APICompatibilityAdapter;
  
  beforeEach(() => {
    v1Client = new V1Client();
    v2Client = new V2Client();
    adapter = new APICompatibilityAdapter();
  });
  
  it('should handle v1 client with v2 server', async () => {
    const v1Data = { id: '123', name: 'Test' };
    
    // Through adapter
    const result = await adapter.createNode(v1Data);
    
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('Test');
  });
  
  it('should handle v2 client with v1 response shape', async () => {
    const transformer = new ResponseTransformer();
    const v2Response = { treeNodeId: '123' as NodeId };
    
    const v1Shape = transformer.transform(v2Response, '1.0.0');
    
    expect(v1Shape).toHaveProperty('id');
    expect(v1Shape.id).toBe('123');
  });
});
```

## Monitoring & Analytics

### Usage Tracking

```typescript
// api-metrics.ts
export class APIMetrics {
  private metrics: Map<string, MetricData> = new Map();
  
  trackAPICall(
    endpoint: string,
    version: string,
    deprecated: boolean = false
  ): void {
    const key = `${endpoint}:${version}`;
    const metric = this.metrics.get(key) || {
      count: 0,
      deprecated,
      lastUsed: Date.now()
    };
    
    metric.count++;
    metric.lastUsed = Date.now();
    
    this.metrics.set(key, metric);
    
    // Alert on deprecated usage
    if (deprecated && metric.count % 100 === 0) {
      console.warn(
        `Deprecated API ${endpoint} called ${metric.count} times`
      );
    }
  }
  
  getReport(): MetricsReport {
    const report: MetricsReport = {
      total: 0,
      deprecated: 0,
      byVersion: {},
      byEndpoint: {}
    };
    
    for (const [key, data] of this.metrics) {
      const [endpoint, version] = key.split(':');
      
      report.total += data.count;
      if (data.deprecated) report.deprecated += data.count;
      
      report.byVersion[version] = 
        (report.byVersion[version] || 0) + data.count;
      
      report.byEndpoint[endpoint] = 
        (report.byEndpoint[endpoint] || 0) + data.count;
    }
    
    return report;
  }
}
```

## Migration Checklist

- [ ] Document all breaking changes
- [ ] Implement compatibility layer
- [ ] Add deprecation warnings
- [ ] Create migration guide
- [ ] Update client SDKs
- [ ] Test backward compatibility
- [ ] Monitor deprecated API usage
- [ ] Plan sunset timeline
- [ ] Communicate changes to users

## Related Documentation

- [API Architecture](../02-ARCHITECTURE/03-api-layer.md)
- [Version Migration](./01-version-migration.md)
- [Worker Implementation](../02-ARCHITECTURE/04-worker-layer.md)
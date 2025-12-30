# API・サービス命名規則の適用による変更レポート

## 概要
プロジェクト全体でAPI（インターフェース）とサービス（実装）の命名規則を統一しました。

### 命名規則
- **HogeHogeAPI**: `packages/common/api`に定義されるComlink通信用インターフェース
- **HogeHogeService**: `packages/runtime/worker/src/services`にある実装クラス
- **インターフェース**: `I`プレフィックスを使用（例：`PluginRegistry`）

## 実施した変更

### 1. ITagAPI → TagAPI への改名
**対象ファイル:**
- `packages/common/api/src/ITagAPI.ts` → `packages/common/api/src/TagAPI.ts`
- `packages/common/api/src/RuntimeWorkerService.ts`
- `packages/common/api/src/WorkerAPI.ts`
- `packages/runtime/worker/src/WorkerAPIImpl.ts`
- `packages/runtime/worker/src/services/TagService.ts`

**変更内容:**
- ファイル名を`ITagAPI.ts`から`TagAPI.ts`に変更
- インターフェース名を`ITagAPI`から`TagAPI`に変更
- すべての参照箇所を更新

### 2. WorkerAPIImplのサービス利用の整理
**対象ファイル:**
- `packages/runtime/worker/src/WorkerAPIImpl.ts`

**変更内容:**
- 必要なサービスのインポートを追加:
  - `PluginTreeService`
  - `PluginLifecycleService`
  - `TagService`
- タイポを修正: `PluginLifecycletService` → `PluginLifecycleService`
- API型のインポートを整理し、アルファベット順に並び替え

### 3. IPluginRegistryの型定義の修正
**対象ファイル:**
- `packages/runtime/plugin-registry/src/registry/PluginRegistry.ts`

**変更内容:**
- `type PluginRegistry = {` から `interface PluginRegistry {` に変更
- 型エイリアスからインターフェースへの変更により、より適切な型定義に

## 影響範囲
これらの変更により、以下の点が改善されました：

1. **一貫性の向上**: API/サービスの命名規則が統一され、コードの可読性が向上
2. **メンテナンス性の向上**: インターフェースと実装の区別が明確になり、保守が容易に
3. **型安全性の向上**: インターフェースの適切な使用により、TypeScriptの型チェックがより効果的に

## ビルドへの影響
これらの変更後、以下のコマンドでビルドエラーが解消されることを確認してください：
```bash
pnpm typecheck
pnpm stage
```

## 今後の作業
- 他にも同様の命名規則違反がないか確認
- 新規APIを追加する際は、この命名規則に従うこと
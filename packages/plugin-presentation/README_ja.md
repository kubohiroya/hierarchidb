# @hierarchidb/plugin-presentation

最終更新: 2026-04-05

HierarchiDB プラグインの表示メタデータ（アイコン、ラベル、色等）を管理する共有ヘルパーパッケージ。プラグインのプレゼンテーション情報をグローバルストアで一元管理し、UI コンポーネントから参照可能にする。

## 主要な機能

- `getGlobalPluginPresentationStore` — プラグイン表示メタデータのグローバルストア取得
- `normalizeMuiIconName` — MUI アイコン名の正規化
- `normalizeLabelText` / `sanitizeLabel` — ラベルテキストの正規化・サニタイズ

## 公開 API

```typescript
import {
  getGlobalPluginPresentationStore,
  normalizeMuiIconName,
  normalizeLabelText,
  sanitizeLabel,
} from '@hierarchidb/plugin-presentation';
```

### 型定義

```typescript
interface PluginPresentationManifest {
  nodeType: string;
  displayName: string;
  icon: PluginPresentationManifestIcon;
}

interface PluginPresentation {
  nodeType: string;
  displayName: string;
  icon: PluginPresentationIconConfig;
  color?: string;
}
```

## 依存関係

| パッケージ | 種別 | 用途 |
| --- | --- | --- |
| `@hierarchidb/components` | peer | 共有 UI コンポーネント |

## 関連パッケージ

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest（プレゼンテーション情報の元データ）
- [`@hierarchidb/plugin-ui-host`](../plugin-ui-host/) — ダイアログホスト（プレゼンテーション情報を利用）

## ライセンス

MIT

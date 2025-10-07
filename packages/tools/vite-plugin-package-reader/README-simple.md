# @hierarchidb/tools-vite-plugin-package-reader

package.jsonファイルを自動検出し、その情報をViteのVirtual Moduleとして提供するプラグインです。

## このプラグインがやること

1. **検出**: 指定されたパターンに一致するpackage.jsonを探す
2. **変換**: 見つけたpackage.json情報を必要な形式に変換する
3. **提供**: 変換したデータをVirtual Moduleとして提供する

それだけです。

## なぜ必要か

```typescript
// これまで：手動でインポートを管理
import plugin1 from '@myapp/plugin-1';
import plugin2 from '@myapp/plugin-2';
import plugin3 from '@myapp/plugin-3';
// 新しいプラグインを追加するたびに更新が必要

// このプラグインを使用：自動検出
import plugins from 'virtual:detected-plugin-loader';
// package.jsonから自動的に検出される
```

## インストール

```bash
pnpm add @hierarchidb/tools-vite-plugin-package-reader
```

## 基本的な使い方

### 1. 設定

```typescript
// vite.config.ts
import { vitePluginPackageReader, RegexStrategy } from '@hierarchidb/tools-vite-plugin-package-reader';

export default {
  plugins: [
    vitePluginPackageReader({
      // どのパッケージを検出するか
      strategies: [
        new RegexStrategy({
          name: 'my-plugin-loader',
          pattern: /^@myapp\/plugin-/,  // この名前パターンに一致するパッケージ
        })
      ],
      
      // Virtual Moduleとして何を出力するか
      virtualModules: [{
        moduleId: 'detected-plugin-loader',
        generate: (packages) => {
          // packagesはMap<packageName, packageJson>
          return `export default ${JSON.stringify([...packages.keys()])};`;
        }
      }]
    })
  ]
};
```

### 2. 使用

```typescript
// src/main.ts
import packageNames from 'virtual:detected-plugin-loader';

console.log('検出されたパッケージ:', packageNames);
// ['@myapp/plugin-1', '@myapp/plugin-2', '@myapp/plugin-3']
```

## 検出戦略

### RegexStrategy - 名前パターン

```typescript
new RegexStrategy({
  name: 'pattern-match',
  pattern: /^@myapp\//,  // @myapp/で始まるパッケージ
})
```

### FieldStrategy - フィールドの存在

```typescript
new FieldStrategy({
  name: 'has-field',
  fields: ['myapp.plugin'],  // myapp.pluginフィールドを持つパッケージ
})
```

### FunctionStrategy - カスタムロジック

```typescript
new FunctionStrategy({
  name: 'custom',
  test: (name, packageJson) => {
    return packageJson.keywords?.includes('my-plugin');
  }
})
```

## 変換パイプライン（オプション）

検出したpackage.jsonデータを変換したい場合：

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  pipeline: {
    transform: (packages) => {
      // Map<string, PackageJson>を任意の形式に変換
      const result = [];
      for (const [name, pkg] of packages) {
        result.push({
          name: name,
          version: pkg.version
        });
      }
      return result;
    }
  },
  
  virtualModules: [{
    moduleId: 'plugin-info',
    generate: (transformed) => {
      // transformで変換されたデータを受け取る
      return `export default ${JSON.stringify(transformed)};`;
    }
  }]
});
```

## モノレポでの使用

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  monorepo: {
    packages: ['packages/*'],  // パッケージの場所
    usePnpmWorkspace: true,     // pnpm-workspace.yamlを使用
  }
});
```

## TypeScript型定義

```typescript
// src/vite-env.d.ts
declare module 'virtual:detected-plugins' {
  const plugins: string[];
  export default plugins;
}
```

## API

### strategies（必須）
パッケージを検出する条件を定義します。

### virtualModules（オプション）
検出したデータをどのようなVirtual Moduleとして出力するかを定義します。

### pipeline（オプション）
検出したデータを変換するパイプラインを定義します。

### monorepo（オプション）
モノレポ環境での検出設定を定義します。

### hooks（オプション）
検出・変換の各段階で実行される処理を定義します。

## このプラグインがやらないこと

- パッケージのインストール
- 依存関係の解決
- コードの実行
- ファイルの生成（Virtual Module以外）

## 主な用途

- **プラグインシステム**: 利用可能なプラグインを自動検出
- **モジュール統合**: 複数パッケージの情報を1つにまとめる
- **動的インポート**: パッケージ情報に基づく動的インポートの生成

## ライセンス

MIT
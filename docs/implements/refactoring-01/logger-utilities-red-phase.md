# Logger Utilities - Redフェーズ設計

## テスト実行コマンド

```bash
cd packages/ui-core
pnpm test src/utils/logger.test.ts
```

## 期待される失敗メッセージ

初回実行時は以下のエラーが発生：

```
Error: Cannot find module './logger' from 'src/utils/logger.test.ts'
```

これは `packages/ui-core/src/utils/logger.ts` ファイルがまだ存在しないため、正しい失敗です。

## テストケース実装詳細

### 1. 正常系テストケース（4個実装）

#### 1-1. プレフィックス付きログ出力
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 現在の実装から直接導出
- **テスト内容**: `createLogger('TestModule')` でロガーを作成し、`devLog` でログ出力

#### 1-2. エラーログ出力
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 現在の実装から直接導出
- **テスト内容**: `devError` でエラーメッセージとオブジェクトを出力

#### 1-3. 警告ログ出力
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 現在の実装から直接導出
- **テスト内容**: `devWarn` で警告メッセージを出力

#### 1-4. 複数引数処理
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 可変長引数パターンから導出
- **テスト内容**: 文字列、オブジェクト、配列を同時に渡す

### 2. 異常系テストケース（3個実装）

#### 2-1. 本番環境でのログ抑制
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 現在の実装から直接導出
- **テスト内容**: `NODE_ENV='production'` でログが出力されないことを確認

#### 2-2. 空プレフィックス処理
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟡 妥当な推測
- **テスト内容**: 空文字列プレフィックスでもエラーなく動作

#### 2-3. 環境変数未設定時の動作
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟡 Node.js の一般的な慣習
- **テスト内容**: `NODE_ENV` 未設定時は開発環境として動作

### 3. 境界値テストケース（4個実装）

#### 3-1. 引数なしログ出力
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟢 実装パターンから導出
- **テスト内容**: 引数0個でも正常動作

#### 3-2. 特殊値の処理
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟡 妥当な推測
- **テスト内容**: null, undefined, NaN を正しく出力

#### 3-3. 長いプレフィックス
- **実装状況**: ✅ 実装済み
- **信頼性**: 🟡 エッジケース
- **テスト内容**: 100文字以上のプレフィックスでも動作

## 日本語コメントの説明

各テストケースに以下の日本語コメントを配置：

1. **テストケース開始時**
   - テスト目的、内容、期待動作、信頼性レベルを明記

2. **Given（準備）フェーズ**
   - テストデータ準備の理由と初期条件を説明

3. **When（実行）フェーズ**
   - 実行する処理と内容を説明

4. **Then（検証）フェーズ**
   - 検証内容と期待値確認の理由を説明

5. **各expect文**
   - 具体的な確認内容と信頼性レベルを付記

## 実装要求仕様

Greenフェーズで実装が必要な機能：

```typescript
// packages/ui-core/src/utils/logger.ts

export interface Logger {
  devLog: (...args: any[]) => void;
  devError: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
}

export function createLogger(prefix: string): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  
  return {
    devLog: (...args: any[]) => {
      if (isDev) {
        console.log(`[${prefix}]`, ...args);
      }
    },
    devError: (...args: any[]) => {
      if (isDev) {
        console.error(`[${prefix} Error]`, ...args);
      }
    },
    devWarn: (...args: any[]) => {
      if (isDev) {
        console.warn(`[${prefix} Warning]`, ...args);
      }
    }
  };
}
```
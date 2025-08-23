# ThemedLoadingScreen Consolidation - Test Cases

## テスト対象
ThemedLoadingScreen コンポーネントを`ui-core`に統一し、`ui-layout`の重複を排除する。

## 重複状況
- **ui-core**: 統合theme utilities使用版（新規）
- **ui-layout**: ui-theme依存 + useTheme hook使用版（既存）

## テストケース

### 正常系 (4 cases)

#### TC-01: Component rendering - 基本レンダリング
**テスト目的**: ThemedLoadingScreenが両variantで正しくレンダリングされる  
**テスト内容**: linear・circular variantでの描画確認  
**期待される動作**: 適切なMUIコンポーネントが表示される  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-02: Theme integration - テーマ統合
**テスト目的**: 統合theme utilitiesが正しく適用される  
**テスト内容**: light/dark themeでの背景・テキスト色適用  
**期待される動作**: theme modeに応じた適切な色が適用される  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-03: SSR compatibility - SSRハイドレーション対応
**テスト目的**: サーバーサイドレンダリング時のhydration mismatch防止  
**テスト内容**: isHydrated stateによる段階的color適用  
**期待される動作**: SSR時はlight default、hydration後はactual theme適用  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-04: Props handling - プロップス処理
**テスト目的**: variant、message、size、childrenが正しく処理される  
**テスト内容**: 各propsでの動作確認  
**期待される動作**: 渡されたpropsが適切にコンポーネントに反映される  
**信頼性レベル**: 🟢 現在の実装から直接導出

### 異常系 (3 cases)

#### TC-05: Theme unavailable - theme情報取得失敗
**テスト目的**: theme utilities取得失敗時のfallback処理  
**テスト内容**: theme関数がエラーを返す場合の処理  
**期待される動作**: default色でgracefulに描画継続  
**信頼性レベル**: 🟡 妥当な推測（既存実装にはない）

#### TC-06: Invalid props - 不正なprops値
**テスト目的**: 範囲外sizeや無効variantでの処理  
**テスト内容**: 負数size、未定義variant等での動作  
**期待される動作**: default値またはエラーなしで処理  
**信頼性レベル**: 🟡 妥当な推測

#### TC-07: Hydration timing - ハイドレーション タイミング競合
**テスト目的**: useEffectとtheme取得のタイミング問題対応  
**テスト内容**: 高速なcomponent mount/unmount時の動作  
**期待される動作**: メモリリークやエラーなしで処理  
**信頼性レベル**: 🟡 妥当な推測

### 境界値 (3 cases)

#### TC-08: Size boundaries - サイズ境界値
**テスト目的**: CircularProgressのサイズ境界での処理  
**テスト内容**: size=0, 極大値での描画確認  
**期待される動作**: MUIコンポーネントが適切にサイズ処理  
**信頼性レベル**: 🟢 MUI仕様から導出

#### TC-09: Message length boundaries - メッセージ長境界
**テスト目的**: 極端に長い・短いmessageでの表示確認  
**テスト内容**: 空文字、超長文での描画確認  
**期待される動作**: 適切なtext wrapping・表示処理  
**信頼性レベル**: 🟡 妥当な推測

#### TC-10: Children complexity - 複雑なchildren要素
**テスト目的**: 複雑なReactNodeをchildrenに渡した場合の処理  
**テスト内容**: ネストしたcomponent、fragment等での描画  
**期待される動作**: childrenが適切にレンダリングされる  
**信頼性レベル**: 🟢 Reactの仕様から導出

### 統合テスト (2 cases)

#### TC-11: Package import consistency - パッケージインポート一貫性
**テスト目的**: ui-coreから統一exportされることの確認  
**テスト内容**: ui-layoutのThemedLoadingScreenがui-coreを参照  
**期待される動作**: import pathが統一され、重複排除される  
**信頼性レベル**: 🟢 リファクタリング要求から導出

#### TC-12: Backward compatibility - 後方互換性
**テスト目的**: 既存コードが影響を受けないことの確認  
**テスト内容**: ui-layoutからのimportが引き続き動作  
**期待される動作**: 既存のimport文を変更せずに統合版が使用される  
**信頼性レベル**: 🟢 リファクタリング要求から導出

## 成功基準

1. **機能性**: 全12テストケースがパスする
2. **統合性**: ui-layoutのThemedLoadingScreenがui-core版を参照
3. **重複排除**: ui-layoutの実装ファイルを削除、re-exportのみ残す
4. **後方互換性**: 既存のimport文が影響を受けない
5. **型安全性**: TypeScript型チェックエラーなし

## Implementation Strategy

1. **ui-core版を改良**: ui-layoutのuseTheme hook利用パターンを統合
2. **ui-layout版を削除**: 実装ファイルを削除しui-coreからre-export
3. **依存関係更新**: ui-layoutのpackage.jsonにui-core依存を追加
4. **テスト統合**: 両パッケージの仕様を満たすテスト作成
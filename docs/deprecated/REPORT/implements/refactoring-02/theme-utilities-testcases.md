# Theme Utilities Consolidation - Test Cases

## テスト対象
Theme関連のutility functionsを`ui-core`に統合し、重複を排除する。

## テストケース

### 正常系 (4 cases)

#### TC-01: Theme mode utilities - 基本動作
**テスト目的**: Theme mode取得・設定関数が正しく動作する  
**テスト内容**: `getStoredThemeMode`, `getSystemTheme`, `getActualTheme`の動作確認  
**期待される動作**: 各theme modeが正しく取得・判定される  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-02: Theme styling utilities - 色の取得
**テスト目的**: Theme対応の色取得関数が正しく動作する  
**テスト内容**: `getThemeBackgroundColor`, `getThemeTextColor`の色取得  
**期待される動作**: Light/Dark theme時に適切な色が返される  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-03: Theme display utilities - アイコン・ラベル
**テスト目的**: Theme表示用のutility関数が正しく動作する  
**テスト内容**: `getThemeIcon`, `getThemeDisplayName`の表示用データ取得  
**期待される動作**: 各theme modeに対応したアイコン・ラベルが返される  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-04: SSR compatibility - サーバーサイドレンダリング対応
**テスト目的**: SSR環境でtheme utilities がhydration mismatch を起こさない  
**テスト内容**: `window` 未定義時のfallback動作  
**期待される動作**: SSR時にlight theme defaultが返される  
**信頼性レベル**: 🟢 現在の実装から直接導出

### 異常系 (3 cases)

#### TC-05: LocalStorage access failure - ストレージアクセス失敗
**テスト目的**: localStorage読み取り失敗時の適切なfallback  
**テスト内容**: localStorage例外発生時の処理  
**期待される動作**: エラー時にdefault値('system')を返す  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-06: Invalid theme mode - 不正なtheme mode値
**テスト目的**: 不正な値がlocalStorageにある場合の処理  
**テスト内容**: 無効な文字列がstoredされている場合  
**期待される動作**: default値('system')を返す  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-07: matchMedia unsupported -古いブラウザ対応
**テスト目的**: `matchMedia`が未対応のブラウザでのfallback  
**テスト内容**: `window.matchMedia`が未定義の場合  
**期待される動作**: light themeをdefaultとして返す  
**信頼性レベル**: 🟢 現在の実装から直接導出

### 境界値 (3 cases)

#### TC-08: Theme mode boundaries - 全theme mode網羅
**テスト目的**: 全てのtheme mode('light', 'dark', 'system')の処理確認  
**テスト内容**: 各theme modeでの全utility関数動作  
**期待される動作**: 全modeで一貫した動作  
**信頼性レベル**: 🟢 現在の実装から直接導出

#### TC-09: System theme detection - システムtheme検出境界
**テスト目的**: システムのcolor-scheme設定変化への対応  
**テスト内容**: `prefers-color-scheme`のlight/dark切り替え  
**期待される動作**: システム設定に従った適切なtheme判定  
**信頼性レベル**: 🟡 妥当な推測

#### TC-10: MUI theme integration - Material-UIテーマ統合
**テスト目的**: Material-UIテーマオブジェクトとの互換性確認  
**テスト内容**: MUIのtheme objectから色情報を正しく取得  
**期待される動作**: MUI theme paletteから適切な色が取得される  
**信頼性レベル**: 🟢 現在の実装から直接導出

## 成功基準

1. **機能性**: 全10テストケースがパスする
2. **統合性**: ui-coreからtheme utilities exportが可能
3. **後方互換性**: ThemedLoadingScreenが統合後のutilitiesを使用
4. **型安全性**: TypeScript型チェックエラーなし

## Implementation Notes

- 既存の`ui-theme`パッケージとの統合を考慮
- SSR compatibility維持が重要
- LocalStorage access安全性確保
- MUI Theme objectとの互換性維持
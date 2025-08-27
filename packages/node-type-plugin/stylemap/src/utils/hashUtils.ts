/**
 * @file hashUtils.ts
 * @description ファイルコンテンツのハッシュ値生成ユーティリティ
 * 【機能概要】: CSV ファイルの重複検出のためのハッシュ値生成
 * 【実装方針】: Web Crypto API を使用したSHA-256ハッシュ生成
 * 【テスト対応】: StyleMapCSVApiDriver.test.ts の重複検出テストケース対応
 * 🟢 信頼性レベル: Web標準APIを使用した確実な実装
 */

/**
 * 【機能概要】: 文字列コンテンツからSHA-256ハッシュを生成
 * 【実装方針】: Web Crypto API のdigest機能を使用して確実なハッシュ生成
 * 【テスト対応】: uploadCSVFile の重複検出機能を実現
 * 🟢 信頼性レベル: 標準的なハッシュ生成手法
 * @param content - ハッシュ化対象の文字列
 * @returns Promise<string> - 16進数文字列形式のハッシュ値
 */
async function generateHash(content: string): Promise<string> {
  // 【入力値検証】: コンテンツの妥当性をチェック 🟢
  if (typeof content !== 'string') {
    throw new Error('コンテンツは文字列である必要があります');
  }

  // 【エンコード処理】: UTF-8バイト配列に変換してハッシュ計算の準備 🟢
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // 【ハッシュ生成】: Web Crypto API でSHA-256ハッシュを生成 🟢
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // 【16進数変換】: バイナリハッシュを16進数文字列に変換 🟢
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 【結果返却】: 16進数ハッシュ文字列を返却
  return hashHex;
}

/**
 * 【エクスポート定義】: テストでモック化できるように名前付きオブジェクトでエクスポート
 * 【テスト対応】: vi.mock('../utils/hashUtils') でモック化対応
 */
export const hashUtils = {
  generateHash,
};
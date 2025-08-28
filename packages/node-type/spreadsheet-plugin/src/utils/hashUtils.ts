/**
 * @file utils/hashUtils.ts
 * @description ファイルハッシュ計算ユーティリティ
 * SHA-256を使用してファイル内容の整合性チェック用ハッシュ値を生成
 */

/**
 * 【機能概要】: ファイル内容からSHA-256ハッシュ値を計算
 * 【実装方針】: Web Crypto APIを使用した標準的なハッシュ計算
 * 【テスト対応】: SpreadsheetCSVApiDriverテストで使用
 * 🟢 信頼性レベル: Web標準APIによる実装
 */
export async function calculateFileHash(file: File): Promise<string> {
  // ファイルをArrayBufferとして読み込み
  const buffer = await file.arrayBuffer();
  return calculateBufferHash(buffer);
}

/**
 * 【機能概要】: テキストからSHA-256ハッシュ値を計算
 * 【実装方針】: TextEncoderでUTF-8バイト列に変換してハッシュ化
 * 【テスト対応】: 文字列データの整合性チェック
 * 🟢 信頼性レベル: 標準的なテキストハッシュ計算
 */
export async function calculateTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateBufferHash(data.buffer);
}

/**
 * 【機能概要】: ArrayBufferからSHA-256ハッシュ値を計算
 * 【実装方針】: Web Crypto API使用、16進数文字列で返却
 * 【テスト対応】: バイナリデータのハッシュ計算基盤
 * 🟢 信頼性レベル: Web Crypto API標準実装
 */
export async function calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
  // Web Crypto APIでSHA-256ハッシュを計算
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // ハッシュ値を16進数文字列に変換
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * 【機能概要】: 複数のバッファを結合してハッシュ計算
 * 【実装方針】: チャンク単位のハッシュ計算に使用
 * 【テスト対応】: 大規模ファイルの分割ハッシュ計算
 * 🟡 信頼性レベル: 結合処理の効率性要検証
 */
export async function calculateCombinedHash(buffers: Uint8Array[]): Promise<string> {
  // すべてのバッファを結合
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return calculateBufferHash(combined.buffer);
}

/**
 * 【機能概要】: ハッシュ値の比較
 * 【実装方針】: 大文字小文字を無視して比較
 * 【テスト対応】: ファイル整合性チェック
 * 🟢 信頼性レベル: 単純な文字列比較
 */
export function compareHashes(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}

/**
 * 【機能概要】: ハッシュ値の短縮表示形式
 * 【実装方針】: 先頭と末尾の一部を表示
 * 【テスト対応】: UI表示用の短縮形式
 * 🟢 信頼性レベル: 表示用ユーティリティ
 */
export function getShortHash(hash: string, length: number = 8): string {
  if (hash.length <= length) {
    return hash;
  }

  const halfLength = Math.floor(length / 2);
  const start = hash.substring(0, halfLength);
  const end = hash.substring(hash.length - halfLength);

  return `${start}...${end}`;
}

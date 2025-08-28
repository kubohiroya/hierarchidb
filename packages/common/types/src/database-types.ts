// データベーススキーマ定義
export interface DatabaseSchema {
  [storeName: string]: string; // Dexie schema string
}

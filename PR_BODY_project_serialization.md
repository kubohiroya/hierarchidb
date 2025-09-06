PR: project-plugin に直列化/逆直列化ユーティリティを追加し、Handler を接続

要点
- `ProjectEntitySerializer` を project-plugin に新規追加し、深い走査で `Uint8Array`/`ArrayBuffer` を検出して UUID 参照へ変換。実体は `Map<string, Uint8Array>` に退避。
- `ProjectEntityHandler.serialize/deserialize` と配列版を同ユーティリティで実装。
- `*_Uint8Array` サフィックス規約を尊重し、推奨ファイル名に元キー名を反映。
- 単体テストを追加（`src/shared/__tests__/serialization.test.ts`）。

ブランチ: `feat/project/serialization-impl`
対応タスク: TASKS.md > Doing > feat/project/serialization-impl

変更詳細
- 追加: `packages/node-type/project-plugin/src/shared/serialization.ts`
  - `ProjectEntitySerializer.serialize/deserialize/(de)serializeEntityArray`
  - JSON 側は UUID 参照、バイナリは `binaryData`/`binaryFilenames` に分離
- 更新: `packages/node-type/project-plugin/src/handlers/ProjectEntityHandler.ts`
  - `serialize/deserialize` と配列版をユーティリティ接続
- 追加(テスト): `packages/node-type/project-plugin/src/shared/__tests__/serialization.test.ts`
  - `Uint8Array`/`ArrayBuffer` の往復を検証

受け入れ基準（DoD）
- [x] `handler.serialize/deserialize` がユーティリティ経由で動作する
- [x] `Uint8Array`/`ArrayBuffer` を含むエンティティで直列化→復元が可能
- [x] エンティティ配列 API も同様に通る
- [x] 追加テストがグリーン

ロールバック
- `packages/node-type/project-plugin/src/shared/serialization.ts` を削除し、`ProjectEntityHandler` の該当メソッドを元のスタブへ差し戻せば機能的影響は限定的。

フォローアップ
- エクスポート/インポート層（ファイルI/O）で `binaryFilenames` に基づく保存/読み込みを配線（別PR可）。
- Project エンティティに将来バイナリ追加時は `*_Uint8Array` 規約に揃えると可読性向上。


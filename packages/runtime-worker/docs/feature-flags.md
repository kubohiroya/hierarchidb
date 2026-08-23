vk:doc kind=guide audience=dev scope=worker

# Worker 機能フラグ一覧（設計）

目的
- ランタイムの挙動を安全に段階切替できるよう、機能フラグの命名・既定値・作用範囲を明記します。
- 現時点では設計ドキュメントのみ（実装は別PR）。

共通ルール
- 既定は安全側（OFF）。
- 値は文字列 `"0" | "1"`。起動時に確定（動的切替なし）。
- 作用範囲は最小に限定し、副作用の差分をドキュメント化する。

---

## `VITE_CANONICAL_BUILD_INPUT_ENVELOPE`

- 既定: `0`（OFF）
- 読み取り: `app/src/config/canonicalBuildFeatureFlags.ts`
- 確定タイミング: app / worker 起動時。build session 実行中に再読込しない。
- 目的: canonical build start request を storage field 名 `draftData` から切り離し、`source: 'committed' | 'working-copy'` と `payload` を持つ input envelope へ移行する。
- ON 時: runtime は caller が明示した source だけを読む。`committed` は `TreeNode.data`、`working-copy` は `TreeNode.draftData` を使用し、欠落・不完全・不正値を他方 slot で補完しない。
- OFF 時: rollback 用に隔離された legacy `draftData` request surface へ戻せる。legacy surface の撤去は cleanup gate で扱う。
- Rollback 条件: source 明示経路で build start が失敗し、legacy UI Working Copy 経路へ戻す必要がある場合は flag を `0` に戻し、関連変更を revert する。storage schema migration は不要。

---

## `VITE_CANONICAL_BUILD_RUNTIME_ADAPTER`

- 既定: `0`（OFF）
- 読み取り: `app/src/config/canonicalBuildFeatureFlags.ts` をSSOTとし、app / worker 起動時に固定する。
- 目的: shape/location/route の runtime record と control surface を node type 共通の `CanonicalBuildRuntimeAdapter` registry へ移行する。
- ON 時: runtime get/list/subscribe/delete は登録済み adapter だけを使う。未登録 node type、不正 status、不正 revision、node type mismatch は typed runtime contract error として失敗させ、空配列や no-op へ変換しない。
- OFF 時: rollback 用に隔離された既存 shape runtime surface を使用できる。location/route の新adapter登録は無効化し、既存UI経路へ影響させない。
- Rollback 条件: registry 経由の runtime record が queue/auth/external runner で契約違反を出す場合は flag を `0` に戻し、adapter dispatch 変更を revert する。session store schema migration は不要。

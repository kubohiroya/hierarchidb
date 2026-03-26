# 実装計画: yaml-file-node

## 概要

`YamlFileNode`（`nodeType = 'yaml-file'`）を hierarchidb のツリーに追加する。
実装は依存関係の順に `yaml-api` → `yaml-store` → `yaml-plugin` → `folder-plugin` 拡張 → `app/` Vite 設定 → テストの順で進める。

## タスク

- [x] 1. `packages/yaml-api` — 型・テンプレート・スキーマ定義
  - [x] 1.1 `YamlFileNodeData` インターフェースと `YAML_NODE_TYPE` 定数を実装する
    - 作成: `packages/yaml-api/src/YamlFileNodeData.ts`
    - `YAML_NODE_TYPE = 'yaml-file' as NodeType` を export
    - `YamlFileNodeData { name: string; schemaId: string; content: string }` を export
    - non-null assertion 禁止・再エクスポート禁止（`index.ts` 以外）
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 `YamlTemplate` 型・`YAML_TEMPLATES` 定数・`findYamlTemplate` 関数を実装する
    - 作成: `packages/yaml-api/src/YamlTemplate.ts`
    - 10エントリ（sources / scenario / scenario-base / calib / remote / remote-base / ssh / ssh-base / ec2 / ec2-base）を `as const` で定義
    - `findYamlTemplate(templateId: string): YamlTemplate | undefined` を実装（`undefined` 返却は明示ガード）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 `YAML_SCHEMAS` レコードと `getYamlSchema` 関数を実装する
    - 作成: `packages/yaml-api/src/yamlSchemas.ts`
    - 6 schemaId（`ide-gsm/sources`, `ide-gsm/scenario`, `ide-gsm/calib`, `ide-gsm/remote`, `ide-gsm/ssh`, `ide-gsm/ec2`）の JSON Schema オブジェクトを定義
    - `getYamlSchema(schemaId: string): object | undefined` を実装
    - _Requirements: 4.4, 4.5_

  - [x] 1.4 `packages/yaml-api/src/index.ts` を作成する（re-export 専用入口）
    - `YamlFileNodeData.ts` / `YamlTemplate.ts` / `yamlSchemas.ts` の全 export を re-export
    - `package.json` の `exports` エントリを設定
    - _Requirements: 1.1, 2.1_

  - [x] 1.5 `yaml-api` の Property テストを書く（P1・P2）
    - 作成: `packages/yaml-api/__tests__/YamlTemplate.test.ts`
    - **Property 1: YAML_TEMPLATES uniqueness invariant** — `templateId` と `fileName` が全エントリで一意であることを静的配列で検証
    - **Property 2: Unknown templateId lookup returns undefined** — `fc.string()` で既知 templateId を除外し `findYamlTemplate` が `undefined` を返すことを検証（最低 100 iterations）
    - コメント形式: `// Feature: yaml-file-node, Property 1: ...`
    - _Requirements: 2.1, 2.3_

- [x] 2. `packages/yaml-store` — Worker 側 IndexedDB CRUD
  - [x] 2.1 `YamlDB` Dexie サブクラスを実装する
    - 作成: `packages/yaml-store/src/YamlDB.ts`
    - `YamlDB extends Dexie`、`nodes` テーブル（`&nodeId`）、`version(1)` で定義
    - シングルトンアクセサを同ファイルに実装（non-null assertion 禁止）
    - _Requirements: 3.1_

  - [x] 2.2 `createYamlNode` / `updateYamlNode` / `deleteYamlNode` を実装する
    - 作成: `packages/yaml-store/src/yamlNodeOperations.ts`
    - `createYamlNode(nodeId, data)`: 既存 nodeId なら typed error result を返す
    - `updateYamlNode(nodeId, patch)`: 存在しない nodeId なら typed error result を返す
    - `deleteYamlNode(nodeId)`: 存在しない nodeId なら typed error result を返す
    - 全エラーパスは例外スローではなく result-type パターンで返す
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 2.3 `packages/yaml-store/src/index.ts` を作成する（re-export 専用入口）
    - `package.json` の `exports` エントリを設定
    - _Requirements: 3.1_

  - [x] 2.4 `yaml-store` の Property テストを書く（P3・P4・P5）
    - 作成: `packages/yaml-store/__tests__/yamlNodeOperations.test.ts`
    - **Property 3: CRUD lifecycle consistency** — `fc.record({ name: fc.string(), schemaId: fc.string(), content: fc.string() })` で create→read→update→read→delete→read のライフサイクルを検証
    - **Property 4: Invalid parent rejects create** — `fc.string()` で非 Folder parentId を生成し create がエラーを返すことを検証
    - **Property 5: Non-existent node rejects update and delete** — `fc.string()` で存在しない nodeId を生成し update/delete がエラーを返すことを検証
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. `plugins/yaml-plugin` — plugin-manifest + icon
  - [x] 3.1 `plugin-manifest.ts` を実装する
    - 作成: `plugins/yaml-plugin/src/plugin-manifest.ts`
    - `nodeType = 'yaml-file'`、`extends: 'folder'`、`category.menuGroup = 'yaml'`
    - `stepTitleKeys: { '1': 'basicInfo', '2': 'schemaSelection', '3': 'schemaEditor' }`
    - `worker.preload: ['registerYamlWorkerStores']`
    - `PluginManifest` 型に準拠（`spreadsheet-plugin` の manifest パターンに倣う）
    - _Requirements: 4.1, 5.1, 5.3_

  - [x] 3.2 `YamlPluginIcon` コンポーネントを実装する
    - 作成: `plugins/yaml-plugin/src/icon/YamlPluginIcon.tsx`
    - 作成: `plugins/yaml-plugin/src/icon/index.ts`（re-export 専用）
    - `package.json` の `./icon` export エントリを設定
    - _Requirements: 5.1_

  - [x] 3.3 `YamlDraft` 型と定数を定義する
    - 作成: `plugins/yaml-plugin/src/common/types/YamlEntity.ts`
    - `YamlDraft = Partial<YamlFileNodeData>`
    - 作成: `plugins/yaml-plugin/src/common/constants.ts`
    - `YAML_NODE_TYPE` 定数（`yaml-api` から import して再利用）
    - _Requirements: 4.1_

- [x] 4. `plugins/yaml-plugin` — UI: 3ステップダイアログ
  - [x] 4.1 `YamlBasicInfoStep` コンポーネントを実装する（Step 1）
    - 作成: `plugins/yaml-plugin/src/ui/components/steps/YamlBasicInfoStep.tsx`
    - `name` フィールドの入力フォームを実装
    - `PluginStepProps<YamlDraft>` を受け取り `props.onChange` で更新
    - _Requirements: 4.3_

  - [x] 4.2 `YamlSchemaSelectionStep` コンポーネントを実装する（Step 2）
    - 作成: `plugins/yaml-plugin/src/ui/components/steps/YamlSchemaSelectionStep.tsx`
    - `YAML_TEMPLATES` から schemaId 一覧を表示し選択可能にする
    - 現在の `schemaId` をハイライト表示
    - _Requirements: 4.4_

  - [x] 4.3 `YamlSchemaEditorStep` コンポーネントを実装する（Step 3）
    - 作成: `plugins/yaml-plugin/src/ui/components/steps/YamlSchemaEditorStep.tsx`
    - `getYamlSchema(data.schemaId)` で JSON Schema を取得（`undefined` の場合はエラー表示）
    - `@rjsf/core` + `@rjsf/mui` で `<Form>` をレンダリング
    - `onChange` で form data を `yaml` パッケージで YAML テキストに変換し `props.onChange({ ...data, content: yamlText })` を呼ぶ
    - _Requirements: 4.5, 4.6_

  - [x] 4.4 `steps-provider.tsx` を実装する
    - 作成: `plugins/yaml-plugin/src/ui/components/steps-provider.tsx`
    - `PluginStepRegistry.getInstance()` に `'yaml-file'` の 3ステップ設定を登録
    - Step 1 validate: `Boolean(data?.name?.trim())`
    - Step 2 canProceedToNext: `Boolean(data?.schemaId)`
    - Step 3 canSave: `() => true`
    - _Requirements: 4.1, 4.7_

  - [x] 4.5 `plugins/yaml-plugin/src/ui/index.ts` を作成する（re-export 専用入口）
    - `steps-provider.tsx` の side-effect import を含む
    - `package.json` の `./ui` export エントリを設定（`docs/draft-dialog-hosting.md` のパターンに従う）
    - _Requirements: 4.8_

  - [x] 4.6 `yaml-plugin` の steps-provider Property テストを書く（P6・P8）
    - 作成: `plugins/yaml-plugin/__tests__/stepsProvider.test.ts`
    - **Property 6: Template pre-population** — `fc.constantFrom(...YAML_TEMPLATES)` で各テンプレートを選択したとき初期 `YamlDraft` の `name === template.fileName` かつ `schemaId === template.schemaId` を検証
    - **Property 8: Empty name validation rejects proceed** — `fc.string().filter(s => s.trim() === '')` で Step 1 の `validate` が `false` を返すことを検証
    - _Requirements: 4.2, 4.7, 5.2_

  - [x] 4.7 `YamlSchemaEditorStep` の Property テストを書く（P7）
    - 作成: `plugins/yaml-plugin/__tests__/YamlSchemaEditorStep.test.ts`
    - **Property 7: JSON-to-YAML round-trip** — `fc.object()` で任意の JSON-serializable オブジェクトを生成し、`yaml` パッケージで YAML 変換後に再パースした値が元のオブジェクトと深く等しいことを検証
    - _Requirements: 4.6_

- [x] 5. `plugins/yaml-plugin` — Worker: `registerYamlWorkerStores`
  - [x] 5.1 `registerYamlWorkerStores` を実装する
    - 作成: `plugins/yaml-plugin/src/worker/registerYamlWorkerStores.ts`
    - `YamlDB` シングルトンを初期化して Worker 起動時に DB を ready 状態にする
    - AbortSignal を受け取り、既に abort 済みの場合はエラーなく終了する
    - _Requirements: 3.1_

  - [x] 5.2 `plugins/yaml-plugin/src/worker/index.ts` を作成する（re-export 専用入口）
    - `package.json` の `./worker` export エントリを設定
    - _Requirements: 3.1_

  - [x] 5.3 `plugins/yaml-plugin/src/index.ts` を作成する（パッケージ入口）
    - `plugin-manifest.ts` の export を含む
    - _Requirements: 5.3_

- [x] 6. チェックポイント — yaml-api / yaml-store / yaml-plugin の単体確認
  - 全テストが通ることを確認する。問題があればユーザーに報告する。

- [x] 7. `plugins/folder-plugin` — export/import 拡張（YamlFileNode の ZIP 収集・復元）
  - [x] 7.1 フォルダ export に `YamlFileNode` 収集ロジックを追加する
    - 変更: `plugins/folder-plugin/src/` 内の export 処理ファイル
    - フォルダ配下を再帰走査し `nodeType === 'yaml-file'` のノードを収集
    - 各ノードを ZIP エントリ（path = `node.data.name`、content = UTF-8 の `node.data.content`）として追加
    - 同一 `name` が2件以上存在する場合は ZIP 組み立て前に name-conflict error を返す（部分 ZIP 生成禁止）
    - ZIP を Base64 エンコードして `ProjectSnapshot` として返す
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 フォルダ import に `YamlFileNode` 復元ロジックを追加する
    - 変更: `plugins/folder-plugin/src/` 内の import 処理ファイル
    - Base64 デコード → ZIP 展開（不正 Base64 / 破損 ZIP はそれぞれ typed error result を返す）
    - `.yml` / `.yaml` で終わるエントリのみ対象に `createYamlNode` を発行
    - 非 UTF-8 エントリを検出したらインポート全体を中断（部分書き込み禁止）
    - 成功時は作成した `NodeId[]` を返す
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.3 export/import の Property テストを書く（P9・P10・P11・P12）
    - 作成: `plugins/folder-plugin/__tests__/yamlRoundTrip.test.ts`
    - **Property 9: Export-import round-trip preserves name and content** — `fc.array(fc.record({ name: fc.string(), content: fc.string() }), { minLength: 1 })` で distinct name を持つノード群を生成し、export→import 後の `name` と `content` が一致することを検証
    - **Property 10: Round-trip assigns new NodeIds** — 同ジェネレータで import 後の `NodeId` が元の `NodeId` と異なることを検証
    - **Property 11: Duplicate name on export returns error** — `fc.array(...)` で同一 `name` を強制的に含むノード群を生成し、export がエラーを返し ZIP を生成しないことを検証
    - **Property 12: Invalid Base64 import returns error** — `fc.string().filter(s => !isValidBase64(s))` で不正 Base64 を生成し import がエラーを返しノードを作成しないことを検証
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 7.4, 8.1, 8.2, 8.3_

- [x] 8. `app/` — Vite optimizeDeps 設定
  - [x] 8.1 `@rjsf/core`・`@rjsf/mui`・`yaml` を `app/` に追加する
    - 変更: `app/package.json` の `dependencies` に `@rjsf/core`・`@rjsf/mui`・`yaml` を追加
    - 変更: `app/vite.config.ts` の `optimizeDeps.include` に以下を追加:
      - `@rjsf/core`
      - `@rjsf/mui`
      - `yaml`
      - `@rjsf/utils`（`@rjsf/core` の推移的依存）
      - `@rjsf/validator-ajv8`（使用する場合）
    - `pnpm install` を実行して resolve 可能であることを確認
    - _Requirements: 4.5_

- [x] 9. 最終チェックポイント — 全テスト通過確認
  - 全テストが通ることを確認する。問題があればユーザーに報告する。

## 注記

- `*` 付きサブタスクはオプション（MVP では省略可）
- 各タスクは前のタスクの成果物に依存するため、番号順に実施すること
- non-null assertion（`!`）は全ファイルで禁止
- `src/index.ts` 以外での再エクスポートは禁止
- テストファイルは相対 import を使用し `~/*` を避けること
- ファイル命名は `docs/ts-file-naming-guideline.md` に従うこと
- Property テストは各プロパティに `// Feature: yaml-file-node, Property N: <property_text>` コメントを付与すること

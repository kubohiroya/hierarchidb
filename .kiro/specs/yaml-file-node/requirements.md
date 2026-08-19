# Requirements Document

> [!IMPORTANT]
> Status: historical baseline. This document records the original three-step YAML implementation and is not the SSOT for the current subtype, data model, draft, or IDE-GSM Step 4 contract. See [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../../docs/yaml-plugin-ide-gsm-step4-spec.md). Where this document conflicts with that specification, the `docs/` specification applies.

## Introduction

IDE-GSM との統合のため、hierarchidb のツリーに新しいノード種別 `YamlFileNode` を追加する。
`YamlFileNode` はフォルダ内の YAML 設定ファイルを表現するノードであり、3ステップダイアログで作成・編集する。
本機能は `yaml-api` / `yaml-store` / `yaml-plugin` の3パッケージで構成し、既存の spreadsheet-plugin / folder-plugin のパターンに準拠する。

## Glossary

- **YamlFileNode**: YAML テキストファイルを表すツリーノード種別。`nodeType = 'yaml-file'`。
- **YamlFileNodeData**: `YamlFileNode` のデータ型。`name: string`・`schemaId: string`・`content: string` の3フィールドを持つ。
- **schemaId**: 使用する JSON Schema の識別子（例: `ide-gsm/scenario`）。
- **content**: JSON Schema Editor の編集結果を YAML テキストとして保持するフィールド。
- **Template**: ファイル名・schemaId が事前定義された `YamlFileNode` の雛形。`yaml-api` パッケージに定義する。
- **JSON Schema Editor**: `@rjsf/core` + `@rjsf/mui` で自動構成されたフォーム。選択した JSON Schema をもとに `content` を編集する。
- **Folder**: `nodeType = 'folder'` のツリーノード。`YamlFileNode` の親となる。
- **ProjectSnapshot**: ZIP ファイルを Base64 エンコードした文字列。IDE-GSM との間でやり取りするプロジェクト設定の交換フォーマット。
- **FolderExport**: フォルダ配下のノードを ProjectSnapshot 形式で書き出す操作。
- **FolderImport**: ProjectSnapshot 形式から `YamlFileNode` を含むノードを復元する操作。
- **Worker**: hierarchidb のバックグラウンド処理を担う Service Worker（`packages/runtime-worker`）。
- **SpeedDial**: ツリー画面右下に表示されるノード作成用の FAB メニュー。
- **PluginStepRegistry**: `@hierarchidb/plugin-base` が提供するステップ設定の登録レジストリ。

## Requirements

### Requirement 1: YamlFileNodeData の型定義

**User Story:** As a developer, I want a `YamlFileNodeData` type defined in the `yaml-api` package, so that the rest of the system can reference it with full type safety.

#### Acceptance Criteria

1. THE `yaml-api` package SHALL export a `YamlFileNodeData` interface with fields `name: string`, `schemaId: string`, and `content: string`.
2. THE `yaml-api` package SHALL export the string literal `'yaml-file'` as the canonical `NodeType` value for `YamlFileNode`.
3. WHEN `YamlFileNodeData` is used as the `data` field of a `TreeNode`, THE `TreeNode` SHALL satisfy the existing `TreeNode<TData>` generic constraint without modification.

---

### Requirement 2: テンプレート一覧の定義

**User Story:** As a developer, I want a predefined list of YAML templates in the `yaml-api` package, so that UI and worker layers can reference template metadata without duplication.

#### Acceptance Criteria

1. THE `yaml-api` package SHALL export a `YAML_TEMPLATES` constant containing the following 10 entries, each with `templateId`, `displayName`, `fileName`, and `schemaId` fields:

   | templateId | displayName | fileName | schemaId |
   |---|---|---|---|
   | `sources` | Sources | `sources.yml` | `ide-gsm/sources` |
   | `scenario` | Scenario | `scenario.yml` | `ide-gsm/scenario` |
   | `scenario-base` | Scenario Base | `scenario-base.yml` | `ide-gsm/scenario` |
   | `calib` | Calibration | `calib.yml` | `ide-gsm/calib` |
   | `remote` | Remote | `remote.yml` | `ide-gsm/remote` |
   | `remote-base` | Remote Base | `remote-base.yml` | `ide-gsm/remote` |
   | `ssh` | SSH | `ssh.yml` | `ide-gsm/ssh` |
   | `ssh-base` | SSH Base | `ssh-base.yml` | `ide-gsm/ssh` |
   | `ec2` | EC2 | `ec2.yml` | `ide-gsm/ec2` |
   | `ec2-base` | EC2 Base | `ec2-base.yml` | `ide-gsm/ec2` |

2. THE `yaml-api` package SHALL export a `YamlTemplate` type representing a single entry in `YAML_TEMPLATES`.
3. WHEN a `templateId` not present in `YAML_TEMPLATES` is looked up, THE lookup function SHALL return `undefined`.

---

### Requirement 3: YamlFileNode の CRUD 操作

**User Story:** As a user, I want to create, update, and delete `YamlFileNode` entries under a folder, so that I can manage YAML configuration files within the project tree.

#### Acceptance Criteria

1. WHEN a create command is issued with `nodeType = 'yaml-file'` and a valid `parentId` pointing to a `Folder`, THE Worker SHALL persist a new `YamlFileNode` with the provided `name`, `schemaId`, and `content`.
2. WHEN an update command is issued for an existing `YamlFileNode`, THE Worker SHALL update the `name`, `schemaId`, and/or `content` fields and increment the node's `version`.
3. WHEN a delete command is issued for an existing `YamlFileNode`, THE Worker SHALL remove the node from the tree and return a success result.
4. IF a create command is issued with `nodeType = 'yaml-file'` and a `parentId` that does not point to a `Folder`, THEN THE Worker SHALL return an error result without creating any node.
5. IF an update or delete command is issued for a `nodeId` that does not exist, THEN THE Worker SHALL return an error result.

---

### Requirement 4: 3ステップダイアログによる作成・編集

**User Story:** As a user, I want to create and edit a `YamlFileNode` through a 3-step dialog, so that I can configure the file name, schema, and content in a guided flow.

#### Acceptance Criteria

1. THE `yaml-plugin` SHALL register 3 step configurations via `PluginStepRegistry` for `nodeType = 'yaml-file'`: Step 1 (BasicInfo), Step 2 (Schema Selection), Step 3 (JSON Schema Editor).
2. WHEN a Template is selected from SpeedDial or the context menu Create submenu, THE dialog SHALL open with `name` pre-filled from the template's `fileName` and `schemaId` pre-selected from the template's `schemaId`.
3. WHEN Step 1 is displayed, THE BasicInfo step SHALL allow the user to input or edit the `name` field.
4. WHEN Step 2 is displayed, THE Schema Selection step SHALL display the JSON Schema associated with the current `schemaId` and allow the user to confirm or change the selection.
5. WHEN Step 3 is displayed, THE JSON Schema Editor step SHALL render a form using `@rjsf/core` and `@rjsf/mui` based on the selected JSON Schema, and SHALL allow the user to edit the `content` field.
6. WHEN the user completes Step 3 and saves, THE `yaml-plugin` SHALL serialize the form data as a YAML text string and store it in the `content` field of `YamlFileNodeData`.
7. WHEN Step 1 validation fails (empty `name`), THE dialog SHALL prevent proceeding to Step 2.
8. THE `yaml-plugin` SHALL expose the dialog host component via the `./ui` export entry in `package.json`, following the registry-driven hosting pattern defined in `docs/draft-dialog-hosting.md`.

---

### Requirement 5: SpeedDial / コンテキストメニューへの統合

**User Story:** As a user, I want to select a YAML template from the SpeedDial or context menu, so that I can quickly create a pre-configured `YamlFileNode`.

#### Acceptance Criteria

1. THE `yaml-plugin` plugin manifest SHALL declare a `category` with a YAML submenu group so that all 10 templates appear under a YAML sub-submenu in the SpeedDial and the context menu Create submenu.
2. WHEN a template entry is selected from the YAML submenu, THE system SHALL open the 3-step dialog with `name` and `schemaId` pre-populated from the selected template.
3. THE `yaml-plugin` plugin manifest SHALL follow the `PluginManifest` structure defined in `@hierarchidb/plugin-base`, consistent with the `folder-plugin` manifest pattern.

---

### Requirement 6: フォルダ export 時の YamlFileNode 収集

**User Story:** As a developer, I want `YamlFileNode` entries to be included in the folder export (ProjectSnapshot), so that IDE-GSM can receive the complete project configuration.

#### Acceptance Criteria

1. WHEN a folder export is requested, THE `FolderExport` SHALL traverse all direct and indirect child nodes of the target folder.
2. WHEN a `YamlFileNode` is encountered during traversal, THE `FolderExport` SHALL add a ZIP entry whose path equals the `YamlFileNode`'s `name` field and whose content is the UTF-8 encoded `content` field.
3. WHEN the ZIP is assembled, THE `FolderExport` SHALL encode the ZIP as a Base64 string to produce the `ProjectSnapshot`.
4. IF a folder has no `YamlFileNode` children, THEN THE `FolderExport` SHALL produce a valid (possibly empty) ZIP without error.
5. IF two `YamlFileNode` entries under the same folder have the same `name`, THEN THE `FolderExport` SHALL return an error result indicating a name conflict, without producing a partial ZIP.

---

### Requirement 7: フォルダ import 時の YamlFileNode 復元

**User Story:** As a developer, I want `YamlFileNode` entries to be restored from a ProjectSnapshot during folder import, so that IDE-GSM project configurations are fully reconstructed in the tree.

#### Acceptance Criteria

1. WHEN a folder import is requested with a valid `ProjectSnapshot`, THE `FolderImport` SHALL decode the Base64 string and extract the ZIP entries.
2. WHEN a ZIP entry has a path ending in `.yml` or `.yaml`, THE `FolderImport` SHALL create a `YamlFileNode` under the target folder with `name` equal to the entry path and `content` equal to the UTF-8 decoded entry content.
3. WHEN the import completes successfully, THE `FolderImport` SHALL return the list of created `YamlFileNode` IDs.
4. IF the `ProjectSnapshot` string is not valid Base64, THEN THE `FolderImport` SHALL return an error result without creating any node.
5. IF the decoded ZIP is malformed, THEN THE `FolderImport` SHALL return an error result without creating any node.
6. IF a ZIP entry content is not valid UTF-8, THEN THE `FolderImport` SHALL return an error result for that entry and abort the entire import without partial writes.

---

### Requirement 8: ラウンドトリップ整合性

**User Story:** As a developer, I want export followed by import to reproduce the original `YamlFileNode` set exactly, so that ProjectSnapshot round-trips are lossless.

#### Acceptance Criteria

1. FOR ALL sets of `YamlFileNode` entries under a folder, exporting the folder to a `ProjectSnapshot` and then importing that `ProjectSnapshot` into a new folder SHALL produce `YamlFileNode` entries with identical `name` and `content` values.
2. THE round-trip property SHALL hold regardless of the number of `YamlFileNode` entries (zero or more).
3. WHEN the round-trip produces `YamlFileNode` entries, THE `FolderImport` SHALL assign new unique `NodeId` values; it SHALL NOT reuse the original `NodeId` values.

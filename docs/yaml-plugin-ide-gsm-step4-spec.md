# YAML plugin IDE-GSM Step 4 契約

## 位置付け

本書は YAML plugin の subtype、IDE-GSM command、draft 同期、認証、実行状態に関する正規仕様である。親 Epic [#1162](https://github.com/kubohiroya/hierarchidb/issues/1162) と仕様 Issue [#1253](https://github.com/kubohiroya/hierarchidb/issues/1253) に基づく。

型、DB migration、client、executor、UI の実装は本書に従う。本書と `.kiro/specs/yaml-file-node` または `.kiro/specs/ide-gsm-client` が矛盾する場合、本書を優先する。

## Upstream 契約

- Repository: `kubohiroya/ide-gsm`
- Revision: `353a81edd4635e70913b778ae7d2aa6833ae1de1`
- GraphQL mutation と task status は上記 revision の `FrontendResource` と `TaskStatus` を基準とする。
- mutation は task ID を文字列で返す。task ID を受け取った command は subscription で terminal status まで追跡する。
- `check` command は `checkAll` だけに対応する。`checkProject` は別の upstream command であり、代替として呼び出さない。

## YAML subtype と永続化契約

```ts
type YamlSubtype =
  | 'sources'
  | 'scenario'
  | 'scenario-base'
  | 'calib'
  | 'remote'
  | 'remote-base'
  | 'ssh'
  | 'ssh-base'
  | 'ec2'
  | 'ec2-base'
  | 'rsync'
  | 'git';
```

- ファイル名は `TreeNode.metadata.name` / `TreeNode.draftMetadata.name` を唯一の SSOT とする。
- `YamlFileNodeData` / `draftData` は `subtype`、`schemaId`、`content` を持ち、`name` を重複保存しない。
- subtype、schemaId、canonical filename の組合せは次表の registry で検証する。
- template 選択後の filename は canonical filename と一致しなければならない。任意の別名を受け入れない。
- 通常の読み込み・編集・command 実行時に、filename や schemaId から subtype を推測しない。

| subtype | schemaId | canonical filename | command |
| --- | --- | --- | --- |
| `sources` | `ide-gsm/sources` | `sources.yml` | あり |
| `scenario` | `ide-gsm/scenario` | `scenario.yml` | あり |
| `scenario-base` | `ide-gsm/scenario` | `scenario-base.yml` | なし |
| `calib` | `ide-gsm/calib` | `calib.yml` | なし |
| `remote` | `ide-gsm/remote` | `remote.yml` | あり |
| `remote-base` | `ide-gsm/remote` | `remote-base.yml` | なし |
| `ssh` | `ide-gsm/ssh` | `ssh.yml` | あり |
| `ssh-base` | `ide-gsm/ssh` | `ssh-base.yml` | なし |
| `ec2` | `ide-gsm/ec2` | `ec2.yml` | あり |
| `ec2-base` | `ide-gsm/ec2` | `ec2-base.yml` | なし |
| `rsync` | `ide-gsm/rsync` | `rsync.yml` | あり |
| `git` | `ide-gsm/git` | `git.yml` | あり |

`scenario-base`、`calib`、`remote-base`、`ssh-base`、`ec2-base` は editor-only subtype であり、command 集合は明示的な空集合とする。

## 追加 template の content 契約

### `rsync.yml`

- YAML root は mapping とする。
- 許可する property は optional な `include: string[]` と `exclude: string[]` だけとする。
- `additionalProperties` は許可しない。
- `connectionType`、`projectRelativePath`、push/pull 方向を YAML に保存しない。
- `connectionType` は Step 4 で `remote`、`ssh`、`ec2` のいずれかを必須 runtime input として受け取る。
- client は検証済み YAML を解析し、`include` / `exclude` が存在するときだけ GraphQL variables へ配列として渡す。server が `rsync.yml` を暗黙に読むことを前提にしない。
- property の欠落を空配列で補完しない。省略と空配列を区別して upstream へ渡す。

### `git.yml`

- YAML root は mapping とし、repository `url` を必須 property とする。
- `additionalProperties` は許可しない。
- GitHub token と `projectRelativePath` を YAML に保存しない。いずれも runtime input とする。

## Subtype と command の対応

| subtype | command ID | GraphQL mutation |
| --- | --- | --- |
| `sources` | `install` | `install` |
| `scenario` | `check` | `checkAll` |
| `scenario` | `check-merge` | `checkMerge` |
| `scenario` | `preview-events` | `previewEvents` |
| `scenario` | `calib` | `calibrate` |
| `scenario` | `sim` | `simulate` |
| `scenario` | `purge-cache` | `purgeCache` |
| `remote` | `calib-remote` | `calibrateRemote` |
| `remote` | `sim-remote` | `simulateRemote` |
| `remote` | `start-container-remote` | `startContainerRemote` |
| `remote` | `stop-container-remote` | `stopContainerRemote` |
| `ssh` | `calib-ssh` | `calibrateSsh` |
| `ssh` | `sim-ssh` | `simulateSsh` |
| `ec2` | `calib-ec2` | `calibrateEc2` |
| `ec2` | `sim-ec2` | `simulateEc2` |
| `ec2` | `start-container-ec2` | `startContainerEc2` |
| `ec2` | `stop-container-ec2` | `stopContainerEc2` |
| `rsync` | `rsync-push` | `rsyncPush` |
| `rsync` | `rsync-pull` | `rsyncPull` |
| `git` | `init` | `init` |

- `start-daemon-*` は無効な旧名称とし、alias を設けない。
- `start-container-ssh` と `stop-container-ssh` は upstream Frontend GraphQL API に存在しないため、registry と UI に追加しない。
- `gitClone` と `gitPull` は本契約の command ではない。`init` からの fallback 先としても使用しない。
- 未定義 subtype、または subtype に許可されていない command は network request 前に契約違反としてエラーにする。

## Command input

`projectRelativePath` はすべての command で非空の必須 runtime context とする。絶対 path、`..`、未設定値を拒否する。container lifecycle mutation 自体は GraphQL input を持たないが、その前段の snapshot import には runtime `projectRelativePath` を使用する。

| mutation | input |
| --- | --- |
| `install` | `projectRelativePath`; optional runtime `force` |
| `checkAll`, `checkMerge`, `purgeCache` | `projectRelativePath` |
| `previewEvents` | `projectRelativePath`; optional runtime `profile`, `yearFilter` |
| `simulate` | `projectRelativePath`; optional runtime `profile`, `compute`, `apsp`, `purgeCache`, `reset` |
| `calibrate` | `projectRelativePath`; optional runtime `profile`, `compute`, `apsp`, `purgeCache`, `purgeCalib`, `reset` |
| `simulateRemote`, `simulateSsh`, `simulateEc2` | `projectRelativePath`; optional runtime `compute`, `apsp`, `purgeCache`, `reset`, `downloadCache` |
| `calibrateRemote`, `calibrateSsh`, `calibrateEc2` | `projectRelativePath`; optional runtime `compute`, `apsp`, `purgeCache`, `purgeCalib`, `reset`, `downloadCache` |
| `startContainerRemote`, `stopContainerRemote`, `startContainerEc2`, `stopContainerEc2` | GraphQL input なし |
| `rsyncPush`, `rsyncPull` | runtime `projectRelativePath`, required runtime `connectionType`; optional YAML `include`, `exclude` |
| `init` | runtime `projectRelativePath`, runtime GitHub token, required `git.yml.url` |

optional input は未指定のまま送信し、client 側で値を補完しない。入力値の意味と upstream default を UI 側の default で上書きしない。

## Dialog、draft、runtime state

- YAML plugin は app の汎用 `PluginDialogHost` と `PluginStepRegistry` を使用する。専用 `YamlDialog` を追加しない。
- Basic Info は host が `draftMetadata` として管理する。
- plugin 固有の永続 draft は `draftData` の `subtype`、`schemaId`、`content` だけとする。
- Step 4 の選択 command、task ID、status、result、error は UI-only state とする。`draftMetadata`、`draftData`、TreeNode、IndexedDB へ保存しない。
- endpoint と JWT は app-level の認証済み executor/provider に閉じ込める。step props、draft、TreeNode、IndexedDB、URL、localStorage、ログへ token を渡さない。
- command 実行は暗黙の save/commit ではない。ダイアログを閉じる、または再読み込みすると UI-only state は破棄される。

## Snapshot と command 実行順序

### 通常 command

`git/init` 以外は次の順序を固定する。

1. subtype、schemaId、canonical filename、YAML content、runtime input をすべて検証する。
2. 対象 folder について既存 folder export 契約が選ぶ YAML ノードを収集し、編集中ノードは保存済み payload ではなく現在の検証済み draft で置き換える。
3. immutable `ProjectSnapshot` を生成する。
4. `importProject` を実行し、task status が `FINISHED` になるまで待つ。
5. 対象 command mutation を1回だけ送信する。

validation、serialization、`importProject` のいずれかが失敗した場合、対象 command を送信しない。部分 snapshot、保存済み payload への切替、retry、別 mutation への fallback を行わない。

### `git/init` bootstrap 例外

`git/init` は clone 先を新規作成する bootstrap command であり、`importProject` を前置しない。

1. `git.yml` の subtype、schemaId、canonical filename、content、`url` を検証する。
2. runtime `projectRelativePath` と GitHub token を検証する。
3. clone 先が存在しないことを確認する。空であっても既存の clone 先はエラーにする。
4. `init(projectRelativePath, token, url)` を直接1回だけ送信する。

既存 path の削除・上書き・内容退避、別 destination の生成、`gitClone` への fallback を禁止する。

## Task status

| upstream status | UI 契約 |
| --- | --- |
| `REGISTERED`, `READY`, `LEASED` | active。subscription を継続する |
| `FINISHED` | success。subscription を終了する |
| `FAILED`, `CANCELED` | failure。詳細を表示して subscription を終了する |
| `DELETED` | unsupported terminal state。成功扱いせずエラーにする |
| その他 | unknown status。契約違反としてエラーにする |

- WebSocket が terminal status 前に完了・切断した場合はエラーにする。
- 実行中の同一 command の二重開始を拒否する。
- 自動 retry、status の読み替え、unknown status の無視を行わない。
- error 表示とログには endpoint や token 等の credential を含めない。

## Feature flag

- 論理 flag 名は `yamlIdeGsmStep4Enabled` とする。
- typed app-level config を唯一の読取元とし、既定値は `false` とする。
- app composition / `PluginDialogHost` 境界が flag を1回だけ読み、YAML step composition へ boolean capability として注入する。
- YAML plugin、step component、executor は app config や environment variable を直接読まない。
- flag が OFF の場合、Step 4 を effective step config に含めず、既存の3ステップ構成を維持する。
- environment variable や複数 config 経路への fallback を設けない。
- 実装ファイルの配置は executor/flag 実装 Issue で命名規約に従って確定する。本書は公開契約、単一読取責務、注入境界、既定値の SSOT とする。

## Migration と import

- 既存 record は、`TreeNode.metadata.name`、legacy `YamlFileNodeData.name`、schemaId がすべて存在し、両方の name が完全一致した上で registry の単一 subtype に一致する場合だけ migration する。
- metadata name と legacy payload name の不一致または片方の欠落を検出した場合、どちらかを優先せず migration 全体を失敗させる。
- migration 成功時だけ legacy payload の `name` を除去し、metadata name を唯一の SSOT とする。
- 不一致、未知、曖昧、必須 field 欠落を検出した場合、対象を報告して migration 全体を失敗させる。部分更新しない。
- ZIP import は registry にある canonical filename の YAML file だけを受け入れ、対応する subtype と schemaId を明示設定する。
- unknown filename、重複 canonical filename、invalid YAML、schema 不一致を検出した場合、import 全体を失敗させる。
- default subtype、`generic` subtype、拡張子だけに基づく受入、既存データへの fallback を追加しない。

## Upstream blocker

SSH で公開されている mutation は `simulateSsh` と `calibrateSsh` だけである。upstream task runner 内部に lifecycle command が存在しても、Frontend GraphQL API に mutation がない限り UI から実行しない。将来追加する場合は upstream revision と本仕様を先に更新する。

## 後続実装順序

1. subtype、template、schema、migration/import
2. IDE-GSM client mutation、rsync input、task status
3. app-level executor、credential provider、feature flag
4. Step 4 UI
5. snapshot/import/command integration test
6. upstream API 公開後の SSH lifecycle

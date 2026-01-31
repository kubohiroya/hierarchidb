vk:task id=wc-util-baseline status=todo priority=P1 labels=worker,tree,utils,encoding

# タスク: Holderエンコード基盤の導入（v1）

## 目的
- Draft/Trash 共通の holder 名称エンコード/デコードをユーティリティ化し、以後すべての呼び出しをこのAPI経由に統一する。

## スコープ
- `src/services/utils/holder-encoding.ts` の採用（既存: 追加済み）
- 仕様参照: `docs/draft-holder-encoding.md`, `docs/holder-pair-pattern.md`

## 作業
- import置換の準備（呼び出し箇所の洗い出し）
- エンコード往復テスト（ユニット、TAB混入の防衛）

## 依存
- エピック: `epic-wc-trash-unification`
- 仕様/ADR: `adr-single-draft-per-target`, `adr-block-move-delete-when-wc-in-subtree`

## 受け入れ基準
- encode/decode の往復同値が確認でき、防衛チェック（TAB禁止）が機能する。

vk:adr id=adr-block-move-delete-when-wc-in-subtree status=accepted

# ADR: サブツリー内にWCがある場合の移動/削除を禁止（ポリシーC）

## 状態
accepted

## 文脈（Context）
- 単一WC共有モデルのもとで、未コミットの編集やドラフトが存在する状態での構造変更（移動/削除）は、整合性とUXの両面でリスクが高い。
- 通常のA/B（best-effort適用 or エラー）に代えて、サブツリー内のWCが解消されるまで構造変更自体をブロックする「ポリシーC」を採用したい。

## 決定（Decision）
- 対象ノード自身または子孫にWCが存在する間、そのノードの移動・削除を禁止する（エラーを返却／UIでは操作を無効化し明示する）。
- 編集WCは holder.name の第2要素（`targetNodeId`）、ドラフトWCは第1要素（`targetParentNodeId`）でサブツリー包含を判定する。

## 影響（Consequences）
- ブロックされた操作の原因が明確になり、未保存作業の損失を防げる。
- UIは「配下のWCを解消してください」というガイダンスを表示し、再開メニューから当該WCの編集に誘導できる。
- 実装は初期版でBFSによる判定で十分。将来的に `wcInSubtreeCount` 等のカウンタで最適化可能。

## 代替案（Alternatives）
- A: best-effortで適用（構造変更を許す）→ 意図せぬマージ・構造崩れのリスク。
- B: 常にエラーだが誘導なし → 解決導線に欠け、UXが悪化。

## 付記（Notes）
- 単一WC共有（adr-single-draft-per-target）と整合。CommandProcessorのイベント設計にも影響するため、後続ドキュメントで補足する。


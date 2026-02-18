# リンカープラグイン（linker-plugin） - プロジェクト領域/メタ設定

このドキュメントは、従来の「project-plugin」に対応していた機能群の名称変更（パッケージ名: `@hierarchidb/linker-plugin`、nodeType: `linker`）に合わせて更新したものです。機能の基本方針は従来と同様で、Projects ツリー（folder / linker / timeline）における「プロジェクト領域/メタ」の表示・集約・プレビューを担当します。

注記: 現時点では UI/機能は最小構成（表示中心）です。重い GIS の計算や合成は行いません。folder 配下の resource を link して、実際の地図として活用する位置付けです。

## 主な役割

- 選択したリソース群の集約表示（ArchiveBin風のリスト + マップ簡易プレビュー）
- コンパイル済みマップの表示（ある場合）
- 将来的に folder/timeline ノードとの連携を強化

## 作成フロー（2ステップ）

1) リソース選択 + マップ簡易プレビュー（チェックボックス選択）
2) Compiled Map 表示（中心/ズーム等があれば適用）

完了で保存し、ダイアログを閉じます（バッチ処理は行いません）。

## 技術メモ

- パッケージ名（import）: `@hierarchidb/linker-plugin/worker`
- nodeType: `linker`
- 参照しているマップ/ツリー UI は `@hierarchidb/ui-map`

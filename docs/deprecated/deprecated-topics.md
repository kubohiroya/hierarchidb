# 廃止・差し替えされたドキュメント内容

このファイルには、ドキュメント再構築時に削除または大幅に書き換えられた内容を記録します。

## 編集方針

1. **重複の排除**: 同じ内容が複数のファイルに散在していたものを統合
2. **流れの改善**: 読者が概要から詳細へと自然に理解を深められる構成に変更
3. **矛盾の解決**: 異なるファイル間で矛盾していた説明を最新仕様に統一
4. **階層の明確化**: 概念説明、設計、実装の階層を明確に分離

---

## 削除・移動されたトピック

### 1. プラグインアーキテクチャの重複記述

**元のファイル群**:
- 08-0-plugin-system-comprehensive-architecture.md
- 08-0-ui-worker-plugin-architecture.md  
- 08-plugin-system-architecture.md
- 09-0-plugin-architecture-comprehensive.md

**削除理由**: 
これらのファイルは全て同じプラグインアーキテクチャを異なる視点から説明していたが、内容が重複し、読者を混乱させていた。新しい構成では「02-architecture-*.md」シリーズに統合し、レイヤー別に整理。

**元の内容の一部**:
```
# 旧: 08-0-plugin-system-comprehensive-architecture.md
プラグインシステムは、6分類エンティティシステム（Persistent/Ephemeral × Peer/Group/Relational）を基盤として...
```

→ 新構成では「02-architecture-plugin.md」で統一的に説明

---

### 2. AOP（Aspect-Oriented Programming）関連の散在

**元のファイル群**:
- 09-0-aop-guide.md
- 09-1-aop-architecture.md
- 09-2-aop-routing.md
- 09-3-aop-implement.md
- 09-4-aop-development.md
- 09-5-aop-register.md

**削除理由**: 
AOPの概念が過度に強調され、実際のプラグイン開発には不要な複雑性を持ち込んでいた。新構成では、必要な部分のみを「プラグイン開発ガイド」に統合。

---

### 3. エンティティ分類の矛盾した説明

**元のファイル**: 09-5-six-entity-classification-system.md

**削除された内容**:
```markdown
### 3.1 PersistentPeerEntity
### 3.2 EphemeralPeerEntity  
### 3.3 PersistentGroupEntity
### 3.4 EphemeralGroupEntity
### 3.5 PersistentRelationalEntity
### 3.6 EphemeralRelationalEntity
```

**削除理由**: 
6つの個別クラスとして説明していたが、実際は2×3のマトリックスであることが X-dialog.md で明確化された。新構成では正しい2×3分類として説明。

---

### 4. UI関連ドキュメントの散在

**元のファイル群**:
- 07-0-ui.md
- 07-1-ui-packages.md
- 07-2-ui-treeconsole.md
- 07-3-ui-client.md
- 07-3-treeconsole-architecture.md
- 07-4-treeconsole-package-split.md

**削除理由**: 
TreeConsoleの実装詳細が過度に記載され、全体のUIアーキテクチャが見えにくかった。新構成では概要レベルの説明に留め、実装詳細は別途実装ガイドへ。

---

### 5. モデル層の過度な詳細化

**元のファイル群**:
- 06-1-model-core.md
- 06-2-model-database.md
- 06-3-model-query.md
- 06-4-model-mutation.md
- 06-5-model-observable.md
- 06-6-model-atom.md

**削除理由**: 
実装の詳細が概念説明に混在し、初学者には理解困難だった。新構成では「データモデル」として統合し、概念と実装を分離。

---

### 6. 個別プラグインの重複説明

**元のファイル群**:
- 10-0-plugin-index.md
- 10-0-plugin-development-guide.md
- 10-0-plugin-comprehensive-specification.md
- 10-1-plugin-basemap.md
- 10-2-plugin-stylemap.md
- 10-3-plugin-shape.md
- 10-x-plugin-entity-lifecycle-guide.md
- 10-x-migration.md

**削除理由**: 
各プラグインの説明が、概要、仕様、実装ガイドで重複していた。新構成では「プラグインカタログ」として統合。

---

### 7. テスト戦略の散在

**元のファイル群**:
- 11-1-integration-test-architecture.md
- 11-2-worker-layer-direct-testing.md
- 11-3-pubsub-integration-testing.md
- 12-1-e2e-treetable.md
- 12-2-e2e-folder.md

**削除理由**: 
テスト戦略が複数ファイルに分散し、全体像が見えなかった。新構成では「テスト戦略」として統合。

---

### 8. 機能分析の独立ファイル

**元のファイル群**:
- 13-trash-operations-analysis.md
- 14-copy-paste-analysis.md
- 15-undo-redo-analysis.md

**削除理由**: 
これらの機能は基本機能の一部であり、独立したファイルである必要がなかった。新構成では「コア機能」セクションに統合。

---

## 編集者コメント

この再構築により、以下の改善を実現しました：

1. **読みやすさの向上**: 番号体系を整理し、概要→設計→実装の流れを明確化
2. **重複の排除**: 約40%のコンテンツが重複していたものを統合
3. **一貫性の確保**: X-dialog.mdの最新仕様を全体に反映
4. **保守性の向上**: ファイル数を削減し、更新箇所を明確化

特に、プラグインアーキテクチャとエンティティシステムについては、複数の異なる説明が混在していたため、最新のX-dialog.mdの定義を正として統一しました。
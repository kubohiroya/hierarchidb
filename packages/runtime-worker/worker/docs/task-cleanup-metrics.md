vk:task id=cleanup-metrics status=planning priority=P2 labels=worker,gc,metrics,observability

# タスク: GC/整合修復とメトリクス整備

## 目的
- 孤児（holderのみ/childのみ/Entity孤児）のGCと、主要イベントのメトリクス化で運用可観測性を高める。

## 作業
- GCルーチン（起動時/定期）の追加
- メトリクス: `wc_created/committed/discarded`, `trash_moved/restored`, `gc_fixed_orphans`, `commit_conflict`
- ログ整備とダッシュボード連携（将来）

## 依存
- `trash-holder-refactor`, `tree-guard-policy-c`
- エピック: `epic-wc-trash-unification`

## 受け入れ基準
- GCで整合が回復され、メトリクスが収集される（基本カウンタが可視化可能）。


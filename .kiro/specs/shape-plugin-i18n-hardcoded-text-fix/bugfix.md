# Bugfix Requirements Document

## Introduction

Shape pluginにおいて以下の2つの問題を修正する：
1. TaskItemCardコンポーネントとGeometry Previewの表示において、i18n化をせずに日本語テキストがハードコーディングされている問題
2. Geometry Preview: SourceステージのFloatingWindowでドラッグによる移動やリサイズができない問題

これらの問題により、多言語対応が不完全となり、かつSourceステージでのユーザビリティが低下している。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN TaskItemCardでgeometry-likeステージのタスクが完了または失敗状態の時 THEN システムは「失敗」「完了」「試行」という日本語テキストをハードコーディングで表示する

1.2 WHEN buildGeometryTaskOutcomeSummaryでタスクがスキップされた時 THEN システムは「スキップ」「理由」という日本語テキストをハードコーディングで表示する

1.3 WHEN buildGeometryTaskOutcomeSummaryでタスクが完了または失敗した時 THEN システムは「失敗」「完了」「試行」「有効許容値」「試行回数」「最終データサイズ (F/Pol/V)」「元データサイズ (F/Pol/V)」「頂点削減率」「抽出率」「頂点制限」「失敗理由」という日本語テキストをハードコーディングで表示する

1.4 WHEN Geometry Preview: SourceステージのFloatingWindowでドラッグ操作を行う時 THEN システムはウィンドウの移動を受け付けるがすぐに元の位置に戻してしまう

1.5 WHEN Geometry Preview: SourceステージのFloatingWindowでリサイズ操作を行う時 THEN システムはウィンドウのリサイズを受け付けるがすぐに元のサイズに戻してしまう

### Expected Behavior (Correct)

2.1 WHEN TaskItemCardでgeometry-likeステージのタスクが完了または失敗状態の時 THEN システムはtranslate関数を使用してi18n化されたテキストを表示する

2.2 WHEN buildGeometryTaskOutcomeSummaryでタスクがスキップされた時 THEN システムはtranslate関数を使用してi18n化された「Skipped」「Reason」テキストを表示する

2.3 WHEN buildGeometryTaskOutcomeSummaryでタスクが完了または失敗した時 THEN システムはtranslate関数を使用してi18n化された「Failed」「Completed」「Attempt」「Effective Tolerance」「Retry Count」「Final Data Size (F/Pol/V)」「Original Data Size (F/Pol/V)」「Vertex Reduction Rate」「Extraction Rate」「Vertex Limit」「Failure Reason」テキストを表示する

2.4 WHEN Geometry Preview: SourceステージのFloatingWindowでドラッグ操作を行う時 THEN システムはウィンドウの移動を受け付けて新しい位置を維持する

2.5 WHEN Geometry Preview: SourceステージのFloatingWindowでリサイズ操作を行う時 THEN システムはウィンドウのリサイズを受け付けて新しいサイズを維持する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他のステージ（geometry-like以外）のタスクが表示される時 THEN システムは既存のi18n化された表示を継続して提供する

3.2 WHEN buildSimpleTaskOutcomeSummaryまたはbuildSourceTaskOutcomeSummaryが使用される時 THEN システムは既存のi18n化された表示を継続して提供する

3.3 WHEN TaskItemCardの他の機能（アイコン表示、プログレス表示、詳細表示等）が使用される時 THEN システムは既存の動作を継続して提供する

3.4 WHEN Geometry Preview: GeometryステージのFloatingWindowでドラッグやリサイズ操作を行う時 THEN システムは既存の正常な動作を継続して提供する

3.5 WHEN 他のFloatingWindow（Sourceステージ以外）でドラッグやリサイズ操作を行う時 THEN システムは既存の正常な動作を継続して提供する
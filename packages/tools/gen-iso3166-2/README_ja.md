# @hierarchidb/gen-iso3166-2

最終更新: 2026-04-05

ISO 3166-2 コード生成・国コード正規化ツール。alpha-2 / alpha-3 / 国名間の変換データを生成する。shape-plugin / location-plugin / route-plugin が使用する。

browser entryはwindow / workerのどちらでもVite buildのexact `BASE_URL`から生成済みCSV assetを解決する。
buildは`import.meta.env.BASE_URL`を置換しなければならず、base path付きdeploymentのworker artifactに
origin rootへのruntime fallbackを残さない。

## ライセンス

MIT

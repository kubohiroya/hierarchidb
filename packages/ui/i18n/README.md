# ui/i18n ガイド（言語追加と切替の運用）

本ドキュメントは、アプリの国際化（i18n）に関する運用手順を、実装の近く（ui/i18n ドメイン）に集約したものです。

- 言語の追加は「ファイル追加のみ」で完了します。
- `supportedLngs` はビルド時/実行時に `public/locales/manifest.json` から動的に決定されます。
- UI での言語切替は `LanguageSelector` コンポーネントから行えます。

## ディレクトリ構成（アプリ側）

```
app/public/locales/
  ├─ en/
  │   └─ common.json      # 英語の辞書
  ├─ ja/
  │   └─ common.json      # 日本語の辞書
  └─ manifest.json        # 生成物（使用可能な言語一覧）
```

`manifest.json` は `scripts/generate-locales-manifest.mjs` により自動生成されます（prebuild フックで実行）。

## 言語を追加する（最短経路）

1) `app/public/locales/<lang>/common.json` を作成
- 例: `app/public/locales/fr/common.json`

2) マニフェストを生成
- `pnpm i18n:manifest`（または `pnpm build` 時に自動実行）

3) アプリを起動/ビルド
- dev: `pnpm dev`
- build: `pnpm build`

4) UI の言語セレクタから `<lang>` を選択

※ manifest は無くても英語で起動します。manifest がある場合は、その `languages[].code` が有効な候補になります。

## ランタイムの挙動

- CSR（ブラウザ）
  - i18n 初期化時に `/locales/manifest.json` を先に取得し、`supportedLngs` に反映します（取得に失敗した場合は未指定のまま）。
  - `LanguageProvider` は manifest があれば対応言語を差し替え、無ければ英語のみで動作します。

- SSR
  - `supportedLngs` は未指定とし、`fallbackLng: 'en'` で動作します（クライアントで上書き）。

## UI の言語切替（LanguageSelector）

- 位置: `app/src/components/LanguageSelector.tsx`
- 仕様:
  - `/locales/manifest.json` を読み取り、`languages[].code` をセレクトに表示
  - 選択は `localStorage`（`preferred-language`/`i18nextLng`）に保存
  - `window.i18next.changeLanguage` が存在する場合は即時切替、無い場合はソフトリロードで反映

## スクリプト / ビルド連携

- 生成スクリプト: `hierarchidb/scripts/generate-locales-manifest.mjs`
  - `/app/public/locales` を走査し `manifest.json` を生成
- ルート `package.json`:
  - `prebuild`: `npm run analyze:licenses && node scripts/generate-locales-manifest.mjs`
  - `i18n:manifest`: `node scripts/generate-locales-manifest.mjs`

## トラブルシュート

- 言語がセレクタに出ない
  - `app/public/locales/<lang>/common.json` が存在するか
  - `pnpm i18n:manifest` 実行済みか
  - ブラウザのキャッシュをクリア/再読み込み

- 切替が即時に反映されない
  - グローバル `window.i18next` が無い環境では、セレクタがソフトリロードで反映します
  - 将来的にアプリの i18n インスタンスをエクスポートし、直接連携に置換する予定

## 将来タスク（参考）

- `nativeName`/`name`/`direction` を manifest に追加し、セレクタの表示をリッチ化
- manifest の CI 検証（キー欠落チェックなど）
- i18n インスタンスへの正式な参照（`changeLanguage` 直呼び）


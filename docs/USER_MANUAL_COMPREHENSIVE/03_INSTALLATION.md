# 第3部 インストール方法 ⭐️⭐️⭐️⭐️

## Chapter 3: アクセス方法

この章では、HierarchiDBへのアクセス方法と初回セットアップについて詳しく説明します。WebアプリケーションとしてのHierarchiDBは、従来のソフトウェアとは異なりインストール作業が不要です。適切なブラウザからアクセスし、初期設定を行うだけで利用を開始できます。効率的な利用のためのブックマーク設定やデータ準備についても解説します。

```mermaid
mindmap
  root((アクセス方法))
    Webアプリケーションアクセス
      URLアクセス
      ブックマーク設定
      ショートカット作成
    初回セットアップ
      アカウント登録
      初期設定
      テーマ言語設定
    データ準備
      初期データ作成
      サンプルデータ利用
      データインポート
```

### 3.1 Webアプリケーションアクセス ⭐️⭐️⭐️⭐️⭐️

#### 3.1.1 URL アクセス ⭐️⭐️⭐️⭐️⭐️

HierarchiDBは、Webブラウザから直接アクセスできるWebアプリケーションです。インストール作業は必要ありません。

**基本アクセス手順**

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Browser as ブラウザ
    participant App as HierarchiDB
    participant Server as サーバー
    
    User->>Browser: URLを入力
    Browser->>Server: HTTPSリクエスト
    Server->>Browser: アプリケーション配信
    Browser->>App: アプリケーション起動
    App->>User: ログイン画面表示
    User->>App: 認証情報入力
    App->>User: メイン画面表示
```

**アクセスURL構成**

| URL構成要素 | 説明 | 例 |
|-------------|------|-----|
| **プロトコル** | 必ずHTTPS | `https://` |
| **ドメイン** | アプリケーションドメイン | `your-domain.com` |
| **パス** | アプリケーションパス | `/hierarchidb/` |
| **完全URL** | 完全なアクセスURL | `https://your-domain.com/hierarchidb/` |

**初回アクセス時の流れ**

```mermaid
graph TB
    subgraph "初回アクセスフロー"
        URLInput["URL入力"]
        LoadCheck["読み込みチェック"]
        CompatCheck["互換性チェック"]
        AuthCheck["認証チェック"]
        MainApp["メインアプリ表示"]
        
        URLInput --> LoadCheck
        LoadCheck --> CompatCheck
        CompatCheck --> AuthCheck
        AuthCheck --> MainApp
        
        LoadCheck --> LoadError["読み込みエラー"]
        CompatCheck --> CompatError["互換性エラー"]
        AuthCheck --> AuthForm["認証フォーム"]
        AuthForm --> MainApp
    end
    
    classDef normal fill:#e8f5e9
    classDef error fill:#ffebee
    classDef auth fill:#f3e5f5
    
    class URLInput,CompatCheck,MainApp normal
    class LoadError,CompatError error
    class AuthCheck,AuthForm auth
```

#### 3.1.2 ブックマーク設定 ⭐️⭐️⭐️⭐️

効率的な利用のために、ブラウザのブックマーク機能を活用します。

**基本ブックマーク設定**

| ブックマーク名             | URL                     | 用途              |
|---------------------|-------------------------|-----------------|
| **HierarchiDB メイン** | `/`                     | トップページ          |
| **リソースツリー**         | `/t/r`                  | リソース管理          |
| **プロジェクトツリー**       | `/t/p`                  | プロジェクト管理        |
| **ライセンス情報**         | `/info` | オープンソースライセンス確認用 |

**ブックマーク作成手順**

```mermaid
graph LR
    subgraph "ブックマーク作成（Chrome例）"
        Step1["1. 対象ページを表示"]
        Step2["2. アドレスバーの★をクリック"]
        Step3["3. 名前とフォルダを設定"]
        Step4["4. 保存"]
        
        Step1 --> Step2
        Step2 --> Step3
        Step3 --> Step4
    end
    
    classDef step fill:#e1f5fe
    
    class Step1,Step2,Step3,Step4 step
```

**ブックマークフォルダ構成例**

```
📁 HierarchiDB
├── 🏠 メインページ
├── 📊 ダッシュボード
├── 📁 プロジェクト
│   ├── プロジェクトA
│   ├── プロジェクトB
│   └── アーカイブ
├── 📂 リソース
│   ├── 文書管理
│   ├── 画像ファイル
│   └── データベース
└── ⚙️ 設定・管理
```

#### 3.1.3 ショートカット作成 ⭐️⭐️⭐️

デスクトップやタスクバーにショートカットを作成することで、より簡単にアクセスできます。

**Windowsでのショートカット作成**

```mermaid
graph TB
    subgraph "Windows ショートカット作成"
        Chrome1["Chrome でアプリを開く"]
        Menu1["右上メニュー（⋮）"]
        Install1["「インストール」選択"]
        Desktop1["デスクトップにアイコン作成"]
        
        Chrome1 --> Menu1
        Menu1 --> Install1
        Install1 --> Desktop1
    end
    
    subgraph "手動ショートカット作成"
        Desktop2["デスクトップ右クリック"]
        New["「新規作成」→「ショートカット」"]
        URL["URLを入力"]
        Name["名前を設定"]
        
        Desktop2 --> New
        New --> URL
        URL --> Name
    end
    
    classDef chrome fill:#e1f5fe
    classDef manual fill:#f3e5f5
    
    class Chrome1,Menu1,Install1,Desktop1 chrome
    class Desktop2,New,URL,Name manual
```

**macOS でのショートカット作成**

| 方法 | 手順 | 結果 |
|------|------|------|
| **Safari** | 共有 → Dockに追加 | Dock にアイコン追加 |
| **Chrome** | インストール → PWA化 | アプリケーションフォルダに追加 |
| **手動** | ブックマーク → デスクトップにドラッグ | デスクトップエイリアス作成 |

### 3.2 初回セットアップ ⭐️⭐️⭐️⭐️

#### 3.2.1 アカウント登録 ⭐️⭐️⭐️⭐️

HierarchiDBの利用には、必要に応じて認証が必要です（環境によって設定が異なります）。

**認証方式の種類**

```mermaid
graph TB
    subgraph "認証オプション"
        OAuth["OAuth2.0認証"]
        OIDC["OpenID Connect"]
        Basic["基本認証"]
        Guest["ゲストアクセス"]
        
        OAuth --> GoogleAuth["Google"]
        OAuth --> MSAuth["Microsoft"]
        OAuth --> GitHubAuth["GitHub"]
        
        OIDC --> Enterprise["Enterprise SSO"]
        Basic --> LocalAuth["ローカル認証"]
        Guest --> Limited["機能制限あり"]
    end
    
    classDef auth fill:#e1f5fe
    classDef provider fill:#f3e5f5
    classDef option fill:#fff3e0
    
    class OAuth,OIDC,Basic,Guest auth
    class GoogleAuth,MSAuth,GitHubAuth,Enterprise,LocalAuth provider
    class Limited option
```

**初回登録フロー**

| ステップ | 操作 | 画面表示 |
|----------|------|----------|
| 1 | アプリケーションにアクセス | スプラッシュ画面 |
| 2 | 「ログイン」ボタンをクリック | 認証プロバイダ選択 |
| 3 | 認証プロバイダを選択 | 外部認証サイトへリダイレクト |
| 4 | アカウント情報を入力 | 認証プロバイダのログイン画面 |
| 5 | 権限許可を確認 | 権限確認ダイアログ |
| 6 | アプリケーションに戻る | プロフィール設定画面 |

#### 3.2.2 初期設定 ⭐️⭐️⭐️

認証完了後、個人設定を行います。

**基本プロフィール設定**

```mermaid
graph LR
    subgraph "プロフィール設定項目"
        Profile["プロフィール"]
        Display["表示設定"]
        Preferences["環境設定"]
        
        ProfileItems["・表示名<br/>・アバター画像<br/>・連絡先情報"]
        DisplayItems["・テーマ選択<br/>・言語設定<br/>・タイムゾーン"]
        PrefItems["・デフォルトビュー<br/>・通知設定<br/>・自動保存"]
        
        Profile --> ProfileItems
        Display --> DisplayItems
        Preferences --> PrefItems
    end
    
    classDef category fill:#e1f5fe
    classDef items fill:#f3e5f5
    
    class Profile,Display,Preferences category
    class ProfileItems,DisplayItems,PrefItems items
```

**ワークスペース設定**

| 設定項目 | 選択肢 | 推奨値 | 説明 |
|----------|--------|--------|------|
| **デフォルトツリー** | Resources / Projects | Resources | 起動時に表示するツリー |
| **表示モード** | Table / Card / List | Table | ノード表示形式 |
| **ページサイズ** | 25 / 50 / 100 / 200 | 50 | 1ページあたりの表示件数 |
| **自動展開** | ON / OFF | OFF | サブツリーの自動展開 |

#### 3.2.3 テーマ・言語設定 ⭐️⭐️⭐️⭐️

ユーザーの好みに応じてインターフェースをカスタマイズできます。

**テーマ選択**

```mermaid
graph TB
    subgraph "利用可能テーマ"
        Light["ライトテーマ"]
        Dark["ダークテーマ"]
        Auto["自動切り替え"]
        Custom["カスタムテーマ"]
        
        LightFeatures["・明るい背景<br/>・視認性重視<br/>・昼間利用に最適"]
        DarkFeatures["・暗い背景<br/>・目の疲労軽減<br/>・夜間利用に最適"]
        AutoFeatures["・時間連動<br/>・システム設定連動<br/>・自動切り替え"]
        CustomFeatures["・色設定自由<br/>・企業カラー対応<br/>・アクセシビリティ対応"]
        
        Light --> LightFeatures
        Dark --> DarkFeatures
        Auto --> AutoFeatures
        Custom --> CustomFeatures
    end
    
    classDef theme fill:#e1f5fe
    classDef features fill:#f3e5f5
    
    class Light,Dark,Auto,Custom theme
    class LightFeatures,DarkFeatures,AutoFeatures,CustomFeatures features
```

**言語設定**

| 言語 | コード | サポート状況 | 備考 |
|------|--------|--------------|------|
| **日本語** | ja-JP | 完全サポート | UIメッセージ、ヘルプ含む |
| **英語** | en-US | 完全サポート | デフォルト言語 |
| **中国語（簡体）** | zh-CN | 部分サポート | UI翻訳のみ |
| **韓国語** | ko-KR | 部分サポート | UI翻訳のみ |

### 3.3 データ準備 ⭐️⭐️⭐️⭐️

#### 3.3.1 初期データ作成 ⭐️⭐️⭐️⭐️⭐️

初回利用時に基本的なデータ構造を作成します。

**推奨初期構造**

```mermaid
graph TB
    subgraph "リソースツリー（R）推奨構造"
        RRoot["Resources Root"]
        
        Documents["📄 Documents"]
        Images["🖼️ Images"]
        Data["📊 Data"]
        Archive["📦 Archive"]
        
        Docs1["契約書"]
        Docs2["マニュアル"]
        Docs3["報告書"]
        
        RRoot --> Documents
        RRoot --> Images
        RRoot --> Data
        RRoot --> Archive
        
        Documents --> Docs1
        Documents --> Docs2
        Documents --> Docs3
    end
    
    subgraph "プロジェクトツリー（P）推奨構造"
        PRoot["Projects Root"]
        
        Active["🚀 Active Projects"]
        Planning["📋 Planning"]
        Completed["✅ Completed"]
        Templates["📝 Templates"]
        
        Project1["プロジェクトA"]
        Project2["プロジェクトB"]
        
        PRoot --> Active
        PRoot --> Planning
        PRoot --> Completed
        PRoot --> Templates
        
        Active --> Project1
        Active --> Project2
    end
    
    classDef root fill:#e1f5fe
    classDef category fill:#f3e5f5
    classDef item fill:#fff3e0
    
    class RRoot,PRoot root
    class Documents,Images,Data,Archive,Active,Planning,Completed,Templates category
    class Docs1,Docs2,Docs3,Project1,Project2 item
```

**初期ノード作成手順**

| ステップ | 操作 | 作成内容 |
|----------|------|----------|
| 1 | ツリー選択 | Resources または Projects |
| 2 | 右クリックメニュー | 「新しいフォルダ作成」 |
| 3 | 名前入力 | カテゴリ名を入力 |
| 4 | アイコン選択 | 適切なアイコンを選択 |
| 5 | 説明入力 | 用途を説明 |
| 6 | 保存 | ノード作成完了 |

#### 3.3.2 サンプルデータ利用 ❌❌

学習目的でサンプルデータを利用できます（環境により提供状況が異なります）。

**サンプルデータの種類**

```mermaid
graph LR
    subgraph "利用可能サンプル"
        OfficeSample["オフィス管理"]
        ProjectSample["プロジェクト管理"]
        DocumentSample["文書管理"]
        GeoSample["地理データ"]
        
        OfficeContent["・部門構成<br/>・従業員情報<br/>・資産管理"]
        ProjectContent["・開発プロジェクト<br/>・タスク管理<br/>・進捗追跡"]
        DocumentContent["・文書分類<br/>・バージョン管理<br/>・検索タグ"]
        GeoContent["・地図データ<br/>・境界情報<br/>・レイヤー管理"]
        
        OfficeSample --> OfficeContent
        ProjectSample --> ProjectContent
        DocumentSample --> DocumentContent
        GeoSample --> GeoContent
    end
    
    classDef sample fill:#e1f5fe
    classDef content fill:#f3e5f5
    
    class OfficeSample,ProjectSample,DocumentSample,GeoSample sample
    class OfficeContent,ProjectContent,DocumentContent,GeoContent content
```

#### 3.3.3 データインポート ⭐️⭐️⭐️

既存データをHierarchiDBに取り込む方法です。

**対応インポート形式**

| 形式 | 拡張子 | 対応プラグイン | 制限事項 |
|------|--------|----------------|----------|
| **JSON** | .json | 全プラグイン | 構造データのみ |
| **CSV** | .csv | Spreadsheet | 表形式データのみ |
| **Shapefile** | .shp | Shape | 地理データのみ |
| **ZIP** | .zip | 全プラグイン | 圧縮ファイル対応 |

**インポート手順**

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as UI画面
    participant Import as インポート機能
    participant Validator as データ検証
    participant Storage as データ保存
    
    User->>UI: インポートボタンクリック
    UI->>User: ファイル選択ダイアログ
    User->>UI: ファイル選択
    UI->>Import: ファイルアップロード
    Import->>Validator: データ形式チェック
    Validator->>Import: 検証結果返却
    Import->>Storage: データ保存
    Storage->>UI: 完了通知
    UI->>User: インポート完了表示
```

**インポート時の注意事項**

- **データ形式の確認**: 対応形式であることを事前に確認
- **ファイルサイズ制限**: 大きなファイルは分割推奨（目安：10MB以下）
- **文字エンコード**: UTF-8形式を推奨
- **階層構造**: 既存のツリー構造との整合性を確認
- **バックアップ**: インポート前に既存データのバックアップを推奨

**まとめ**

HierarchiDBのセットアップは、ブラウザからのアクセスと基本設定だけで完了します。適切なブックマーク設定とショートカット作成により、日常的な利用が便利になります。初期データの準備とサンプルデータの活用により、すぐに実用的な利用を開始できます。
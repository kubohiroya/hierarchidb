# 第2部 動作条件

## Chapter 2: システム要件

この章では、HierarchiDBを快適に利用するために必要なシステム要件について説明します。ブラウザの種類やバージョン、ハードウェア要件、ソフトウェア設定など、事前に確認すべき動作条件を詳しく解説します。適切な環境を準備することで、HierarchiDBの性能を最大限に活用できます。

```mermaid
mindmap
  root((システム要件))
    ブラウザ要件
      推奨ブラウザ
      最小要件
      互換性情報
    ハードウェア要件
      CPU・メモリ要件
      ストレージ要件
      ネットワーク要件
    ソフトウェア要件
      必須ソフトウェア
      推奨設定
      セキュリティ設定
```

### 2.1 ブラウザ要件

#### 2.1.1 推奨ブラウザ

HierarchiDBは、最新のWeb標準に基づいて開発されており、モダンブラウザでの利用を推奨します。

**推奨ブラウザとバージョン**

| ブラウザ | 推奨バージョン | サポート状況 | 特記事項 |
|----------|----------------|--------------|----------|
| **Google Chrome** | 90以上 | 完全サポート | 最高のパフォーマンス |
| **Mozilla Firefox** | 88以上 | 完全サポート | プライバシー重視ユーザーに推奨 |
| **Microsoft Edge** | 90以上 | 完全サポート | Windows環境で最適化 |
| **Safari** | 14以上 | 完全サポート | macOS/iOS環境で最適化 |

```mermaid
graph TB
    subgraph "ブラウザ対応状況"
        Chrome["Google Chrome 90+"]
        Firefox["Mozilla Firefox 88+"]
        Edge["Microsoft Edge 90+"]
        Safari["Safari 14+"]
        
        FullSupport["完全サポート<br/>・全機能利用可能<br/>・最適化済み<br/>・定期テスト実施"]
        
        Chrome --> FullSupport
        Firefox --> FullSupport
        Edge --> FullSupport
        Safari --> FullSupport
    end
    
    classDef browser fill:#e1f5fe
    classDef support fill:#e8f5e9
    
    class Chrome,Firefox,Edge,Safari browser
    class FullSupport support
```

**ブラウザ機能要件**

HierarchiDBが正常に動作するために必要なブラウザ機能：

| 機能 | 説明 | 確認方法 |
|------|------|----------|
| **JavaScript ES2020** | モダンJavaScript機能 | 自動検出・警告表示 |
| **Web Workers** | バックグラウンド処理 | アプリケーション起動時にチェック |
| **IndexedDB** | クライアントサイドデータベース | 初回アクセス時に確認 |
| **CSS Grid/Flexbox** | レスポンシブレイアウト | 画面表示で確認 |
| **WebGL** | 地図表示（Shape Plugin使用時） | プラグイン使用時にチェック |

#### 2.1.2 最小要件

**動作可能な最小構成**

```mermaid
graph LR
    subgraph "最小動作要件"
        MinChrome["Chrome 85+"]
        MinFirefox["Firefox 82+"]
        MinEdge["Edge 85+"]
        MinSafari["Safari 13+"]
        
        BasicFeature["基本機能<br/>・ツリー表示<br/>・ノード操作<br/>・検索機能"]
        
        MinChrome --> BasicFeature
        MinFirefox --> BasicFeature
        MinEdge --> BasicFeature
        MinSafari --> BasicFeature
    end
    
    classDef min fill:#fff3e0
    classDef basic fill:#f3e5f5
    
    class MinChrome,MinFirefox,MinEdge,MinSafari min
    class BasicFeature basic
```

**制限事項**

| ブラウザ | 制限内容 | 代替手段 |
|----------|----------|----------|
| **旧バージョンChrome (85-89)** | 一部プラグイン機能制限 | ブラウザアップデート推奨 |
| **旧バージョンFirefox (82-87)** | パフォーマンス低下 | 新しいバージョンへの更新 |
| **Internet Explorer** | サポート対象外 | Edgeへの移行 |
| **モバイルブラウザ** | 限定的サポート | デスクトップ版推奨 |

#### 2.1.3 互換性情報

**プラットフォーム別対応状況**

```mermaid
graph TB
    subgraph "プラットフォーム対応"
        Windows["Windows 10/11"]
        macOS["macOS 10.15+"]
        Linux["Linux (Ubuntu 18.04+)"]
        Mobile["モバイル"]
        
        FullComp["完全対応"]
        PartialComp["部分対応"]
        
        Windows --> FullComp
        macOS --> FullComp
        Linux --> FullComp
        Mobile --> PartialComp
    end
    
    classDef platform fill:#e1f5fe
    classDef full fill:#e8f5e9
    classDef partial fill:#fff3e0
    
    class Windows,macOS,Linux platform
    class FullComp full
    class Mobile,PartialComp partial
```

### 2.2 ハードウェア要件

#### 2.2.1 CPU・メモリ要件

**推奨スペック**

| 項目 | 最小要件 | 推奨要件 | 高負荷対応 | 備考 |
|------|----------|----------|------------|------|
| **CPU** | 2コア 2GHz | 4コア 2.5GHz | 8コア 3GHz+ | 地図処理時に高負荷 |
| **メモリ** | 4GB | 8GB | 16GB+ | 大量データ処理時必要 |
| **GPU** | 不要 | 統合GPU | 専用GPU | WebGL使用時に有効 |

```mermaid
graph LR
    subgraph "メモリ使用量目安"
        Small["小規模<br/>1,000ノード<br/>~500MB"]
        Medium["中規模<br/>10,000ノード<br/>~2GB"]
        Large["大規模<br/>100,000ノード<br/>~8GB"]
        
        Performance1["快適動作"]
        Performance2["やや重い"]
        Performance3["専用推奨"]
        
        Small --> Performance1
        Medium --> Performance2
        Large --> Performance3
    end
    
    classDef scale fill:#e1f5fe
    classDef perf fill:#f3e5f5
    
    class Small,Medium,Large scale
    class Performance1,Performance2,Performance3 perf
```

#### 2.2.2 ストレージ要件

**ディスク容量**

| 用途 | 容量 | 説明 |
|------|------|------|
| **アプリケーション** | 50MB | ブラウザキャッシュ |
| **ユーザーデータ** | 1GB～ | IndexedDBストレージ |
| **一時ファイル** | 500MB | インポート・エクスポート用 |
| **合計推奨容量** | 2GB以上 | 余裕をもった容量 |

#### 2.2.3 ネットワーク要件

**接続要件**

```mermaid
graph TB
    subgraph "ネットワーク要件"
        InitialLoad["初回読み込み<br/>10Mbps推奨"]
        NormalOp["通常操作<br/>1Mbps以上"]
        Realtime["リアルタイム更新<br/>安定した接続"]
        
        DataTransfer["データ転送量"]
        InitialDownload["初回: ~10MB"]
        DailyUsage["日常: ~100KB/時間"]
        BulkOp["一括操作: ~10MB"]
        
        InitialLoad --> InitialDownload
        NormalOp --> DailyUsage
        Realtime --> BulkOp
    end
    
    classDef network fill:#e1f5fe
    classDef data fill:#f3e5f5
    
    class InitialLoad,NormalOp,Realtime network
    class InitialDownload,DailyUsage,BulkOp data
```

### 2.3 ソフトウェア要件

#### 2.3.1 必須ソフトウェア

**基本要件**

| ソフトウェア | 要件 | 用途 |
|--------------|------|------|
| **ブラウザ** | 前述の対応ブラウザ | アプリケーション実行環境 |
| **JavaScript** | 有効化必須 | アプリケーション動作 |
| **Cookie** | 有効化推奨 | セッション管理 |
| **Local Storage** | 有効化必須 | 設定保存 |

**オプション要件**

| ソフトウェア | 用途 | 必須度 |
|--------------|------|--------|
| **PDF リーダー** | PDF表示 | 推奨 |
| **Office ソフト** | ファイル編集 | オプション |
| **圧縮ソフト** | ファイル圧縮・展開 | 推奨 |

#### 2.3.2 推奨設定

**ブラウザ設定**

```mermaid
graph LR
    subgraph "ブラウザ推奨設定"
        Security["セキュリティ設定"]
        Privacy["プライバシー設定"]
        Performance["パフォーマンス設定"]
        
        SecureSettings["・HTTPS必須<br/>・混合コンテンツブロック<br/>・安全でないスクリプト無効"]
        PrivacySettings["・サードパーティCookie許可<br/>・ポップアップブロック例外<br/>・通知許可設定"]
        PerfSettings["・ハードウェアアクセラレーション有効<br/>・キャッシュサイズ拡張<br/>・メモリ使用量最適化"]
        
        Security --> SecureSettings
        Privacy --> PrivacySettings
        Performance --> PerfSettings
    end
    
    classDef setting fill:#e1f5fe
    classDef detail fill:#f3e5f5
    
    class Security,Privacy,Performance setting
    class SecureSettings,PrivacySettings,PerfSettings detail
```

**システム設定**

| 設定項目 | 推奨値 | 理由 |
|----------|--------|------|
| **仮想メモリ** | 物理メモリの1.5倍 | 大量データ処理時の安定性 |
| **一時フォルダ** | 十分な空き容量 | ファイル処理時の作業領域 |
| **ウイルス対策** | リアルタイム保護 | セキュリティ確保 |
| **ファイアウォール** | 適切な設定 | 通信許可設定 |

#### 2.3.3 セキュリティ設定

**必須セキュリティ設定**

```mermaid
graph TB
    subgraph "セキュリティ設定項目"
        HTTPS["HTTPS接続必須"]
        CSP["Content Security Policy"]
        CORS["CORS設定"]
        Auth["認証設定"]
        
        HTTPSDetail["・SSL証明書検証<br/>・混合コンテンツブロック<br/>・安全でない接続拒否"]
        CSPDetail["・スクリプト実行制限<br/>・リソース読み込み制限<br/>・インライン実行禁止"]
        CORSDetail["・許可ドメイン設定<br/>・プリフライトリクエスト<br/>・認証情報送信制限"]
        AuthDetail["・OAuth2.0対応<br/>・JWT トークン<br/>・セッション管理"]
        
        HTTPS --> HTTPSDetail
        CSP --> CSPDetail
        CORS --> CORSDetail
        Auth --> AuthDetail
    end
    
    classDef security fill:#ffebee
    classDef detail fill:#f3e5f5
    
    class HTTPS,CSP,CORS,Auth security
    class HTTPSDetail,CSPDetail,CORSDetail,AuthDetail detail
```

**セキュリティチェックリスト**

| 項目 | 確認内容 | 重要度 |
|------|----------|--------|
| ✅ **HTTPS接続** | URLがhttps://で始まる | 必須 |
| ✅ **証明書検証** | SSL証明書が有効 | 必須 |
| ✅ **Cookie設定** | セキュアフラグ設定 | 推奨 |
| ✅ **パスワード** | 強固なパスワード使用 | 必須 |
| ✅ **二要素認証** | 可能な場合は有効化 | 推奨 |
| ✅ **定期更新** | ブラウザの定期更新 | 推奨 |

**まとめ**

HierarchiDBを快適に利用するためには、適切なシステム環境の準備が重要です。推奨ブラウザの使用、十分なハードウェアスペック、適切なセキュリティ設定により、アプリケーションの性能を最大限に活用できます。特にセキュリティ設定は、データ保護の観点から必須の要件となります。
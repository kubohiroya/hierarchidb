/**
  * Japanese translations for Location Plugin
   */

import type { LocationPluginTranslations } from './types.js';

export const ja: LocationPluginTranslations = {
  common: {
    name: '名前',
    description: '説明',
    category: 'カテゴリ',
    tags: 'タグ',
    required: '必須',
    optional: '任意',
    save: '保存',
    cancel: 'キャンセル',
    close: '閉じる',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    warning: '警告',
  },

  basicInfo: {
    title: '基本情報',
    subtitle: '地点情報の基本的な設定を行います。タグとカテゴリを使用して地点を分類・検索しやすくできます。',
    nameLabel: '地点データ名',
    nameHelperText: 'わかりやすいデータセット名を入力してください',
    nameRequired: '地点データ名は必須です',
    descriptionLabel: '説明',
    descriptionHelperText: 'データセットの用途や内容について説明してください（任意）',
    categoryLabel: 'カテゴリ',
    categoryHelperText: '地点データのカテゴリを選択してください',
    tagsLabel: 'タグ',
    tagsHelperText: '検索やフィルタリングに使用するタグをカンマ区切りで入力してください（任意）',
    tagsPlaceholder: 'タグ1, タグ2, タグ3',
    hint: '💡 ヒント：適切な名前とタグを設定することで、後でデータを見つけやすくなります',
  },

  selection: {
    title: '地点選択',
    subtitle: '取得する地点データを選択してください。国と地点タイプの組み合わせでデータを指定できます。',
    alertMessage: '取得する地点データを選択してください。国と地点タイプの組み合わせでデータを指定できます。',
    matrixTitle: '選択マトリックス',
    settingsTitle: '地点タイプ別詳細設定',
    searchPlaceholder: '国名で検索...',
    continentFilter: '大陸フィルター',
    showSelectedOnly: '選択済みのみ表示',
    selectAll: 'すべて選択',
    deselectAll: 'すべて解除',
    selectedCount: '選択数',
    estimatedSize: '推定データサイズ',
  },

  batch: {
    progressTitle: '進捗状況',
    logsTitle: 'ログ',
    mapPreviewTitle: 'マップ プレビュー',
    dataTableTitle: 'データテーブル',
    pause: '一時停止',
    resume: '再開',
    cancel: 'キャンセル',
    download: 'ダウンロード',
    exportLogs: 'ログエクスポート',
    stages: {
      download: 'ダウンロード',
      filtering: 'フィルタリング',
      clustering: 'クラスタリング',
      indexing: 'インデックス作成',
    },
  },

  locationTypes: {
    airport: '空港',
    railway_station: '駅',
    bus_stop: 'バス停',
    port: '港',
    hospital: '病院',
    school: '学校',
    university: '大学',
    tourist_attraction: '観光地',
    hotel: 'ホテル',
    restaurant: 'レストラン',
    shopping: 'ショッピング',
    park: '公園',
    library: '図書館',
    museum: '博物館',
    bank: '銀行',
    post_office: '郵便局',
    fire_station: '消防署',
    police: '警察',
    government: '行政',
    religious: '宗教施設',
  },

  categories: {
    transportation: '交通機関',
    administrative: '行政機関',
    infrastructure: 'インフラ',
  },

  errors: {
    nameRequired: '名前は必須です',
    invalidSelection: '選択が無効です',
    processingFailed: '処理に失敗しました',
    networkError: 'ネットワークエラーが発生しました',
    dataNotFound: 'データが見つかりません',
  },
};
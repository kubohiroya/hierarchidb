/**
 * Japanese translations for Route Plugin
 */

import type { RoutePluginTranslations } from './types.js';

export const ja: RoutePluginTranslations = {
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

  dataSource: {
    title: 'データソース',
    description: 'ルート生成の元になるデータセットまたはサービスを選択してください。',
    selectionTitle: 'データソース',
    detailsTitle: 'データソース詳細',
    licenseRequired: '続行するにはライセンス同意が必要です。',
    clearCache: '選択中データソースのキャッシュを削除',
    cacheCleared: '選択中データソースのキャッシュを削除しました。',
    cacheClearFailed: 'データソースのキャッシュ削除に失敗しました。',
    cacheMissing: '先にデータソースを選択してください。',
    cacheMissingNode: 'NodeId が不足しています。',
  },

  basicInfo: {
    title: 'ルート基本情報',
    subtitle:
      'ルート情報の基本的な設定を行います。ルートタイプや交通手段を指定してルートを分類できます。',
    nameLabel: 'ルート名',
    nameHelperText: 'わかりやすいルート名を入力してください',
    nameRequired: 'ルート名は必須です',
    descriptionLabel: '説明',
    descriptionHelperText: 'ルートの用途や特徴について説明してください（任意）',
    routeTypeLabel: 'ルートタイプ',
    routeTypeHelperText: 'ルートの種類を選択してください',
    transportModesLabel: '対応交通手段',
    transportModesHelperText: 'このルートで利用可能な交通手段を選択してください',
    categoryLabel: 'カテゴリ',
    categoryHelperText: 'ルートのカテゴリを選択してください',
    tagsLabel: 'タグ',
    tagsHelperText: '検索やフィルタリングに使用するタグをカンマ区切りで入力してください（任意）',
    tagsPlaceholder: 'タグ1, タグ2, タグ3',
    hint: '💡 ヒント：適切なルートタイプと交通手段を設定することで、ユーザーが目的に合ったルートを見つけやすくなります',
  },

  routeSelection: {
    title: 'ルート選択・設定',
    subtitle:
      '取得・生成するルートの条件を設定してください。地域やルートタイプ、交通手段の組み合わせでルートを指定できます。',
    alertMessage:
      '取得・生成するルートの条件を設定してください。地域やルートタイプ、交通手段の組み合わせでルートを指定できます。',
    routeTypeSettings: 'ルートタイプ別設定',
    transportModeSettings: '交通手段別設定',
    parametersTitle: 'ルートパラメータ',
    maxDistance: '最大距離 (km)',
    maxDuration: '最大所要時間 (分)',
    elevationGain: '標高差 (m)',
    surfaceTypes: '路面タイプ',
    difficultyLevel: '難易度',
    accessibility: 'アクセシビリティ',
  },

  build: {
    progressTitle: '進捗状況',
    logsTitle: 'ログ',
    mapPreviewTitle: 'ルートプレビュー',
    routeTableTitle: 'ルートテーブル',
    pause: '一時停止',
    resume: '再開',
    cancel: 'キャンセル',
    download: 'ダウンロード',
    exportRoutes: 'ルートエクスポート',
    pauseTooltip: '処理を一時停止',
    resumeTooltip: '処理を再開',
    cancelTooltip: 'バッチ処理をキャンセル',
    stages: {
      planning: 'ルート計画',
      routing: 'ルート生成',
      optimization: '最適化',
      validation: 'バリデーション',
      resolving_locations: '位置情報の解決',
      generating_routes: 'ルート生成',
      validating: '結果の検証',
      optimizing: '最適化',
      download: 'ダウンロード',
      extract1: '形状の抽出',
      extract2: '形状の検証',
      tileEmit: 'TileEmit 生成',
    },
    phases: {
      running: '実行中',
      queued: '待機中',
      completed: '完了',
      failed: '失敗',
      paused: '一時停止',
    },
    summary: {
      completedLabel: '完了',
      totalLabel: '総数',
      failedLabel: '失敗',
      resultsLabel: '結果',
      lastErrorLabel: '最新のエラー',
      noneLabel: 'なし',
    },
  },

  routeTypes: {
    road: '道路',
    railway: '鉄道',
    waterway: '水路',
    airway: '航空路',
    walking: '歩行',
    cycling: '自転車',
    hiking: 'ハイキング',
    shipping: '海運',
    pipeline: 'パイプライン',
    powerline: '送電線',
  },

  transportModes: {
    car: '自動車',
    truck: 'トラック',
    bus: 'バス',
    train: '電車',
    subway: '地下鉄',
    tram: '路面電車',
    ferry: 'フェリー',
    airplane: '航空機',
    bicycle: '自転車',
    pedestrian: '歩行者',
    motorcycle: 'オートバイ',
  },

  categories: {
    transportation: '交通',
    recreation: 'レクリエーション',
    logistics: '物流',
    emergency: '緊急',
  },

  surfaceTypes: {
    paved: '舗装',
    unpaved: '未舗装',
    gravel: '砂利',
    dirt: '土',
    sand: '砂',
    grass: '草',
    concrete: 'コンクリート',
    asphalt: 'アスファルト',
  },

  difficultyLevels: {
    easy: '初級',
    moderate: '中級',
    difficult: '上級',
    expert: 'エキスパート',
  },

  accessibilityFeatures: {
    wheelchair_accessible: '車椅子対応',
    elevator_access: 'エレベーターアクセス',
    audio_guidance: '音声ガイド',
    braille_signs: '点字標識',
    low_slope: '低勾配',
  },

  errors: {
    nameRequired: 'ルート名は必須です',
    routeTypeRequired: 'ルートタイプは必須です',
    transportModeRequired: '交通手段を最低1つ選択してください',
    invalidRouteData: 'ルートデータが無効です',
    routingFailed: 'ルート生成に失敗しました',
    networkError: 'ネットワークエラーが発生しました',
    dataNotFound: 'データが見つかりません',
  },
};

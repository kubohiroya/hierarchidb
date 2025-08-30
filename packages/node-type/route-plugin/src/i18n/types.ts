/**
 * i18n Types for Route Plugin
 * ルートプラグインのi18n型定義
 */

export type SupportedLocale = 'ja' | 'en';

export interface RoutePluginTranslations {
  // 共通
  common: {
    name: string;
    description: string;
    category: string;
    tags: string;
    required: string;
    optional: string;
    save: string;
    cancel: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
  };

  // 基本情報
  basicInfo: {
    title: string;
    subtitle: string;
    nameLabel: string;
    nameHelperText: string;
    nameRequired: string;
    descriptionLabel: string;
    descriptionHelperText: string;
    routeTypeLabel: string;
    routeTypeHelperText: string;
    transportModesLabel: string;
    transportModesHelperText: string;
    categoryLabel: string;
    categoryHelperText: string;
    tagsLabel: string;
    tagsHelperText: string;
    tagsPlaceholder: string;
    hint: string;
  };

  // ルート選択
  routeSelection: {
    title: string;
    subtitle: string;
    alertMessage: string;
    routeTypeSettings: string;
    transportModeSettings: string;
    parametersTitle: string;
    maxDistance: string;
    maxDuration: string;
    elevationGain: string;
    surfaceTypes: string;
    difficultyLevel: string;
    accessibility: string;
  };

  // バッチ処理
  batch: {
    progressTitle: string;
    logsTitle: string;
    mapPreviewTitle: string;
    routeTableTitle: string;
    pause: string;
    resume: string;
    cancel: string;
    download: string;
    exportRoutes: string;
    stages: {
      planning: string;
      routing: string;
      optimization: string;
      validation: string;
    };
  };

  // ルートタイプ
  routeTypes: {
    road: string;
    railway: string;
    waterway: string;
    airway: string;
    walking: string;
    cycling: string;
    hiking: string;
    shipping: string;
    pipeline: string;
    powerline: string;
  };

  // 交通モード
  transportModes: {
    car: string;
    truck: string;
    bus: string;
    train: string;
    subway: string;
    tram: string;
    ferry: string;
    airplane: string;
    bicycle: string;
    pedestrian: string;
    motorcycle: string;
  };

  // カテゴリ
  categories: {
    transportation: string;
    recreation: string;
    logistics: string;
    emergency: string;
  };

  // 表面タイプ
  surfaceTypes: {
    paved: string;
    unpaved: string;
    gravel: string;
    dirt: string;
    sand: string;
    grass: string;
    concrete: string;
    asphalt: string;
  };

  // 難易度レベル
  difficultyLevels: {
    easy: string;
    moderate: string;
    difficult: string;
    expert: string;
  };

  // アクセシビリティ機能
  accessibilityFeatures: {
    wheelchair_accessible: string;
    elevator_access: string;
    audio_guidance: string;
    braille_signs: string;
    low_slope: string;
  };

  // エラーメッセージ
  errors: {
    nameRequired: string;
    routeTypeRequired: string;
    transportModeRequired: string;
    invalidRouteData: string;
    routingFailed: string;
    networkError: string;
    dataNotFound: string;
  };
}
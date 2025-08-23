# Shape Plugin UI仕様書

## 1. 概要

ShapesPluginは、HierarchiDBの地理空間データ処理プラグインです。`@hierarchidb/ui-dialog`パッケージを活用し、X-dialog.md準拠のプラグインダイアログとして実装されます。

### 1.1 ダイアログ構成

本プラグインは以下の2つのダイアログから構成されます：

1. **メインダイアログ（ShapesStepperDialog）**: 5ステップの設定ダイアログ
2. **バッチ処理監視ダイアログ（BatchProcessingMonitorDialog）**: 全画面処理監視ダイアログ

### 1.2 実行フロー

```
Step 1: Basic Information → 
Step 2: Data Source Selection → 
Step 3: License Agreement → 
Step 4: Processing Configuration → 
Step 5: Country Selection & Batch Start →
[メインダイアログ終了] →
BatchProcessingMonitorDialog（全画面）→ 
[バッチ処理完了] →
[両ダイアログクローズ、保存完了]
```

### 1.3 技術スタック
- **ベースコンポーネント**: `@hierarchidb/ui-dialog` パッケージの `StepperDialog`
- **状態管理**: `@hierarchidb/ui-dialog` の `useWorkingCopy`, `useDialogContext`
- **仮想化**: `@tanstack/react-virtual` (既存プロジェクトで採用済み)
- **分割表示**: `allotment` (4ペイン分割)
- **UI フレームワーク**: Material-UI v5 (`@hierarchidb/ui-core`で提供)
- **TypeScript**: フル型安全サポート（ブランド型使用）

## 2. メインダイアログ（ShapesStepperDialog）

### 2.1 基本構成

5ステップのウィザード形式で地理データの設定を行う。

```tsx
import { StepperDialog, useWorkingCopy, useDialogContext } from '@hierarchidb/ui-dialog';
import { FullscreenIcon, FullscreenExitIcon, PlayArrowIcon } from '@hierarchidb/ui-core/icons';

export const ShapesStepperDialog = ({ mode, nodeId, parentNodeId, onClose }) => {
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  
  // Working Copy管理
  const {
    workingCopy,
    updateWorkingCopy,
    commitChanges,
    discardChanges,
    saveAsDraft,
    isDirty,
    isProcessing,
  } = useWorkingCopy<ShapesEntity>({
    mode,
    nodeId,
    parentNodeId,
    initialData: getInitialShapesData(),
    onCommit: async (data) => {
      await shapesService.saveEntity(data);
    },
  });

  // Step 4-5でのバッチ処理開始条件チェック
  const canStartBatch = useMemo(() => {
    return (
      workingCopy.name?.length > 0 &&
      !!workingCopy.dataSourceName &&
      workingCopy.licenseAgreement === true &&
      validateProcessingConfig(workingCopy.processingConfig) &&
      hasSelectedCountries(workingCopy)
    );し
  }, [workingCopy]);

  // バッチ処理開始（Step 4-5から可能）
  const handleStartBatch = useCallback(() => {
    setBatchDialogOpen(true);
  }, []);

  // バッチダイアログからの復帰
  const handleBatchDialogClose = useCallback(() => {
    setBatchDialogOpen(false);
    // バッチダイアログを閉じたときはメインダイアログに戻る（終了しない）
  }, []);

  const steps = [
    {
      label: 'Basic Information',
      content: <BasicInfoStep workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => workingCopy.name?.length > 0,
    },
    {
      label: 'Data Source',
      content: <DataSourceSelectStep workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => !!workingCopy.dataSourceName,
    },
    {
      label: 'License Agreement',
      content: <LicenseAgreementStep workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => workingCopy.licenseAgreement === true,
    },
    {
      label: 'Processing Configuration',
      content: <ProcessingConfigStep workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => validateProcessingConfig(workingCopy.processingConfig),
    },
    {
      label: 'Country Selection',
      content: (
        <CountryAdminMatrixStep 
          workingCopy={workingCopy} 
          onUpdate={updateWorkingCopy}
        />
      ),
      validate: () => hasSelectedCountries(workingCopy),
    },
  ];

  return (
    <>
      <StepperDialog
        mode={mode}
        open={true}
        nodeId={nodeId}
        parentNodeId={parentNodeId}
        title="Shape Data Configuration"
        icon={<CategoryIcon />}
        steps={steps}
        hasUnsavedChanges={isDirty}
        supportsDraft={true}
        onSubmit={commitChanges}
        onSaveDraft={saveAsDraft}
        onCancel={discardChanges}
        maxWidth="lg"
        nonLinear={mode === 'edit'}
        
        // カスタムフッター（Start Batchボタン常時表示）
        customFooterContent={({ currentStep, isFirstStep, isLastStep, canGoNext, onBack, onNext }) => (
          <CustomStepperFooter
            currentStep={currentStep}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            canGoNext={canGoNext}
            canStartBatch={canStartBatch}
            showStartBatch={currentStep >= 3} // Step 4-5で表示
            onBack={onBack}
            onNext={onNext}
            onCancel={discardChanges}
            onStartBatch={handleStartBatch}
          />
        )}
      />
      
      {/* バッチ処理監視ダイアログ */}
      <BatchProcessingMonitorDialog
        open={batchDialogOpen}
        onClose={handleBatchDialogClose}
        nodeId={nodeId}
        config={workingCopy.processingConfig}
        urlMetadata={workingCopy.urlMetadata}
        onBatchCompleted={() => {
          // バッチ完了時は両ダイアログを閉じて保存
          setBatchDialogOpen(false);
          commitChanges();
          onClose();
        }}
      />
    </>
  );
};

// カスタムフッター（Start Batchボタン常時表示）
const CustomStepperFooter = ({
  currentStep,
  isFirstStep,
  isLastStep,
  canGoNext,
  canStartBatch,
  showStartBatch,
  onBack,
  onNext,
  onCancel,
  onStartBatch,
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
      {/* 左側ボタン */}
      <Button
        onClick={isFirstStep ? onCancel : onBack}
        variant="outlined"
        size="large"
      >
        {isFirstStep ? 'Cancel' : 'Back'}
      </Button>
      
      {/* 右側ボタン群 */}
      <Stack direction="row" spacing={2}>
        {!isLastStep && (
          <Button
            onClick={onNext}
            variant="contained"
            size="large"
            disabled={!canGoNext}
          >
            Next
          </Button>
        )}
        
        {showStartBatch && (
          <Button
            onClick={onStartBatch}
            variant="contained"
            size="large"
            disabled={!canStartBatch}
            color="success"
            startIcon={<PlayArrowIcon />}
            sx={{ minWidth: 140 }}
          >
            Start Batch
          </Button>
        )}
        
        {isLastStep && !showStartBatch && (
          <Button
            onClick={onNext}
            variant="contained"
            size="large"
            disabled={!canGoNext}
          >
            Save
          </Button>
        )}
      </Stack>
    </Box>
  );
};
```

### 2.2 各ステップの実装

## Step 1: Basic Information

**目的**: ノードの基本情報（名前・説明）の入力

```tsx
interface BasicInfoStepProps {
  workingCopy: ShapeWorkingCopy;
  onUpdate: (updates: Partial<ShapeWorkingCopy>) => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ workingCopy, onUpdate }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Provide basic information for this geographic data configuration.
      </Typography>
      
      <Stack spacing={3}>
        <TextField
          label="Name"
          value={workingCopy.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          required
          fullWidth
          error={!workingCopy.name}
          helperText={!workingCopy.name ? 'Name is required' : 'Enter a descriptive name for this configuration'}
        />
        
        <TextField
          label="Description"
          value={workingCopy.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          multiline
          rows={3}
          fullWidth
          helperText="Optional description of this geographic data configuration"
        />
      </Stack>
    </Box>
  );
};
```

**バリデーション**: 名前必須（`name.length > 0`）

## Step 2: Data Source Selection

**目的**: 4つの地理データプロバイダーから1つを選択

**実装**: `packages/plugins/shape/src/components/DataSourceSelector/DataSourceSelectPanel.tsx` として既に移植済み

```tsx
const DataSourceSelectStep = ({ workingCopy, onUpdate }) => {
  const handleDataSourceSelect = (dataSourceName: string) => {
    onUpdate({ 
      dataSourceName,
      licenseAgreement: false, // リセット
      licenseAgreedAt: undefined 
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose a geographic data provider. Each source has different coverage, accuracy, and licensing requirements.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {DATA_SOURCES.map((dataSource) => (
          <Grid item xs={12} sm={6} key={dataSource.name}>
            <DataSourceCard
              dataSource={dataSource}
              isSelected={workingCopy.dataSourceName === dataSource.name}
              onSelect={() => handleDataSourceSelect(dataSource.name)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const DataSourceCard = ({ dataSource, isSelected, onSelect }) => {
  return (
    <Card 
      variant={isSelected ? "outlined" : "elevation"}
      sx={{ 
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        '&:hover': { boxShadow: 3 }
      }}
      onClick={onSelect}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: dataSource.color }}>
            {dataSource.icon}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1">
              {dataSource.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dataSource.description}
            </Typography>
          </Box>
          {isSelected && <CheckCircleIcon color="primary" />}
        </Stack>
      </CardContent>
    </Card>
  );
};
```

**データソース**:
- **Natural Earth**: パブリックドメイン、シンプルな世界地図
- **geoBoundaries**: オープンソース、詳細な行政境界  
- **GADM**: 学術利用、非常に詳細なデータ
- **OpenStreetMap**: ODbL、コミュニティベース

**バリデーション**: データソース選択必須（`!!dataSourceName`）

## Step 3: License Agreement

**目的**: 選択したデータソースのライセンス条項への同意

**重要変更**: チェックボックス削除、ボタンクリックのみで同意

```tsx
const LicenseAgreementStep = ({ workingCopy, onUpdate }) => {
  const dataSource = DATA_SOURCE_CONFIGS[workingCopy.dataSourceName];
  
  const handleLicenseAgreement = () => {
    // 外部リンク開く + 同意フラグセット
    window.open(dataSource.licenseUrl, '_blank', 'noopener,noreferrer');
    onUpdate({ 
      licenseAgreement: true,
      licenseAgreedAt: new Date().toISOString()
    });
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        License Agreement
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Please review and agree to the licensing requirements for {dataSource.displayName}.
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>{dataSource.displayName} License</AlertTitle>
        
        <Stack spacing={2}>
          <Typography variant="body2">
            <strong>License Type:</strong> {dataSource.license}
          </Typography>
          
          <Typography variant="body2">
            <strong>Attribution:</strong> {dataSource.attribution}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            By clicking the button below, you acknowledge that you have read and 
            agree to comply with the licensing requirements.
          </Typography>
          
          <Button
            variant={workingCopy.licenseAgreement ? "outlined" : "contained"}
            color={workingCopy.licenseAgreement ? "success" : "warning"}
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={handleLicenseAgreement}
            fullWidth
            sx={{ mt: 2 }}
          >
            {workingCopy.licenseAgreement 
              ? "License Agreed - View Details" 
              : "View License Terms & Agree"
            }
          </Button>
        </Stack>
      </Alert>
      
      {workingCopy.licenseAgreement && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="body2">
              ✓ You have agreed to the {dataSource.license} license terms for {dataSource.displayName}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Agreed on: {new Date(workingCopy.licenseAgreedAt).toLocaleString()}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
```

**バリデーション**: ボタンクリックでライセンス同意フラグtrue、Next有効化

## Step 4: Processing Configuration

**目的**: バッチ処理の詳細設定 - ダウンロード、簡略化、ベクタータイル生成の各段階設定

**主要機能**:
- **アコーディオン式設定パネル**: 3つの処理段階別設定
- **同時実行数制御**: ダウンロード・処理の並行数設定
- **品質パラメータ**: 簡略化の許容誤差、ベクタータイル品質設定

```tsx
const ProcessingConfigStep = ({ workingCopy, onUpdate }) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Configure Processing Parameters
      </Typography>
      
      {/* ダウンロード設定アコーディオン */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CloudDownloadIcon color="primary" />
            <Typography variant="subtitle1">Download Configuration</Typography>
            <Chip 
              label={`${workingCopy.processingConfig?.concurrentDownloads || 2} concurrent`}
              size="small" variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Concurrent Downloads</Typography>
              <Slider
                value={workingCopy.processingConfig?.concurrentDownloads || 2}
                onChange={(_, value) => onUpdate({
                  processingConfig: {
                    ...workingCopy.processingConfig,
                    concurrentDownloads: value as number
                  }
                })}
                min={1} max={8} step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                ]}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="CORS Proxy Base URL"
                value={workingCopy.processingConfig?.corsProxyBaseURL || ''}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...workingCopy.processingConfig,
                    corsProxyBaseURL: e.target.value
                  }
                })}
                fullWidth
                placeholder="https://cors-anywhere.herokuapp.com/"
                helperText="Optional proxy for cross-origin requests"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* 簡略化ステージ1設定アコーディオン */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FilterAltIcon color="secondary" />
            <Typography variant="subtitle1">Feature Processing (Stage 1)</Typography>
            <Chip 
              label={workingCopy.processingConfig?.enableFeatureFiltering ? 'Filtering ON' : 'Filtering OFF'}
              size="small"
              color={workingCopy.processingConfig?.enableFeatureFiltering ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={workingCopy.processingConfig?.enableFeatureFiltering || false}
                  onChange={(e) => onUpdate({
                    processingConfig: {
                      ...workingCopy.processingConfig,
                      enableFeatureFiltering: e.target.checked
                    }
                  })}
                />
              }
              label="Enable Feature Filtering"
            />
            
            {workingCopy.processingConfig?.enableFeatureFiltering && (
              <>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Filtering Method</FormLabel>
                  <RadioGroup
                    value={workingCopy.processingConfig?.featureFilterMethod || 'hybrid'}
                    onChange={(e) => onUpdate({
                      processingConfig: {
                        ...workingCopy.processingConfig,
                        featureFilterMethod: e.target.value as FeatureFilterMethod
                      }
                    })}
                  >
                    <FormControlLabel value="bbox_only" control={<Radio />} label="Bounding Box Only (Fastest)" />
                    <FormControlLabel value="polygon_only" control={<Radio />} label="Polygon Area Only (Most Accurate)" />
                    <FormControlLabel value="hybrid" control={<Radio />} label="Hybrid Method (Balanced)" />
                  </RadioGroup>
                </FormControl>
                
                <Box>
                  <Typography gutterBottom>Feature Area Threshold (%)</Typography>
                  <Slider
                    value={workingCopy.processingConfig?.featureAreaThreshold || 0.1}
                    onChange={(_, value) => onUpdate({
                      processingConfig: {
                        ...workingCopy.processingConfig,
                        featureAreaThreshold: value as number
                      }
                    })}
                    min={0.001} max={10} step={0.001}
                    valueLabelFormat={(value) => `${value}%`}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
      
      {/* ベクタータイル設定アコーディオン */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <LayersIcon color="success" />
            <Typography variant="subtitle1">Vector Tile Generation</Typography>
            <Chip 
              label={`${workingCopy.processingConfig?.concurrentProcesses || 2} concurrent`}
              size="small" variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Concurrent Processes"
                type="number"
                value={workingCopy.processingConfig?.concurrentProcesses || 2}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...workingCopy.processingConfig,
                    concurrentProcesses: parseInt(e.target.value)
                  }
                })}
                inputProps={{ min: 1, max: 8 }}
                fullWidth
                helperText="Number of simultaneous tile processors (1-8)"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Max Zoom Level"
                type="number"
                value={workingCopy.processingConfig?.maxZoomLevel || 12}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...workingCopy.processingConfig,
                    maxZoomLevel: parseInt(e.target.value)
                  }
                })}
                inputProps={{ min: 8, max: 18 }}
                fullWidth
                helperText="Maximum zoom level for vector tiles (8-18)"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
```

## Step 5: Country & Admin Level Selection（仮想化マトリクス + 処理開始制御）

**目的**: 国×行政レベルのマトリクス選択UI、バッチ処理の開始制御

**重要変更**: 
- カスタムフッターによりStart Batchボタンが Step 4-5 で常時表示
- Step 5固有の「Check」ボタンは統計情報パネル内に統合
- バッチ処理開始により別ダイアログへ遷移

```tsx
const CountryAdminMatrixStep = ({ workingCopy, onUpdate }) => {
  const virtuosoRef = useRef<TableVirtuosoHandle | null>(null);
  
  // データソース対応国リスト取得
  const countryMetadataArray = useMemo(() => {
    return getCountryMetadataForDataSource(workingCopy.dataSourceName);
  }, [workingCopy.dataSourceName]);
  
  // 選択可能最大行政レベル
  const maxAdminLevel = useMemo(() => {
    const dataSourceConfig = DataSourceConfigs[workingCopy.dataSourceName];
    return dataSourceConfig?.maxAdminLevel || 0;
  }, [workingCopy.dataSourceName]);
  
  // マトリクス状態管理
  const checkboxMatrix = useMemo(() => {
    if (typeof workingCopy.checkboxState === 'string') {
      return deserializeMatrix(workingCopy.checkboxState);
    }
    return workingCopy.checkboxState || initializeMatrix(countryMetadataArray.length, maxAdminLevel + 1);
  }, [workingCopy.checkboxState, countryMetadataArray.length, maxAdminLevel]);
  
  return (
    <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. 
        Use the matrix to make precise selections or use bulk selection controls.
      </Typography>
      
      {/* 統計情報（Checkボタン統合） */}
      <SelectionStatsWithValidation 
        matrix={checkboxMatrix}
        countries={countryMetadataArray}
        maxAdminLevel={maxAdminLevel}
      />
      
      {/* A-Z インデックスナビゲーション */}
      <AlphabetIndex 
        virtuosoRef={virtuosoRef}
        countries={countryMetadataArray}
      />
      
      {/* 仮想化マトリクステーブル */}
      <Paper sx={{ flex: 1, minHeight: 0 }}>
        <TableVirtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          fixedHeaderContent={() => (
            <MatrixHeader
              adminLevels={maxAdminLevel}
              headerStates={headerStates}
              onSelectAll={handleSelectAll}
              onSelectColumn={handleSelectColumn}
            />
          )}
          data={countryMetadataArray}
          itemContent={(index, country) => (
            <MatrixRow
              key={country.countryCode}
              country={country}
              rowIndex={index}
              adminLevels={maxAdminLevel}
              checkboxStates={checkboxMatrix[index] || []}
              downloadedStates={workingCopy.downloadedMatrix?.[index] || []}
              headerState={headerStates.rowCheckboxes[index]}
              onCellChange={handleCellChange}
              onRowSelect={handleRowSelect}
            />
          )}
          components={{
            Table: (props) => <Table {...props} stickyHeader size="small" />,
            TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
              <TableBody {...props} ref={ref} />
            )),
          }}
        />
      </Paper>
    </Box>
  );
};

// 統計情報 + Checkボタン統合コンポーネント
const SelectionStatsWithValidation = ({ matrix, countries, maxAdminLevel }) => {
  const handleValidateSelection = useCallback(() => {
    const totalSelections = getTotalSelections(matrix);
    const estimatedSize = calculateEstimatedSize(totalSelections);
    const estimatedTime = calculateEstimatedProcessingTime(totalSelections);
    
    enqueueSnackbar(
      `${totalSelections} selections validated. Est. size: ${formatBytes(estimatedSize)}, processing time: ${estimatedTime}`,
      { variant: 'success' }
    );
  }, [matrix]);
  
  // 統計計算
  const stats = useMemo(() => {
    let totalSelected = 0;
    let countriesWithSelection = 0;
    const levelCounts = Array(maxAdminLevel + 1).fill(0);
    
    matrix.forEach((row, countryIndex) => {
      let hasAnySelection = false;
      row.forEach((selected, levelIndex) => {
        if (selected && levelIndex <= maxAdminLevel) {
          totalSelected++;
          levelCounts[levelIndex]++;
          hasAnySelection = true;
        }
      });
      if (hasAnySelection) {
        countriesWithSelection++;
      }
    });
    
    return {
      totalSelected,
      countriesWithSelection,
      levelCounts,
      estimatedSize: calculateEstimatedSize(totalSelected),
      estimatedFeatures: calculateEstimatedFeatures(totalSelected, countries),
    };
  }, [matrix, countries, maxAdminLevel]);
  
  return (
    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
      <Stack direction="row" spacing={4} alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip 
            label={`${stats.countriesWithSelection} countries`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip 
            label={`${stats.totalSelected} selections`}
            size="small"
            color="secondary"
            variant="outlined"
          />
        </Stack>
        
        <Stack direction="row" spacing={1}>
          {stats.levelCounts.map((count, level) => (
            count > 0 && (
              <Chip
                key={level}
                label={`L${level}: ${count}`}
                size="small"
                variant="outlined"
              />
            )
          ))}
        </Stack>
        
        <Stack direction="row" spacing={2} sx={{ ml: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            Est. Size: {formatBytes(stats.estimatedSize)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Est. Features: {formatNumber(stats.estimatedFeatures)}
          </Typography>
          
          <Button
            variant="outlined"
            size="small"
            startIcon={<CheckIcon />}
            onClick={handleValidateSelection}
            disabled={stats.totalSelected === 0}
          >
            Validate
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
```

**Step 5の統合された機能**:
- **統計情報パネル**: 選択数、推定容量、処理時間を常時表示
- **Validate ボタン**: 統計パネル内に統合、詳細検証とスナックバー通知
- **Start Batch**: カスタムフッターで Step 4-5 から常時アクセス可能
- **動線改善**: Step間の移動とバッチ開始が独立して実行可能

## 3. バッチ処理監視ダイアログ（BatchProcessingMonitorDialog）

Step 5完了時に「Start Batch」ボタンクリック → メインダイアログは閉じ、別の全画面ダイアログが開く

### 3.1 全画面ダイアログ構成

**目的**: バッチ処理の実行・監視・完了までの一元管理

**レイアウト**: 全画面ダイアログ（`maxWidth="xl"`, `fullScreen`）

```tsx
interface BatchProcessingMonitorDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  config: BatchConfig;
  urlMetadata: Array<{
    url: string;
    countryCode: string;
    adminLevel: number;
    continent: string;
  }>;
  onBatchCompleted: () => void;
}

const BatchProcessingMonitorDialog = ({ 
  open, onClose, nodeId, config, urlMetadata, onBatchCompleted 
}) => {
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('preparing');
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  
  // ダイアログクローズ制御
  const handleClose = () => {
    if (hasStarted && !hasFinished) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="xl"
      fullScreen // デフォルト全画面、StepperDialogと異なりトグルはヘッダーで制御
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <ShapeIcon />
          <Typography variant="h5">Batch Processing Monitor</Typography>
          <BatchStatusChip status={batchStatus} />
        </Stack>
        
        <Stack direction="row" spacing={1}>
          <Button 
            variant="outlined" 
            onClick={handleStopAll}
            disabled={!hasStarted || hasFinished}
            color="error"
          >
            Stop All
          </Button>
          <IconButton onClick={handleClose} disabled={hasStarted && !hasFinished}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, height: '100%' }}>
        <BatchConsolePanel 
          nodeId={nodeId}
          config={config}
          urlMetadata={urlMetadata}
          onBatchConsoleUpdated={handleConsoleUpdate}
          onBatchCompleted={handleBatchCompleted}
        />
      </DialogContent>
    </Dialog>
  );
};
```

### 3.2 BatchConsolePanel（中核コンポーネント）

**タブ構造**: 
- **Progress Tab**: 4段階分割進捗監視
- **Map Preview Tab**: リアルタイムマップ表示

```tsx
const BatchConsolePanel = ({ nodeId, config, urlMetadata, onBatchConsoleUpdated, onBatchCompleted }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const { errors, addError, clearErrors, errorCount, hasErrors } = useErrorConsole();
  
  // Web Worker管理とタスク状態
  const {
    downloadTasks,
    simplify1Tasks,
    simplify2Tasks,
    vectorTileTasks,
    canStart,
    hasStarted,
    hasFinished,
    handleStart,
    handleCancelTask,
    handleResumeTask,
    handleStopAll,
  } = useBatchWorkerConsole({
    id: nodeId,
    config,
    urlMetadata,
    onError: addError
  });
  
  // 自動開始ロジック
  useEffect(() => {
    if (canStart && !hasStarted) {
      handleStart().catch((error) => {
        onBatchConsoleUpdated(`Failed to start batch processing: ${error.message}`, true);
      });
    }
  }, [canStart, hasStarted, handleStart, onBatchConsoleUpdated]);
  
  // バッチ処理完了通知
  useEffect(() => {
    if (hasFinished && onBatchCompleted) {
      onBatchCompleted();
      enqueueSnackbar('All batch processes completed successfully!', { 
        variant: 'success',
        autoHideDuration: 5000 
      });
    }
  }, [hasFinished, onBatchCompleted]);
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)} variant="fullWidth">
          <Tab icon={<TimelineIcon />} label="Progress" iconPosition="start" />
          <Tab 
            icon={<MapIcon />} 
            label="Map Preview" 
            iconPosition="start"
            disabled={!hasStarted || downloadTasks.length === 0}
          />
        </Tabs>
      </Paper>
      
      {/* Tab Content */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {selectedTab === 0 && (
          <BatchProgressSplitView
            config={config}
            downloadTasks={downloadTasks}
            simplify1Tasks={simplify1Tasks}
            simplify2Tasks={simplify2Tasks}
            vectorTileTasks={vectorTileTasks}
            onCancelDownload={cancelDownloadTask}
            onResumeDownload={resumeDownloadTask}
            onCancelSimplify1={cancelSimplify1Task}
            onResumeSimplify1={resumeSimplify1Task}
            onCancelSimplify2={cancelSimplify2Task}
            onResumeSimplify2={resumeSimplify2Task}
            onCancelVectorTiles={cancelVectorTilesTask}
            onResumeVectorTiles={resumeVectorTilesTask}
            getDownloadTaskTitle={getDownloadTaskTitle}
            getSimplify1TaskTitle={getSimplify1TaskTitle}
            getSimplify2TaskTitle={getSimplify2TaskTitle}
            getVectorTilesTaskTitle={getVectorTilesTaskTitle}
          />
        )}
        
        {selectedTab === 1 && (
          <Box sx={{ height: '100%', p: 2 }}>
            <MapPreview
              nodeId={nodeId}
              downloadTasks={downloadTasks}
              vectorTileTasks={vectorTileTasks}
              hasStarted={hasStarted}
            />
          </Box>
        )}
      </Box>
      
      {/* エラー表示フローティングボタン */}
      {hasErrors && (
        <Fab
          color="error"
          sx={{ position: 'absolute', bottom: 16, right: 16 }}
          onClick={() => setErrorDialogOpen(true)}
        >
          <Badge badgeContent={errorCount}>
            <ErrorOutlineIcon />
          </Badge>
        </Fab>
      )}
      
      <ErrorConsoleDialog 
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        errors={errors}
        onClearErrors={clearErrors}
      />
    </Box>
  );
};
```

### 3.3 BatchProgressSplitView（4段階分割進捗監視）

**レイアウト**: Allotment使用の水平分割レイアウト（4ペイン）
- **Download Pane**: 地理データダウンロード進捗
- **Feature Processing Pane**: フィーチャー処理進捗  
- **Tile Simplification Pane**: タイル簡略化進捗
- **Vector Tiles Pane**: ベクタータイル生成進捗

**インテリジェント表示制御**:
- **LRU方式**: 最大2ペイン同時展開、古いペインは自動折りたたみ
- **自動展開**: 処理進捗100%完了時に次段階を自動展開
- **進捗連動**: アクティブなタスクがあるペインを自動展開

```tsx
const BatchProgressSplitView = ({
  config, downloadTasks, simplify1Tasks, simplify2Tasks, vectorTileTasks,
  onCancelDownload, onResumeDownload, // タスク制御関数群
  getDownloadTaskTitle, getSimplify1TaskTitle, // タスクタイトル取得関数群
}) => {
  const theme = useTheme();
  
  // ペイン状態管理（LRU + 自動展開）
  const [paneStates, setPaneStates] = useState<PaneState[]>([
    { id: 'download', title: `Download Shape Data (${config.concurrentDownloads} concurrent)`, isExpanded: true, ... },
    { id: 'feature', title: 'Feature Processing', isExpanded: false, ... },
    { id: 'simplify', title: 'Tile Simplification', isExpanded: false, ... },
    { id: 'vectortile', title: `Vector Tiles (${config.concurrentProcesses} concurrent)`, isExpanded: false, ... },
  ]);
  
  // 進捗状況計算
  const paneProgress = useMemo(() => ({
    download: calculateProgress(downloadTasks),
    feature: calculateProgress(simplify1Tasks),
    simplify: calculateProgress(simplify2Tasks),
    vectortile: calculateProgress(vectorTileTasks),
  }), [downloadTasks, simplify1Tasks, simplify2Tasks, vectorTileTasks]);
  
  // 進捗完了時の自動展開ロジック
  useEffect(() => {
    if (prevProgress.download < 100 && paneProgress.download === 100) {
      autoExpandPane('feature'); // ダウンロード完了→フィーチャー処理を展開
    }
    if (prevProgress.feature < 100 && paneProgress.feature === 100) {
      autoExpandPane('simplify'); // フィーチャー処理完了→簡略化を展開
    }
    if (prevProgress.simplify < 100 && paneProgress.simplify === 100) {
      autoExpandPane('vectortile'); // 簡略化完了→ベクタータイルを展開
    }
  }, [paneProgress, prevProgress]);
  
  // LRU方式でのペイン管理
  const expandPaneLRU = (currentStates: PaneState[], paneId: string) => {
    const expandedPanes = currentStates.filter(p => p.isExpanded);
    if (expandedPanes.length >= 2) {
      const oldestPane = expandedPanes.reduce((oldest, current) =>
        current.lastAccessTime < oldest.lastAccessTime ? current : oldest
      );
      // 最古のペインを折りたたみ、新しいペインを展開
    }
    // 新しいペインの展開処理...
  };
  
  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <Allotment vertical={false} proportionalLayout={false}>
        <Allotment.Pane minSize={60}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ペインヘッダー */}
            <Box sx={{ p: 1, borderBottom: 1, cursor: 'pointer' }} onClick={() => togglePane('download')}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <IconButton size="small">
                    {paneStates[0]?.isExpanded ? <ChevronLeft /> : <ChevronRight />}
                  </IconButton>
                  <DownloadIcon />
                  <Typography variant="subtitle2">Download Shape Data</Typography>
                </Stack>
                
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip 
                    label={`${completedTasks}/${totalTasks}`}
                    size="small" 
                    color={progress === 100 ? 'success' : 'default'}
                  />
                  <Typography variant="caption">{progress.toFixed(0)}%</Typography>
                </Stack>
              </Stack>
            </Box>
            
            {/* タスクモニター */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              <TaskMonitor
                tasks={downloadTasks}
                handleCancelTask={onCancelDownload}
                handleResumeTask={onResumeDownload}
                getTaskTitle={getDownloadTaskTitle}
              />
            </Box>
          </Box>
        </Allotment.Pane>
        
        {/* 他の3ペイン（Feature Processing, Tile Simplification, Vector Tiles）も同様の構造 */}
      </Allotment>
    </Box>
  );
};
```

### 3.4 TaskMonitor（個別タスク監視）

各ペイン内でタスクの詳細進捗を表示

```tsx
const TaskMonitor = ({ tasks, handleCancelTask, handleResumeTask, getTaskTitle }) => {
  return (
    <Stack spacing={1}>
      {tasks.map((task) => (
        <Card key={task.taskId} variant="outlined">
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ flex: 1 }}>
                {getTaskTitle(task)}
              </Typography>
              
              <Stack direction="row" spacing={1} alignItems="center">
                <TaskStatusIcon stage={task.stage} />
                
                {task.stage === BatchTaskStage.PROCESS && (
                  <IconButton size="small" onClick={() => handleCancelTask(task.taskId)}>
                    <PauseIcon />
                  </IconButton>
                )}
                
                {task.stage === BatchTaskStage.PAUSE && (
                  <IconButton size="small" onClick={() => handleResumeTask(task.taskId)}>
                    <PlayArrowIcon />
                  </IconButton>
                )}
              </Stack>
            </Stack>
            
            {task.stage === BatchTaskStage.PROCESS && task.progress !== undefined && (
              <LinearProgress 
                variant="determinate" 
                value={task.progress} 
                sx={{ mt: 1 }}
              />
            )}
            
            {task.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                <Typography variant="caption">{task.error}</Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
```

### 3.5 バッチ処理完了とダイアログクローズ

```tsx
// バッチ処理完了時の処理
useEffect(() => {
  if (hasFinished && onBatchCompleted) {
    onBatchCompleted();
    // スナックバー通知
    enqueueSnackbar('All batch processes completed successfully!', { 
      variant: 'success',
      autoHideDuration: 5000 
    });
  }
}, [hasFinished, onBatchCompleted]);

// ダイアログクローズ制御
const handleClose = () => {
  if (hasStarted && !hasFinished) {
    // 処理中の場合は確認ダイアログ
    setShowCloseConfirmation(true);
  } else {
    onClose();
  }
};
```

## 4. データフロー・状態管理

### 4.1 Working Copy管理

```typescript
interface ShapeWorkingCopy {
  // Step 1: Basic Information
  name: string;
  description?: string;
  
  // Step 2: Data Source Selection
  dataSourceName: string;
  
  // Step 3: License Agreement
  licenseAgreement: boolean;
  licenseAgreedAt?: string;
  
  // Step 4: Processing Configuration
  processingConfig: {
    concurrentDownloads: number;
    corsProxyBaseURL?: string;
    enableFeatureFiltering: boolean;
    featureFilterMethod: 'bbox_only' | 'polygon_only' | 'hybrid';
    featureAreaThreshold: number;
    concurrentProcesses: number;
    maxZoomLevel: number;
  };
  
  // Step 5: Country & Admin Selection
  checkboxState: boolean[][] | string; // シリアライズ可能
  selectedCountries: string[];
  adminLevels: number[];
  downloadedMatrix?: boolean[][]; // キャッシュ状況
  urlMetadata: Array<{
    url: string;
    countryCode: string;
    adminLevel: number;
    continent: string;
  }>;
}
```

### 4.2 バリデーション

各ステップの進行条件：
- **Step 1**: `name.length > 0`
- **Step 2**: `!!dataSourceName`
- **Step 3**: `licenseAgreement === true`
- **Step 4**: `validateProcessingConfig(processingConfig)`
- **Step 5**: `hasSelectedCountries(checkboxState)`

## 5. 特徴とポイント

**ダイアログ分離設計**:
- メインダイアログ: 設定に特化、軽量
- 監視ダイアログ: 処理監視に特化、全画面

**全画面化対応**:
- 両ダイアログで全画面化・通常サイズ切り替え可能
- 複雑な設定や監視作業に最適な表示領域を提供
- ワンクリックでの表示モード変更

**改善された動線設計**:
- Start Batchボタン常時表示（Step 4-5）
- 全条件満足時に自動有効化
- Step間移動とバッチ開始の独立操作
- バッチダイアログとメインダイアログ間の柔軟な行き来

**インテリジェント表示制御**:
- LRU方式ペイン管理: メモリ効率的な表示制御
- 進捗連動自動展開: ユーザーの注意を適切に誘導

**高度な仮想化**:
- TableVirtuoso: 数千国対応の高速マトリクス表示
- A-Zインデックス: 即座の国検索・ジャンプ

**完全なエラーハンドリング**:
- フローティングエラーボタン: 非侵入的エラー表示
- 詳細エラーダイアログ: デバッグ情報の提供

**Web Worker並列処理**:
- バックグラウンド処理: UIブロックなし
- リアルタイム進捗: タスク別詳細監視
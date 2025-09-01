# Styler Plugin UI Architecture

This document describes the user interface architecture of the Styler Plugin, including React components, user workflows, and integration with HierarchiDB's UI system.

## UI Architecture Overview

The Styler Plugin follows HierarchiDB's component-based architecture with separation between dialog components and view components:

```
Styler UI Architecture
├── Dialog Components (Creation/Editing)
│   ├── StylerDialog (Main wizard)
│   ├── Step Components (6-step workflow)
│   └── StylerCreateDialog (Alternative)
├── View Components (Display)
│   ├── StylerView (Read-only display)
│   ├── StylerPanel (Properties panel)
│   └── StylerPreview (Preview generation)
├── Editor Components (Inline editing)
│   ├── StylerEditor (Main editor)
│   ├── StylerForm (Form fields)
│   └── StylerImport (Import functionality)
└── Utility Components
    ├── StylerIcon (Node icon)
    └── Examples (Usage examples)
```

## Component Architecture

### 1. Dialog Components

#### StylerDialog - Main Creation Wizard
6-step wizard for comprehensive Styler creation:

```typescript
interface StylerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: Partial<StylerEntity>) => void | Promise<void>;
  nodeId: NodeId;
  initialName?: string;
  initialDescription?: string;
}

const STEPS = [
  'Basic Information',    // Step 1: Name and description
  'Upload Data',         // Step 2: File upload and URL import
  'Filter Data',         // Step 3: Apply filters to dataset
  'Select Columns',      // Step 4: Choose key and value columns
  'Color Settings',      // Step 5: Configure colors and styles
  'Preview'             // Step 6: Preview and finalize
];
```

**State Management:**
```typescript
interface DialogState {
  // Stepper state
  activeStep: number;
  isSubmitting: boolean;
  
  // Form data
  name: string;
  description: string;
  tableMetadata: TableMetadata | null;
  filterRules: FilterRule[];
  columnMappings: KeyValueMapping[];
  previewData: PreviewData | null;
}
```

#### Step Components (Step1-Step6)

**Step1BasicInformation**
- Name and description input
- Validation for required fields
- Real-time character counting

```typescript
interface Step1BasicInformationProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  nameError?: string;
  descriptionError?: string;
}
```

**Step2FileUpload**
- File selection (CSV/TSV)
- URL-based import
- File validation and preview
- Progress indication

```typescript
interface Step2FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlImport: (url: string) => Promise<void>;
  isLoading: boolean;
  error?: string;
  acceptedFormats: string[];
}
```

**Step3FilterSettings**
- Dynamic filter rule creation
- Multiple filter operators
- Real-time data preview
- Filter combination logic

```typescript
interface Step3FilterSettingsProps {
  filterRules: FilterRule[];
  availableColumns: string[];
  onFilterRulesChange: (rules: FilterRule[]) => void;
  previewData?: TableData;
}
```

**Step4ColumnSelection**
- Key/value column selection
- Column mapping interface
- Data type validation
- Preview of selected data

```typescript
interface Step4ColumnSelectionProps {
  columns: string[];
  selectedKeyColumn: string;
  selectedValueColumns: string[];
  keyValueMappings: KeyValueMapping[];
  onKeyColumnChange: (column: string) => void;
  onValueColumnsChange: (columns: string[]) => void;
  onKeyValueMappingsChange: (mappings: KeyValueMapping[]) => void;
}
```

**Step5ColorSettings**
- Color scheme configuration
- Gradient settings
- Custom color rules
- Opacity control

```typescript
interface Step5ColorSettingsProps {
  stylerConfig: StylerConfig;
  onStylerConfigChange: (config: StylerConfig) => void;
  previewData?: TableData;
}
```

**Step6Preview**
- Final preview generation
- MapLibre style output
- Data summary display
- Validation results

```typescript
interface Step6PreviewProps {
  stylerConfig: StylerConfig;
  tableData: TableData;
  filterRules: FilterRule[];
  onGeneratePreview: () => Promise<PreviewResult>;
}
```

### 2. View Components

#### StylerView - Read-Only Display
Main view component for displaying Styler information:

```typescript
interface StylerViewProps {
  entity: StylerEntity;
  tableMetadata?: TableMetadataEntity;
  showDetails?: boolean;
  compact?: boolean;
}

// Features:
// - Entity information display
// - Table metadata summary
// - Filter rules visualization
// - Style configuration preview
// - Export functionality
```

#### StylerPanel - Properties Panel
Side panel for displaying Styler properties:

```typescript
interface StylerPanelProps {
  entity: StylerEntity;
  onEdit?: () => void;
  onDelete?: () => void;
  onExport?: (format: ExportFormat) => void;
}

// Features:
// - Collapsible sections
// - Quick edit access
// - Action buttons
// - Statistics display
```

#### StylerPreview - Preview Generation
Component for generating and displaying previews:

```typescript
interface StylerPreviewProps {
  stylerConfig: StylerConfig;
  tableData: TableData;
  width?: number;
  height?: number;
  interactive?: boolean;
}

// Features:
// - MapLibre integration
// - Real-time style updates
// - Legend display
// - Performance optimization
```

### 3. Editor Components

#### StylerEditor - Inline Editor
In-place editing component for Styler properties:

```typescript
interface StylerEditorProps {
  entity: StylerEntity;
  onSave: (updated: Partial<StylerEntity>) => Promise<void>;
  onCancel: () => void;
  mode: 'edit' | 'create';
}

// Features:
// - Working copy management
// - Dirty state tracking
// - Auto-save capabilities
// - Validation feedback
```

#### StylerForm - Form Fields
Reusable form component for Styler data:

```typescript
interface StylerFormProps {
  initialData?: Partial<StylerEntity>;
  onSubmit: (data: StylerEntity) => void;
  onCancel: () => void;
  validation?: ValidationRules;
}

// Features:
// - Form validation
// - Field-level error display
// - Progressive disclosure
// - Accessibility support
```

#### StylerImport - Import Interface
Specialized component for data import:

```typescript
interface StylerImportProps {
  onImportComplete: (result: ImportResult) => void;
  supportedFormats: FileFormat[];
  maxFileSize: number;
}

// Features:
// - Drag & drop interface
// - Import progress tracking
// - Error handling
// - Format conversion
```

## User Workflow Design

### Primary Workflow - Styler Creation

```
1. [Basic Information]
   ├── Enter name (required)
   ├── Enter description (optional)
   └── Validation: unique name check

2. [Upload Data]
   ├── File upload (CSV/TSV)
   ├── URL import option
   ├── Format validation
   └── Parse preview

3. [Filter Data]
   ├── Add filter rules
   ├── Preview filtered data
   ├── Combine multiple filters
   └── Performance warning for large datasets

4. [Select Columns]
   ├── Choose key column
   ├── Select value columns
   ├── Configure mappings
   └── Data type validation

5. [Color Settings]
   ├── Set default colors
   ├── Create value-specific rules
   ├── Configure gradients
   └── Preview color mapping

6. [Preview]
   ├── Generate final preview
   ├── Validate configuration
   ├── Display summary
   └── Create Styler
```

### Secondary Workflows

**Edit Existing Styler:**
```
1. Load existing entity
2. Open relevant step (or full wizard)
3. Make modifications
4. Preview changes
5. Save or commit working copy
```

**Quick Import:**
```
1. Drag & drop file
2. Auto-configure based on content
3. Quick preview
4. One-click creation
```

## State Management

### Component State Architecture

```typescript
interface StylerUIState {
  // Dialog state
  dialogOpen: boolean;
  currentStep: number;
  isLoading: boolean;
  
  // Form state
  formData: Partial<StylerEntity>;
  validationErrors: ValidationErrors;
  isDirty: boolean;
  
  // Data state
  tableMetadata: TableMetadataEntity | null;
  previewData: PreviewData | null;
  generatedStyles: MapLibreStyle | null;
  
  // UI state
  showAdvanced: boolean;
  previewMode: 'table' | 'map' | 'legend';
}
```

### State Management Patterns

**1. Working Copy Pattern:**
```typescript
// Create working copy for editing
const workingCopy = await createWorkingCopy(entity.nodeId);

// Track changes
const [isDirty, setIsDirty] = useState(false);

// Commit or discard
const handleSave = () => commitWorkingCopy(workingCopy.workingCopyId);
const handleCancel = () => discardWorkingCopy(workingCopy.workingCopyId);
```

**2. Progressive Loading:**
```typescript
// Lazy load table data
const [tableData, setTableData] = useState<TableData | null>(null);

useEffect(() => {
  if (entity.tableMetadataId) {
    loadTableData(entity.tableMetadataId).then(setTableData);
  }
}, [entity.tableMetadataId]);
```

**3. Error Boundary:**
```typescript
// Wrap components in error boundaries
<ErrorBoundary fallback={<StylerErrorDisplay />}>
  <StylerDialog {...props} />
</ErrorBoundary>
```

## Integration with HierarchiDB

### Plugin Registration

```typescript
const stylerUIPlugin: UIPlugin = {
  nodeType: 'styler-plugin',
  components: {
    dialog: () => import('./components/StylerDialog'),
    view: () => import('./components/StylerView'),
    panel: () => import('./components/StylerPanel'),
    icon: () => import('./components/StylerIcon'),
  },
  routes: [
    {
      path: '/styler-plugin/:nodeId',
      component: () => import('./routes/StylerRoute'),
    },
  ],
};
```

### Theme Integration

```typescript
// Use HierarchiDB theme tokens
const useStylerTheme = () => {
  const theme = useTheme();
  
  return {
    colors: {
      primary: theme.palette.primary.main,
      secondary: theme.palette.secondary.main,
      success: theme.palette.success.main,
      warning: theme.palette.warning.main,
      error: theme.palette.error.main,
    },
    spacing: theme.spacing,
    typography: theme.typography,
  };
};
```

### Accessibility Features

**Keyboard Navigation:**
- Tab order optimization
- Arrow key navigation in steppers
- Enter/Space activation
- Escape key cancellation

**Screen Reader Support:**
- ARIA labels and descriptions
- Live regions for dynamic content
- Semantic HTML structure
- Focus management

**Visual Accessibility:**
- High contrast mode support
- Color-blind friendly palettes
- Scalable text and UI elements
- Focus indicators

## Performance Optimizations

### Component Optimization

```typescript
// Memoize expensive operations
const memoizedPreview = useMemo(() => 
  generatePreview(tableData, styleConfig), 
  [tableData, styleConfig]
);

// Debounce user input
const debouncedSearch = useDebounce(searchTerm, 300);

// Virtual scrolling for large datasets
const virtualizedTable = useVirtualization({
  data: tableRows,
  itemHeight: 40,
  containerHeight: 400,
});
```

### Bundle Optimization

```typescript
// Code splitting for large components
const StylerDialog = lazy(() => import('./StylerDialog'));
const StylerPreview = lazy(() => import('./StylerPreview'));

// Preload critical components
const preloadStylerDialog = () => import('./StylerDialog');
```

### Data Loading

```typescript
// Progressive data loading
const useProgressiveTableData = (tableId: string) => {
  const [data, setData] = useState<TableData>({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Load headers first
    loadTableHeaders(tableId).then(headers => {
      setData(prev => ({ ...prev, headers }));
      
      // Then load data in chunks
      return loadTableDataInChunks(tableId, 1000);
    }).then(rows => {
      setData(prev => ({ ...prev, rows }));
      setIsLoading(false);
    });
  }, [tableId]);
  
  return { data, isLoading };
};
```

---

**Implementation Status**: UI components partially implemented, dialog workflow designed  
**Next Priority**: Complete step components and state management  
**Performance Target**: Support 50MB CSV files with smooth UI interactions
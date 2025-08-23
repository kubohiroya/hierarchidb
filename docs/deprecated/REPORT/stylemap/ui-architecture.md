# StyleMap Plugin UI Architecture

This document describes the user interface architecture of the StyleMap Plugin, including React components, user workflows, and integration with HierarchiDB's UI system.

## UI Architecture Overview

The StyleMap Plugin follows HierarchiDB's component-based architecture with separation between dialog components and view components:

```
StyleMap UI Architecture
├── Dialog Components (Creation/Editing)
│   ├── StyleMapDialog (Main wizard)
│   ├── Step Components (6-step workflow)
│   └── StyleMapCreateDialog (Alternative)
├── View Components (Display)
│   ├── StyleMapView (Read-only display)
│   ├── StyleMapPanel (Properties panel)
│   └── StyleMapPreview (Preview generation)
├── Editor Components (Inline editing)
│   ├── StyleMapEditor (Main editor)
│   ├── StyleMapForm (Form fields)
│   └── StyleMapImport (Import functionality)
└── Utility Components
    ├── StyleMapIcon (Node icon)
    └── Examples (Usage examples)
```

## Component Architecture

### 1. Dialog Components

#### StyleMapDialog - Main Creation Wizard
6-step wizard for comprehensive StyleMap creation:

```typescript
interface StyleMapDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: Partial<StyleMapEntity>) => void | Promise<void>;
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
  styleMapConfig: StyleMapConfig;
  onStyleMapConfigChange: (config: StyleMapConfig) => void;
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
  styleMapConfig: StyleMapConfig;
  tableData: TableData;
  filterRules: FilterRule[];
  onGeneratePreview: () => Promise<PreviewResult>;
}
```

### 2. View Components

#### StyleMapView - Read-Only Display
Main view component for displaying StyleMap information:

```typescript
interface StyleMapViewProps {
  entity: StyleMapEntity;
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

#### StyleMapPanel - Properties Panel
Side panel for displaying StyleMap properties:

```typescript
interface StyleMapPanelProps {
  entity: StyleMapEntity;
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

#### StyleMapPreview - Preview Generation
Component for generating and displaying previews:

```typescript
interface StyleMapPreviewProps {
  styleMapConfig: StyleMapConfig;
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

#### StyleMapEditor - Inline Editor
In-place editing component for StyleMap properties:

```typescript
interface StyleMapEditorProps {
  entity: StyleMapEntity;
  onSave: (updated: Partial<StyleMapEntity>) => Promise<void>;
  onCancel: () => void;
  mode: 'edit' | 'create';
}

// Features:
// - Working copy management
// - Dirty state tracking
// - Auto-save capabilities
// - Validation feedback
```

#### StyleMapForm - Form Fields
Reusable form component for StyleMap data:

```typescript
interface StyleMapFormProps {
  initialData?: Partial<StyleMapEntity>;
  onSubmit: (data: StyleMapEntity) => void;
  onCancel: () => void;
  validation?: ValidationRules;
}

// Features:
// - Form validation
// - Field-level error display
// - Progressive disclosure
// - Accessibility support
```

#### StyleMapImport - Import Interface
Specialized component for data import:

```typescript
interface StyleMapImportProps {
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

### Primary Workflow - StyleMap Creation

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
   └── Create StyleMap
```

### Secondary Workflows

**Edit Existing StyleMap:**
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
interface StyleMapUIState {
  // Dialog state
  dialogOpen: boolean;
  currentStep: number;
  isLoading: boolean;
  
  // Form state
  formData: Partial<StyleMapEntity>;
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
<ErrorBoundary fallback={<StyleMapErrorDisplay />}>
  <StyleMapDialog {...props} />
</ErrorBoundary>
```

## Integration with HierarchiDB

### Plugin Registration

```typescript
const styleMapUIPlugin: UIPlugin = {
  nodeType: 'stylemap',
  components: {
    dialog: () => import('./components/StyleMapDialog'),
    view: () => import('./components/StyleMapView'),
    panel: () => import('./components/StyleMapPanel'),
    icon: () => import('./components/StyleMapIcon'),
  },
  routes: [
    {
      path: '/stylemap/:nodeId',
      component: () => import('./routes/StyleMapRoute'),
    },
  ],
};
```

### Theme Integration

```typescript
// Use HierarchiDB theme tokens
const useStyleMapTheme = () => {
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
const StyleMapDialog = lazy(() => import('./StyleMapDialog'));
const StyleMapPreview = lazy(() => import('./StyleMapPreview'));

// Preload critical components
const preloadStyleMapDialog = () => import('./StyleMapDialog');
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
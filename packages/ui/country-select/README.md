# @hierarchidb/ui-country-select

Virtualized country matrix selector for plugin dialogs (shape/location/route/etc.).

## Directory layout
```
CountryMatrixSelector.tsx  Core matrix component (react-virtuoso)
CountryMatrixStep.tsx      Stepper-friendly wrapper with validation UI
configs.ts                 Predefined column sets (admin levels, transport hubs, routes, airports/ports)
samples.ts                 Sample country data for demos/tests
batch-types.ts                   Matrix types
index.ts                   Public exports
```

## Key features
- Virtualized matrix of countries with checkbox columns; search/filter; bulk select/clear.
- Predefined column sets for admin levels, transport hubs, route types, airports/ports; custom configs supported.
- Step wrapper (`CountryMatrixStep`) with title/description/validation helpers.

## Usage (minimal)
```tsx
<CountryMatrixSelector
  countries={countries}
  matrixConfig={ADMIN_LEVELS_COLUMN_SET}
  selections={selections}
  onSelectionsChange={setSelections}
  height={600}
/>;
```

## Consumers
- Used in plugin step dialogs where country + attribute selection is required.

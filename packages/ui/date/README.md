@hierarchidb/ui-date

Thin, stable wrapper around MUI X Date Pickers. Centralizes adapter/locale wiring and fixes the public value type to `Date | null` so plugin code stays consistent regardless of upstream changes.

Exports
- `LocalizationProvider`: pass `AdapterDateFns` and optional `adapterLocale`.
- `AdapterDateFns`: re-export for convenience.
- `DatePicker` | `TimePicker` | `DateTimePicker`: stable `onChange(value: Date | null)` and `value: Date | null`.

Policy
- Direct use of `@mui/x-date-pickers` is blocked by check-deps. Use `@hierarchidb/ui-date` instead.

Notes
- Currently uses DateFns adapter internally. Switching adapters later will not affect callers.


// Minimal wrapper for MUI X Date Pickers to stabilize imports across the monorepo
// and avoid direct dependencies from feature/ui packages.

export { LocalizationProvider } from '@mui/x-date-pickers';
export { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
export { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

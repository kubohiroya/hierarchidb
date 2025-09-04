// Minimal shim to satisfy DTS build when @mui/material/Grid2 types
// are not available in the build graph. This package treats Grid2 as any.
declare module '@mui/material/Grid2' {
  const Grid2: any;
  export default Grid2;
}


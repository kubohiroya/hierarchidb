export const getBackgroundColorForTheme = (theme) => {
  return theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50];
};
export const getTextColorForTheme = (theme) => {
  return theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.grey[900];
};
//# sourceMappingURL=themeUtils.js.map

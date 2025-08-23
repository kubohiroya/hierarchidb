// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  target: "es2022",
  entry: ["src/openstreetmap-type.ts"],
  format: ["esm"],
  dts: {
    resolve: true,
    compilerOptions: {
      composite: false,
      incremental: false
    }
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@mui/material",
    "@mui/icons-material",
    "@emotion/react",
    "@emotion/styled",
    "@tanstack/react-table",
    "@hierarchidb/core",
    "@hierarchidb/api",
    "@hierarchidb/registry",
    "rxjs"
  ]
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2hpcm95YS9XZWJzdG9ybVByb2plY3RzL2hpZXJhcmNoaWRiL3BhY2thZ2VzL3VpL3RyZWVjb25zb2xlL2Jhc2UvdHN1cC5jb25maWcudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL2hpcm95YS9XZWJzdG9ybVByb2plY3RzL2hpZXJhcmNoaWRiL3BhY2thZ2VzL3VpL3RyZWVjb25zb2xlL2Jhc2VcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL2hpcm95YS9XZWJzdG9ybVByb2plY3RzL2hpZXJhcmNoaWRiL3BhY2thZ2VzL3VpL3RyZWVjb25zb2xlL2Jhc2UvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgZW50cnk6IFsnc3JjL2luZGV4LnRzJ10sXG4gIGZvcm1hdDogWydlc20nXSxcbiAgZHRzOiB7XG4gICAgcmVzb2x2ZTogdHJ1ZSxcbiAgICBjb21waWxlck9wdGlvbnM6IHtcbiAgICAgIGNvbXBvc2l0ZTogZmFsc2UsXG4gICAgICBpbmNyZW1lbnRhbDogZmFsc2UsXG4gICAgfSxcbiAgfSxcbiAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgc291cmNlbWFwOiB0cnVlLFxuICBjbGVhbjogdHJ1ZSxcbiAgZXh0ZXJuYWw6IFtcbiAgICAncmVhY3QnLFxuICAgICdyZWFjdC1kb20nLFxuICAgICdAbXVpL21hdGVyaWFsJyxcbiAgICAnQG11aS9pY29ucy1tYXRlcmlhbCcsXG4gICAgJ0BlbW90aW9uL3JlYWN0JyxcbiAgICAnQGVtb3Rpb24vc3R5bGVkJyxcbiAgICAnQHRhbnN0YWNrL3JlYWN0LXRhYmxlJyxcbiAgICAnQGhpZXJhcmNoaWRiL2NvcmUnLFxuICAgICdAaGllcmFyY2hpZGIvYXBpJyxcbiAgICAnQGhpZXJhcmNoaWRiL3JlZ2lzdHJ5JyxcbiAgICAncnhqcycsXG4gIF0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVcsU0FBUyxvQkFBb0I7QUFFaFksSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLEVBQ1IsT0FBTyxDQUFDLGNBQWM7QUFBQSxFQUN0QixRQUFRLENBQUMsS0FBSztBQUFBLEVBQ2QsS0FBSztBQUFBLElBQ0gsU0FBUztBQUFBLElBQ1QsaUJBQWlCO0FBQUEsTUFDZixXQUFXO0FBQUEsTUFDWCxhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFBQSxFQUNYLE9BQU87QUFBQSxFQUNQLFVBQVU7QUFBQSxJQUNSO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

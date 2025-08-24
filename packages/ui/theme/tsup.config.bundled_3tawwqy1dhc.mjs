// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  target: "es2022",
  entry: ["src/openstreetmap-type.ts"],
  format: ["esm"],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false
    }
  },
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "@mui/material",
    "@mui/icons-material",
    "@emotion/react",
    "@emotion/styled",
    "dexie",
    "comlink",
    "rxjs",
    /^@hierarchidb\//
  ].filter(Boolean)
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2hpcm95YS9XZWJzdG9ybVByb2plY3RzL2hpZXJhcmNoaWRiL3BhY2thZ2VzL3VpL3RoZW1lL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9oaXJveWEvV2Vic3Rvcm1Qcm9qZWN0cy9oaWVyYXJjaGlkYi9wYWNrYWdlcy91aS90aGVtZVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvaGlyb3lhL1dlYnN0b3JtUHJvamVjdHMvaGllcmFyY2hpZGIvcGFja2FnZXMvdWkvdGhlbWUvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgZW50cnk6IFsnc3JjL2luZGV4LnRzJ10sXG4gIGZvcm1hdDogWydlc20nXSxcbiAgZHRzOiB7XG4gICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICBjb21wb3NpdGU6IGZhbHNlLFxuICAgICAgaW5jcmVtZW50YWw6IGZhbHNlLFxuICAgIH0sXG4gIH0sXG4gIGNsZWFuOiB0cnVlLFxuICBzb3VyY2VtYXA6IHRydWUsXG4gIHRyZWVzaGFrZTogdHJ1ZSxcbiAgb3V0RGlyOiAnZGlzdCcsXG4gIGV4dGVybmFsOiBbXG4gICAgJ3JlYWN0JyxcbiAgICAncmVhY3QtZG9tJyxcbiAgICAnQG11aS9tYXRlcmlhbCcsXG4gICAgJ0BtdWkvaWNvbnMtbWF0ZXJpYWwnLFxuICAgICdAZW1vdGlvbi9yZWFjdCcsXG4gICAgJ0BlbW90aW9uL3N0eWxlZCcsXG4gICAgJ2RleGllJyxcbiAgICAnY29tbGluaycsXG4gICAgJ3J4anMnLFxuICAgIC9eQGhpZXJhcmNoaWRiXFwvLyxcbiAgXS5maWx0ZXIoQm9vbGVhbiksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFFL1YsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLEVBQ1IsT0FBTyxDQUFDLGNBQWM7QUFBQSxFQUN0QixRQUFRLENBQUMsS0FBSztBQUFBLEVBQ2QsS0FBSztBQUFBLElBQ0gsaUJBQWlCO0FBQUEsTUFDZixXQUFXO0FBQUEsTUFDWCxhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxFQUNQLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFBQSxJQUNSO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRixFQUFFLE9BQU8sT0FBTztBQUNsQixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

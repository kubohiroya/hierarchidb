/// <reference path="./types/generated/plugin-modules.d.ts" />
/// <reference path="./types/generated/runtime-worker.d.ts" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Type declarations for Vite worker imports
declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module '*?worker&inline' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

// Worker registration stub for timeline-plugin
// This allows app/src/worker.ts to lazy-load '@hierarchidb/timeline-plugin/worker'
export function register(): void {}
export { lifecycle } from './lifecycle';
export default { register };
export {};

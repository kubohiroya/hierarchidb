// Worker registration stub for timeline-plugin
// This allows app/src/worker.ts to lazy-load '@hierarchidb/plugins-timeline-plugin/worker'
export function register(): void {}
export { lifecycle } from './lifecycle.js';
export default { register };

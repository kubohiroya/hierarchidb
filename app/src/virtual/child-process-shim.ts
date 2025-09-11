// Browser shim for Node's child_process used by some transitive dependencies.
// Ensures Vite/Rollup can resolve named imports like { spawn }.
export function spawn(): never {
  throw new Error('child_process.spawn is not available in the browser');
}

export default { spawn };


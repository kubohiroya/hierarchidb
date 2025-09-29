export { resolverDB } from './ResolverDatabase.js';

export async function loadResolverDatabaseModule() {
  return import(/* @vite-ignore */ './ResolverDatabase.js');
}

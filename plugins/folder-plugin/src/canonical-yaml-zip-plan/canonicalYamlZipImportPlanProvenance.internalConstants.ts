import type { CanonicalYamlZipImportPlan } from './canonicalYamlZipPlanTypes.js';

const issuedPlans = new WeakSet<object>();

function issue(plan: CanonicalYamlZipImportPlan): CanonicalYamlZipImportPlan {
  issuedPlans.add(plan);
  return plan;
}

function consume(plan: unknown): plan is CanonicalYamlZipImportPlan {
  if (typeof plan !== 'object' || plan === null || !Object.isFrozen(plan)) return false;
  if (!issuedPlans.has(plan)) return false;
  issuedPlans.delete(plan);
  return true;
}

export const canonicalYamlZipImportPlanProvenance = Object.freeze({ consume, issue });

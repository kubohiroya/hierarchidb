import { commandMetrics } from '~/services/utils/metricsUtils';

// Development helper: dump metrics snapshot as JSON and reset
if (require.main === module) {
  const snap = commandMetrics.snapshot();
  console.log(JSON.stringify(snap, null, 2));
  commandMetrics.reset();
}

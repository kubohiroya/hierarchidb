#!/usr/bin/env node
// Minimal smoke test to ensure searoute-js is installed and usable.
// This does not exercise the plugin build; it validates the runtime dependency.

async function main() {
  const searoute = await import('searoute-js');
  const api = typeof searoute.getSeaRoute === 'function' ? searoute.getSeaRoute
            : typeof searoute.default === 'function' ? searoute.default
            : typeof searoute === 'function' ? searoute
            : null;
  if (!api) throw new Error('searoute-js API not found');

  const from = [-122.3321, 47.6062]; // Seattle
  const to = [139.6917, 35.6895];    // Tokyo
  const result = await api(from, to, { units: 'nauticalmiles', avoidCanals: false });
  const coords = result?.geometry?.coordinates || result?.coordinates || [];
  const dist = result?.properties?.distance ?? 'unknown';
  console.log(JSON.stringify({ ok: true, points: coords.length, distance: dist, sample: coords.slice(0, 3) }));
}

main().catch((e) => {
  console.error('Smoke test failed:', e?.message || e);
  process.exit(1);
});


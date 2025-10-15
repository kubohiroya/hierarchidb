#!/usr/bin/env node
async function main() {
  const searoute = await import('searoute-js');
  const api = typeof searoute.getSeaRoute === 'function' ? searoute.getSeaRoute
            : typeof searoute.default === 'function' ? searoute.default
            : typeof searoute === 'function' ? searoute
            : null;
  if (!api) throw new Error('searoute-js API not found');
  const from = [-122.3321, 47.6062]; // Seattle
  const to = [139.6917, 35.6895];    // Tokyo
  // johnx25bd/searoute-js expects third arg as units string ('nm'|'miles'|'kilometers').
  const result = await api(from, to, 'nm');
  const coords = result?.geometry?.coordinates || result?.coordinates || [];
  const dist = result?.properties?.distance ?? 'unknown';
  console.log(JSON.stringify({ ok: true, points: coords.length, distance: dist, sample: coords.slice(0, 3) }));
}
main().catch((e) => { console.error('Smoke test failed:', e?.message || e); process.exit(1); });

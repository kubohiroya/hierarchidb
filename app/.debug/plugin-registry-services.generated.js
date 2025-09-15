function _msg(e){ try { return (e && e.message) || String(e); } catch(_) { return String(e); } }
export const pluginServices = Object.freeze({
  'base': () => Promise.resolve({ default: {} }),
  'basemap': () => import('@hierarchidb/basemap-plugin/database').catch(e => { console.warn('[plugin-registry-services] Fallback to root for basemap:', _msg(e)); return import('@hierarchidb/basemap-plugin').catch(_e2 => ({ default: {} })); }),
  'folder': () => import('@hierarchidb/folder-plugin/shared').catch(e => { console.warn('[plugin-registry-services] Fallback to root for folder:', _msg(e)); return import('@hierarchidb/folder-plugin').catch(_e2 => ({ default: {} })); }),
  'linker': () => import('@hierarchidb/linker-plugin/services').catch(e => { console.warn('[plugin-registry-services] Fallback to root for linker:', _msg(e)); return import('@hierarchidb/linker-plugin').catch(_e2 => ({ default: {} })); }),
  'location': () => import('@hierarchidb/location-plugin/services').catch(e => { console.warn('[plugin-registry-services] Fallback to root for location:', _msg(e)); return import('@hierarchidb/location-plugin').catch(_e2 => ({ default: {} })); }),
  'resolver': () => import('@hierarchidb/resolver-plugin/database').catch(e => { console.warn('[plugin-registry-services] Fallback to root for resolver:', _msg(e)); return import('@hierarchidb/resolver-plugin').catch(_e2 => ({ default: {} })); }),
  'route': () => import('@hierarchidb/route-plugin/database').catch(e => { console.warn('[plugin-registry-services] Fallback to root for route:', _msg(e)); return import('@hierarchidb/route-plugin').catch(_e2 => ({ default: {} })); }),
  'shape': () => import('@hierarchidb/shape-plugin/services').catch(e => { console.warn('[plugin-registry-services] Fallback to root for shape:', _msg(e)); return import('@hierarchidb/shape-plugin').catch(_e2 => ({ default: {} })); }),
  'spreadsheet': () => import('@hierarchidb/spreadsheet-plugin/database').catch(e => { console.warn('[plugin-registry-services] Fallback to root for spreadsheet:', _msg(e)); return import('@hierarchidb/spreadsheet-plugin').catch(_e2 => ({ default: {} })); }),
  'styler': () => import('@hierarchidb/styler-plugin/services').catch(e => { console.warn('[plugin-registry-services] Fallback to root for styler:', _msg(e)); return import('@hierarchidb/styler-plugin').catch(_e2 => ({ default: {} })); }),
  'timeline': () => import('@hierarchidb/timeline-plugin/services').catch(e => { console.warn('[plugin-registry-services] Fallback to root for timeline:', _msg(e)); return import('@hierarchidb/timeline-plugin').catch(_e2 => ({ default: {} })); }),
});

// Cache the public catalog metadata by data revision and selection, shared
// across page URLs and per-request clock values. Catalog payloads stay in D1.
export async function cachedCatalogSelection(parts, read, cache = globalThis.caches?.default) {
  if (!cache) return read();
  const key = new URL('https://labormin.com/__catalog_cache/v1');
  key.searchParams.set('selection', JSON.stringify(parts));

  try {
    const response = await cache.match(key.href);
    if (response) return await response.json();
  } catch {
    // A cache error must not prevent reading the source.
  }

  const rows = await read();
  try {
    await cache.put(key.href, Response.json(rows, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    }));
  } catch {
    // Keep serving the successful database read.
  }
  return rows;
}

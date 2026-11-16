import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedCatalogSelection } from '../../src/lib/catalog-cache.mjs';

function memoryCache() {
  const responses = new Map();
  return {
    async match(key) { return responses.get(key)?.clone(); },
    async put(key, response) { responses.set(key, response.clone()); },
  };
}

test('catalog metadata reuses a read across requests but separates revisions and filters', async () => {
  const cache = memoryCache();
  let scans = 0;
  const read = async () => [{ slug: 'example', metadata: String(++scans) }];
  const select = (...parts) => cachedCatalogSelection(parts, read, cache);

  const first = await select('programs', 'rev-1', null, false);
  assert.deepEqual(await select('programs', 'rev-1', null, false), first);
  assert.equal(scans, 1);
  await select('programs', 'rev-2', null, false);
  await select('programs', 'rev-2', 'center', true);
  assert.equal(scans, 3);
});

test('cache outages leave the database available and database errors are not cached', async () => {
  const unavailable = {
    async match() { throw new Error('cache down'); },
    async put() { throw new Error('cache down'); },
  };
  assert.deepEqual(await cachedCatalogSelection(['jobs'], async () => [1], unavailable), [1]);

  const cache = memoryCache();
  await assert.rejects(cachedCatalogSelection(['jobs'], async () => { throw new Error('D1 down'); }, cache), /D1 down/);
  assert.deepEqual(await cachedCatalogSelection(['jobs'], async () => [2], cache), [2]);
});

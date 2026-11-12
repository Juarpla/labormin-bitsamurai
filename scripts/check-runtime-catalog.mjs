import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { decodeHTML } from 'entities';
import { isPublicClosure } from '../src/lib/job-archive.mjs';
import { isExpired, jobExpiration, jobPosting } from '../src/lib/job-policy.mjs';

const base = process.env.VERIFY_BASE ?? 'http://localhost:4321';
async function get(path, expected = 200) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, expected, path);
  return response.text();
}
const sitemap = await get('/sitemap-catalog.xml');
const urls = new Set([...sitemap.matchAll(/<loc>https:\/\/labormin\.com([^<]+)<\/loc>/g)].map(([, path]) => path));
const guides = [
  'formacion-minera-gratuita-economica-peru', 'verificar-oferta-remota-visa-salario',
  ...readdirSync('src/content/guides').filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)),
];
for (const slug of guides) {
  const path = `/guias/${slug}/`;
  assert.ok(urls.has(path), `Guía fuera del sitemap: ${slug}`);
  const html = await get(path);
  assert.match(html, new RegExp(`href="https://labormin\\.com${path.replace(/\/$/, '/?')}"`));
  const body = html.match(/<div[^>]*data-editorial-body[^>]*>([\s\S]*?)<footer\b/)?.[1];
  assert.ok(body, `Falta el cuerpo editorial: ${slug}`);
  const words = decodeHTML(body.split(/<h3[^>]*>Fuentes consultadas<\/h3>/i)[0]
    .replace(/<(script|style|svg|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .match(/\p{L}+(?:[-’']\p{L}+)*/gu)?.length ?? 0;
  assert.ok(words > 700, `${slug}: solo ${words} palabras editoriales`);
}

const feed = JSON.parse(readFileSync('src/data/jobs.json', 'utf8')).jobs;
const exclude = JSON.parse(readFileSync('src/data/overrides.json', 'utf8')).exclude ?? {};
const active = feed.filter(job => !exclude[job.id] && !isExpired(job));
const activeSlugs = new Set(feed.map(job => job.slug));
const archive = JSON.parse(readFileSync('src/data/jobs-archive.json', 'utf8'))
  .filter(entry => !activeSlugs.has(entry.slug) && !exclude[entry.snapshot?.id]);
for (const entry of archive) assert.equal(urls.has(`/jobs/${entry.slug}/`), isPublicClosure(entry), entry.slug);
for (const job of active) assert.ok(urls.has(`/jobs/${job.slug}/`), job.slug);

for (const job of new Set([active[0], active.find(job => job.internship), active.find(job => jobPosting(job))].filter(Boolean))) {
  const html = await get(`/jobs/${job.slug}/`);
  assert.match(html, /data-application-guide/);
  assert.doesNotMatch(html, /adsbygoogle\.js|data-ad-slot=/);
  const schema = html.match(/<script type="application\/ld\+json">(\{[^<]+\})<\/script>/)?.[1];
  if (jobPosting(job)) assert.equal(JSON.parse(schema).validThrough, jobExpiration(job)?.date);
}
for (const entry of [archive.find(isPublicClosure), archive.find(entry => !isPublicClosure(entry))].filter(Boolean)) {
  const html = await get(`/jobs/${entry.slug}/`);
  assert.match(html, /data-archived-job/);
  assert.doesNotMatch(html, /adsbygoogle\.js|data-ad-slot=|"@type":"JobPosting"|>\s*Postular(?:\s|<)/);
  if (isPublicClosure(entry)) assert.match(html, /Convocatoria finalizada/);
  else assert.match(html, /content="noindex, follow"/);
}

const adsEnabled = /adsbygoogle\.js/.test(await get('/'));
for (const route of ['/jobs/', '/practicas/', '/formacion/', '/eventos/', '/guias/']) {
  const html = await get(route);
  assert.match(html, /<h1\b/);
  if (!adsEnabled) assert.doesNotMatch(html, /adsbygoogle\.js|data-ad-slot=/);
}
const first = await get('/formacion/');
const second = await get('/formacion/?pagina=2');
const records = html => [...html.matchAll(/<article id="([^"]+)"[^>]*data-training-row/g)].map(([, id]) => id);
assert.equal(records(first).length, 12);
assert.equal(records(second).length, 12);
assert.ok(records(second).every(id => !records(first).includes(id)));
assert.match(await get('/formacion/?q=capacita'), /id="capacita-t"/);
assert.match(await get('/jobs/?q=zzzz-no-results'), /id="jobs-empty" class="mt-10"/);
await get('/jobs/catalog-test-not-found/', 404);
await get('/guias/catalog-test-not-found/', 404);
console.log(`Catálogo HTTP: ${guides.length} guías, ${active.length} empleos vigentes, archivo, paginación, anuncios y 404.`);

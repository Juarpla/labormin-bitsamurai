#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decodeHTML, decodeHTMLAttribute } from 'entities';

const root = path.resolve('dist/client');
const htmlFor = file => fs.readFileSync(path.join(root, file), 'utf8');
const site = 'https://labormin.com';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : entry.name.endsWith('.html') ? [file] : [];
});
const pages = new Map();
for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  // Skip scripts and comments so their strings cannot count as tags or links.
  const markup = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const tags = new Set(), ids = new Set(), links = [], metadata = new Map();
  for (const [, tag, attributes] of markup.matchAll(/<([a-z][\w:-]*)((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    const attrs = new Map();
    for (const [, name, quoted, single, bare] of attributes.matchAll(/([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>]+)))?/g)) {
      attrs.set(name.toLowerCase(), decodeHTMLAttribute(quoted ?? single ?? bare ?? ''));
    }
    const element = tag.toLowerCase();
    tags.add(element);
    if (attrs.has('id')) ids.add(attrs.get('id'));
    if (element === 'a' && attrs.has('href')) links.push(attrs.get('href'));
    if (element === 'a' && attrs.has('name')) ids.add(attrs.get('name'));
    if (element === 'meta' && attrs.has('name')) metadata.set(attrs.get('name'), attrs.get('content'));
  }
  const title = decodeHTML(markup.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  pages.set(path.relative(root, file), { tags, ids, links, metadata, title });
}

function pageFile(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\//, '');
  return relative.endsWith('.html') ? relative : path.join(relative, 'index.html');
}

const sitemapIndex = fs.readFileSync(path.join(root, 'sitemap-index.xml'), 'utf8');
const locations = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(decodeHTML(match[1])));
const sitemapFiles = locations(sitemapIndex);
assert.ok(sitemapFiles.length, 'Empty sitemap index');
const sitemapRoutes = new Set(sitemapFiles.flatMap(url => {
  assert.equal(url.origin, site, 'Sitemap must use the production domain');
  return locations(fs.readFileSync(path.join(root, url.pathname), 'utf8')).map(location => {
    assert.equal(location.origin, site, 'Sitemap entry must use the production domain');
    return pageFile(location.pathname);
  });
}));

// Dynamic routes are verified over HTTP by check-runtime-catalog.mjs. Still
// validate static links against known route IDs, including archived slugs.
const listRoutes = new Set(['/formacion', '/jobs', '/practicas', '/eventos', '/guias']);
const guideSlugs = new Set([
  'formacion-minera-gratuita-economica-peru', 'verificar-oferta-remota-visa-salario',
  ...fs.readdirSync('src/content/guides').filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)),
]);
const excluded = JSON.parse(fs.readFileSync('src/data/overrides.json')).exclude ?? {};
const jobSlugs = new Set([
  ...JSON.parse(fs.readFileSync('src/data/jobs.json')).jobs.filter(job => !excluded[job.id]),
  ...JSON.parse(fs.readFileSync('src/data/jobs-archive.json')).filter(entry => !excluded[entry.snapshot?.id]),
].map(item => item.slug));
function knownDynamic(pathname) {
  const route = pathname.replace(/\/$/, '');
  const [ , section, slug, ...rest] = route.split('/');
  return listRoutes.has(route) || !rest.length && (
    section === 'jobs' && jobSlugs.has(slug) || section === 'guias' && guideSlugs.has(slug)
  );
}

let checked = 0, fragmentsChecked = 0;
const problems = [];
for (const [file, page] of pages) {
  const base = new URL(file.replace(/(^|\/)index\.html$/, '$1'), site + '/');
  for (const href of page.links) {
    const url = URL.parse(href, base);
    if (href === '#' || !url) {
      problems.push(`${file}: enlace inválido ${href}`);
      continue;
    }
    if (url.origin !== site) continue;
    checked++;
    const target = pages.get(pageFile(url.pathname));
    if (!target && !knownDynamic(url.pathname) && !fs.statSync(path.join(root, decodeURIComponent(url.pathname)), { throwIfNoEntry: false })?.isFile()) {
      problems.push(`${file}: falta la ruta ${href}`);
    }
    if (target && url.hash) {
      fragmentsChecked++;
      const id = decodeURIComponent(url.hash.slice(1));
      if (!target.ids.has(id)) problems.push(`${file}: falta el ancla ${href}`);
    }
  }
}
for (const file of sitemapRoutes) {
  const page = pages.get(file);
  if (!page && knownDynamic('/' + file.replace(/index\.html$/, ''))) continue;
  if (!page || !page.title || !page.metadata.get('description')?.trim() || /\bnoindex\b/i.test(page.metadata.get('robots') ?? '')) {
    problems.push(`${file}: página del sitemap ausente, sin título o descripción, o marcada noindex`);
    continue;
  }
  for (const tag of ['h1', 'header', 'main', 'nav', 'footer']) {
    if (!page.tags.has(tag)) problems.push(`${file}: falta <${tag}>`);
  }
}
if (problems.length) {
  console.error(problems.slice(0, 20).join('\n'));
  assert.fail(`El sitio compilado contiene ${problems.length} problemas de navegación o SEO`);
}
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const footer = home.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? '';
for (const route of ['/about', '/contact', '/privacy', '/terms']) {
  assert.ok(sitemapRoutes.has(pageFile(route)), `Missing legal or trust page: ${route}`);
  assert.match(footer, new RegExp(`href="${route}/?"`), `Missing footer link: ${route}`);
}
assert.ok(sitemapRoutes.has(pageFile('/archivo/')));
assert.match(footer, /href="\/archivo\/"/);
for (const route of ['/404.html', '/comprobar-consentimiento']) {
  const file = pageFile(route);
  assert.equal(sitemapRoutes.has(file), false, route);
  assert.match(pages.get(file)?.metadata.get('robots') ?? '', /\bnoindex\b/i, route);
}
console.log({internalLinksChecked:checked,fragmentsChecked,missing:0,indexablePages:sitemapRoutes.size,knownJobDetails:jobSlugs.size,knownGuideDetails:guideSlugs.size});

const loaderTags = [...home.matchAll(/src="[^"]*adsbygoogle\.js[^\"]*"/g)];
assert.ok(loaderTags.length <= 1, 'Duplicate AdSense script');
const publisher = pages.get('index.html').metadata.get('google-adsense-account');
assert.match(publisher ?? '', /^ca-pub-\d{16}$/, 'Missing or invalid AdSense verification meta');
const adsTxt = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
const sellers = adsTxt.split(/\r?\n/).map(line => line.split('#')[0].split(',').map(field => field.trim()).join(','));
assert.ok(sellers.includes(`google.com,${publisher.slice(3)},DIRECT,f08c47fec0942fa0`), 'Publisher mismatch in ads.txt');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
assert.ok(robots.split(/\r?\n/).some(line => line.trim() === `Sitemap: ${site}/sitemap-index.xml`), 'Missing sitemap in robots.txt');
assert.ok(robots.includes(`Sitemap: ${site}/sitemap-catalog.xml`), 'Missing dynamic catalog sitemap');
const blockedGroups = robots.split(/\r?\n\s*\r?\n/).filter(group =>
  /^User-agent:\s*(?:\*|Googlebot|Mediapartners-Google|Google-Display-Ads-Bot)\s*(?:#.*)?$/im.test(group)
  && /^Disallow:[ \t]*\/(?:\*)?[ \t]*(?:#.*)?$/im.test(group)
);
assert.equal(blockedGroups.length, 0, 'robots.txt blocks a Google crawler sitewide');
const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
assert.doesNotMatch(notFound, /adsbygoogle\.js|data-ad-slot=/, '404 must not serve ads');
assert.equal([...home.matchAll(/data-ad-slot="(?![0-9]+")/g)].length,0,'Non-numeric ad unit');
console.log({adsenseLoaders:loaderTags.length,invalidAdUnits:0});

// When serving is paused, no other page may enqueue a manual request either.
if (!loaderTags.length) for (const file of pages.keys()) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (file === 'comprobar-consentimiento/index.html') {
    // Isolated, opt-in diagnostic: no initial Google tag and never resumes ads.
    assert.equal(/<script[^>]*src=["'][^"']*adsbygoogle/.test(html),false);
    assert.ok(html.includes('pauseAdRequests=1'));
    assert.equal(/pauseAdRequests\s*=\s*0/.test(html),false);
    assert.ok(html.includes('noindex, follow'));
  } else assert.equal(html.includes('adsbygoogle.js'), false, file);
  assert.equal(html.includes('data-ad-slot='), false, file);
}
console.log({verificationPublisher:publisher,adServingPaused:!loaderTags.length});

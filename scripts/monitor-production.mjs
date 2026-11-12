import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const site = 'https://labormin.com';
const editorialPages = (await readdir(new URL('../src/content/guides/', import.meta.url)))
  .filter(file => file.endsWith('.md')).map(file => `/guias/${file.slice(0, -3)}/`);
const publicPages = ['/', '/about/', '/contact/', '/privacy/', '/terms/', '/archivo/', '/guias/',
  '/guias/formacion-minera-gratuita-economica-peru/', '/guias/verificar-oferta-remota-visa-salario/', ...editorialPages];
const sitemapIndex = '/sitemap-index.xml';
const normalizePath = pathname => pathname.replace(/\/$/, '') || '/';
const normalizeAds = text => text.split(/\r?\n/).map(line =>
  line.split('#')[0].split(',').map(field => field.trim()).join(','));

const localAds = await readFile(new URL('../public/ads.txt', import.meta.url), 'utf8');
const seller = normalizeAds(localAds).find(line => /^google\.com,pub-\d{16},DIRECT,f08c47fec0942fa0$/.test(line));
assert.ok(seller, 'Falta el editor de Google en public/ads.txt');
const publisher = `ca-${seller.split(',')[1]}`;

async function check(path, type, validate) {
  const url = new URL(path, site);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Labormin-Site-Monitor/1.0' },
        signal: AbortSignal.timeout(12_000),
      });
      const destination = new URL(response.url);
      const contentType = response.headers.get('content-type')?.split(';')[0].trim();
      if (response.status !== 200 || destination.origin !== site || normalizePath(destination.pathname) !== normalizePath(url.pathname) || !type.test(contentType ?? '')) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}, destino ${destination.href}, tipo ${contentType ?? 'ausente'}`);
      }
      const result = validate(await response.text());
      console.log(`OK ${url.href}`);
      return result;
    } catch (error) {
      const reason = error.cause?.code ?? error.message;
      if (attempt === 3) throw new Error(`${url.href} — ${reason}`);
      console.warn(`${url.href} — intento ${attempt}: ${reason}`);
      await delay(attempt * 1_000);
    }
  }
}

function locations(xml, root) {
  assert.ok(new RegExp(`<${root}(?:\\s|>)`).test(xml), `Falta el elemento ${root} del sitemap`);
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, value]) => new URL(value.trim()));
  assert.ok(urls.length, 'El sitemap está vacío');
  assert.ok(urls.every(url => url.origin === site), 'El sitemap contiene otro dominio');
  return urls;
}

async function checkSitemap() {
  const xmlType = /^(?:text|application)\/xml$/i;
  const files = await check(sitemapIndex, xmlType, xml => locations(xml, 'sitemapindex'));
  const routes = (await Promise.all(files.map(url => check(url, xmlType, xml => locations(xml, 'urlset'))))).flat();
  const indexed = new Set(routes.map(url => normalizePath(url.pathname)));
  const missing = publicPages.filter(path => !indexed.has(normalizePath(path)));
  assert.ok(!missing.length, `${site}${sitemapIndex} — faltan ${missing.map(path => new URL(path, site).href).join(', ')}`);
}

async function checkAboutRedirect(path) {
  const url = new URL(path, site);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000) });
  const location = response.headers.get('location');
  await response.body?.cancel();
  assert.equal(response.status, 301, `${url.href} — se esperaba una redirección 301`);
  assert.ok(location, `${url.href} — falta el destino de la redirección`);
  assert.equal(new URL(location, url).href, `${site}/about/`);
  console.log(`OK ${url.href} → /about/`);
}

const results = await Promise.allSettled([
  ...publicPages.map(path => check(path, /^text\/html$/i, html => {
    assert.ok(/<title>\s*[^<\s][^<]*<\/title>/i.test(html), 'Falta el título de la página');
    if (path === '/') {
      const meta = html.match(/<meta\b[^>]*\bname=["']google-adsense-account["'][^>]*>/i)?.[0] ?? '';
      assert.equal(meta.match(/\bcontent=["']([^"']+)["']/i)?.[1], publisher, 'El editor en la portada difiere del configurado');
    }
  })),
  check('/ads.txt', /^text\/plain$/i, body => {
    assert.ok(normalizeAds(body).includes(seller), 'Falta la línea del editor configurado');
  }),
  check('/robots.txt', /^text\/plain$/i, body => {
    assert.ok(body.split(/\r?\n/).some(line => line.trim() === `Sitemap: ${site}${sitemapIndex}`), 'Falta la URL del sitemap');
    const blocked = body.split(/\r?\n\s*\r?\n/).some(group =>
      /^User-agent:[ \t]*(?:\*|Googlebot|Mediapartners-Google|Google-Display-Ads-Bot)[ \t]*(?:#.*)?$/im.test(group)
      && /^Disallow:[ \t]*\/\*?[ \t]*(?:#.*)?$/im.test(group));
    assert.ok(!blocked, 'Un rastreador de Google está bloqueado en todo el sitio');
  }),
  checkSitemap(),
  ...['/nosotros', '/nosotros/'].map(checkAboutRedirect),
]);

for (const result of results) {
  if (result.status === 'rejected') {
    const message = result.reason.message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error::${message}`);
    process.exitCode = 1;
  }
}

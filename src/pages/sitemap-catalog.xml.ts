import type { APIRoute } from 'astro';
import { catalogNow, isActiveJobRow } from '../lib/catalog-data';
import { openCatalog } from '../lib/catalog';

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? 'https://labormin.com';
  const now = catalogNow().toISOString();
  const [jobs, guides] = await Promise.all([openCatalog('jobs', undefined, now), openCatalog('guides')]);
  const paths = [
    ...jobs.entries.filter(({ metadata }) => isActiveJobRow(metadata, now)).map(({ slug }) => `/jobs/${encodeURIComponent(slug)}/`),
    ...guides.entries.map(({ slug }) => `/guias/${encodeURIComponent(slug)}/`),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${new URL(path, base)}</loc></url>`).join('')}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

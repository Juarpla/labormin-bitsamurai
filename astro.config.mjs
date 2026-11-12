// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { archiveEntry, isPublicClosure } from './src/lib/job-archive.mjs';
import { isExpired, jobExpiration } from './src/lib/job-policy.mjs';

const buildTime = new Date();
const feedJobs = JSON.parse(readFileSync(new URL('./src/data/jobs.json', import.meta.url), 'utf8')).jobs;
const feedSlugs = new Set(feedJobs.map(job => job.slug));
// A source may republish an archived listing; active routes take precedence.
const archivedSlugs = new Set(JSON.parse(readFileSync(new URL('./src/data/jobs-archive.json', import.meta.url), 'utf8')).filter(j => !feedSlugs.has(j.slug) && !isPublicClosure(j)).map(j => `/jobs/${j.slug}`));

for (const job of feedJobs) {
  if (isExpired(job, buildTime) && !isPublicClosure(archiveEntry(job, jobExpiration(job).reason, buildTime))) {
    archivedSlugs.add(`/jobs/${job.slug}`);
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://labormin.com',
  output: 'static',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  // No route uses Astro.session; disabling avoids requiring a SESSION KV
  // namespace binding in the deployed Worker.
  session: false,
  // /ops/* es el panel interno — fuera del sitemap público.
  integrations: [sitemap({ filter: (page) => {
    const pathname = new URL(page).pathname.replace(/\/$/, '');
    return !pathname.startsWith('/ops/') && !['/404', '/comprobar-consentimiento'].includes(pathname) && !archivedSlugs.has(pathname);
  } })],
  i18n: {
    defaultLocale: 'es',
    // Solo español: la audiencia es Perú/LatAm hispanohablante (en/pt quedaron fuera del build)
    locales: ['es'],
    prefixDefaultLocale: false,
  },
  vite: {
    // workerd may return the Unix epoch while evaluating modules. Fix the
    // catalogue clock in the build process and use it on every static route.
    define: { 'import.meta.env.LABORMIN_BUILD_TIME': JSON.stringify(buildTime.toISOString()) },
    plugins: [tailwindcss()],
  },
});

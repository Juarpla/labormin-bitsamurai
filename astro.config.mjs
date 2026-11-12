// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

const buildTime = new Date();

// https://astro.build/config
export default defineConfig({
  site: 'https://labormin.com',
  output: 'static',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  // No route uses Astro.session; disabling avoids requiring a SESSION KV
  // namespace binding in the deployed Worker.
  session: false,
  // /ops/* es el panel interno — fuera del sitemap público.
  integrations: [
    ...(process.env.LABORMIN_EXPORT_CATALOG === '1' ? [{
      name: 'labormin-catalog-export',
      hooks: { 'astro:config:setup': ({ injectRoute }) => injectRoute({ pattern: '/_catalog-export.json', entrypoint: './scripts/catalog/export.ts' }) },
    }] : []),
    sitemap({ filter: (page) => {
      const pathname = new URL(page).pathname.replace(/\/$/, '');
      return !pathname.startsWith('/ops/') && !['/404', '/comprobar-consentimiento', '/_catalog-export.json'].includes(pathname);
    } }),
  ],
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

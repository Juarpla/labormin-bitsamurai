#!/usr/bin/env node
/** Local UI checks against the statically rendered site. */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isExpired, jobPosting } from '../src/lib/job-policy.mjs';
import { isPublicClosure } from '../src/lib/job-archive.mjs';
const base = process.env.VERIFY_BASE || 'http://localhost:4321';
const feed = JSON.parse(fs.readFileSync('src/data/jobs.json','utf8')).jobs;
const excluded = JSON.parse(fs.readFileSync('src/data/overrides.json','utf8')).exclude ?? {};
const jobs = feed.filter(job => !excluded[job.id] && !isExpired(job));
const activeSlugs = new Set(jobs.map(job => job.slug));
const archive = JSON.parse(fs.readFileSync('src/data/jobs-archive.json','utf8'))
  .filter(entry => !activeSlugs.has(entry.slug) && !excluded[entry.snapshot?.id]);
const richClosure = archive.find(isPublicClosure)
  ?? feed.find(job => !excluded[job.id] && isExpired(job));
const practice = jobs.find(job => job.slug.startsWith('ausenco-environmental-mine-closure-engineer-junior') && job.internship)
  ?? jobs.find(job => job.internship && job.description);
const pages = [
  ['education','/guias/formacion-minera-gratuita-economica-peru'],
  ['verification','/guias/verificar-oferta-remota-visa-salario'],
  ['editorial','/guias/cv-minero-sin-experiencia/'],['archive-index','/archivo/'],
  ...(richClosure ? [['closed',`/jobs/${richClosure.slug}`]] : []),
  ['about','/about'],['privacy','/privacy'],['guides','/guias'],['jobs','/jobs'],
  ['job',`/jobs/${jobs[0].slug}`],['archive',`/jobs/${archive.find(entry => !isPublicClosure(entry)).slug}`],
  ...(practice ? [['practice',`/jobs/${practice.slug}`]] : []),
  ['full-job',`/jobs/${jobs.find(job => jobPosting(job)).slug}`],
];
fs.mkdirSync('screenshots/reliability',{recursive:true});
for (const [engine,type] of Object.entries({chromium,webkit})) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    const adRequests=[];
    page.on('request', request => {if (/googlesyndication\.com|doubleclick\.net|fundingchoicesmessages\.google\.com/.test(request.url())) adRequests.push(request.url());});
    const errors=[]; page.on('pageerror',err => errors.push(err.message));
    for (const width of [375,1280]) {
      await page.setViewportSize({width,height:900});
      for (const [name,path] of pages) {
        const response = await page.goto(base+path,{waitUntil:'networkidle'});
        assert.equal(response?.status() ?? (await page.request.get(base + path)).status(), 200, `${engine} ${path}`);
        assert.equal(await page.locator('main h1').count(),1,path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow,false,`${engine} ${width} overflow ${path}`);
        await page.screenshot({path:`screenshots/reliability/${name}-${engine}-${width}.png`,fullPage:!['education','jobs'].includes(name),animations:'disabled'});
        if (name === 'education') {
          await page.locator('#carreras').scrollIntoViewIfNeeded();
          await page.screenshot({path:`screenshots/reliability/education-options-${engine}-${width}.png`,animations:'disabled'});
        }
        if (name === 'editorial') {
          assert.equal(await page.locator('[data-editorial-body] strong').count() > 0, true);
          await page.emulateMedia({ reducedMotion: 'reduce' });
          assert.equal(await page.locator('.editorial-trace').evaluate(node => getComputedStyle(node).animationName), 'none');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
        }
        if (name === 'closed') {
          assert.equal(await page.locator('[data-archived-job]').count(), 1);
          assert.equal(await page.getByRole('link', { name: 'Postular', exact: true }).count(), 0);
          assert.equal(await page.getByRole('heading', { name: 'Ofertas vigentes similares' }).count(), 1);
          assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0);
        }
        if (name === 'archive') {
          assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, follow');
          assert.equal(await page.locator('script[type="application/ld+json"]').count(),0);
        }
        if (name === 'job' || name === 'full-job') {
          assert.equal(await page.locator('[data-application-guide]').count(),1);
          assert.equal(await page.locator('.ad-wrap').count(),0);
          assert.equal(await page.locator('script[src*="adsbygoogle"]').count(),0);
          if (name === 'full-job') assert.equal(await page.locator('script[type="application/ld+json"]').count(),1);
        }
        if (name === 'job' || name === 'practice') {
          const description = page.locator('section[aria-labelledby="job-description-title"]');
          assert.equal(await description.getByRole('heading', { name: 'Descripción', exact: true }).isVisible(), true);
          assert.equal(await description.locator('[data-job-clear-view]').isVisible(), true);
          assert.equal(await description.locator('details').count(), 0);
          assert.equal(await description.getByRole('link', { name: 'Postular', exact: true }).count(), 1);
          assert.deepEqual(await page.locator('article > section > h2 > span[aria-hidden="true"]').allTextContents(), ['1', '2', '3', '4', '5', '6', '7']);
          assert.equal(await page.getByRole('link', { name: 'Postular', exact: true }).count(), 2);
          if (name === 'practice') assert.equal(await page.getByRole('link', { name: /Volver a prácticas/ }).getAttribute('href'), '/practicas');
        }
      }
    }
    await page.goto(base+'/jobs',{waitUntil:'networkidle'});
    await page.locator('#f-search').fill('zzzz-no-results');
    assert.equal(await page.locator('#jobs-empty').isVisible(),true);
    await page.locator('#f-clear-empty').click();
    assert.equal(await page.locator('#jobs-grid .job-card:visible').count(),jobs.filter(j=>!j.internship).length);
    // Quick view receives the same safe index shown in the detail page.
    await page.locator('[data-drawer-job]').first().click();
    assert.equal(await page.locator('#lm-drawer').isVisible(),true);
    const drawerApply = page.locator('#lm-drawer').getByRole('link', { name: 'Postular', exact: true });
    assert.equal(await drawerApply.locator('svg').isVisible(), true);
    assert.equal(await drawerApply.getAttribute('target'), '_blank');
    await page.locator('#lm-drawer-close').click();
    assert.deepEqual(errors,[],`${engine}: browser errors`);
    assert.deepEqual(adRequests,[],`${engine}: advertising must remain paused until CMP verification`);
    console.log(`✓ ${engine}: mobile/desktop, editorial pages, no overflow, archive, filters, quick view, employment description and recommendations`);
  } finally {await browser.close();}
}
// Public internal links from the built static pages must resolve locally.
const paths = new Set(['/','/faq','/practicas','/eventos','/bolsa','/terms','/contact',...pages.map(([,p])=>p)]);
const broken=[];
for(const path of paths) {
  const response=await fetch(base+path);
  if(response.status!==200) broken.push({path,status:response.status});
}
assert.deepEqual(broken,[]);
console.log(`✓ ${paths.size} primary public routes return 200`);

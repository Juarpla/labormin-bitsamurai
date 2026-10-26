#!/usr/bin/env node
/** Local UI checks; AI responses are intercepted, so this never calls a paid provider. */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.VERIFY_BASE || 'http://localhost:4321';
const jobs = JSON.parse(fs.readFileSync('src/data/jobs.json','utf8')).jobs;
const archive = JSON.parse(fs.readFileSync('src/data/jobs-archive.json','utf8'));
const pages = [
  ['education','/guias/formacion-minera-gratuita-economica-peru'],
  ['verification','/guias/verificar-oferta-remota-visa-salario'],
  ['about','/about'],['privacy','/privacy'],['guides','/guias'],['jobs','/jobs'],
  ['job',`/jobs/${jobs[0].slug}`],['archive',`/jobs/${archive[0].slug}`],
];
fs.mkdirSync('screenshots/reliability',{recursive:true});
for (const [engine,type] of Object.entries({chromium,webkit})) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    const errors=[]; page.on('pageerror',err => errors.push(err.message));
    for (const width of [375,1280]) {
      await page.setViewportSize({width,height:900});
      for (const [name,path] of pages) {
        const response = await page.goto(base+path,{waitUntil:'networkidle'});
        assert.equal(response.status(),200,`${engine} ${path}`);
        assert.equal(await page.locator('main h1').count(),1,path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow,false,`${engine} ${width} overflow ${path}`);
        await page.screenshot({path:`screenshots/reliability/${name}-${engine}-${width}.png`,fullPage:!['education','jobs'].includes(name),animations:'disabled'});
        if (name === 'education') {
          await page.locator('#carreras').scrollIntoViewIfNeeded();
          await page.screenshot({path:`screenshots/reliability/education-options-${engine}-${width}.png`,animations:'disabled'});
        }
        if (name === 'archive') {
          assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, follow');
          assert.equal(await page.locator('script[type="application/ld+json"]').count(),0);
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
    await page.locator('#lm-drawer-close').click();
    await page.goto(base+`/jobs/${jobs[0].slug}`,{waitUntil:'networkidle'});
    const original = await page.locator('#lm-desc').innerHTML();
    for (const status of [500,429,200]) {
      await page.route('**/api/translate-description',async route => {
        await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?{html:original}:{error:'simulated UI check'})});
      });
      await page.locator('#lm-clarity-btn').click();
      await page.waitForFunction(() => !document.querySelector('#lm-clarity-btn').disabled);
      if(status===500) {assert.equal(await page.locator('#lm-clarity-error').isVisible(),true); assert.equal(await page.locator('#lm-desc').innerHTML(),original);}
      if(status===429) {assert.equal(await page.locator('#lm-clarity-limit').isVisible(),true); await page.locator('#lm-clarity-limit-close').click();}
      if(status===200) {assert.notEqual(await page.locator('#lm-desc').innerHTML(),original); await page.locator('#lm-clarity-btn').click(); assert.equal(await page.locator('#lm-desc').innerHTML(),original);}
      await page.unroute('**/api/translate-description');
    }
    assert.deepEqual(errors,[],`${engine}: browser errors`);
    console.log(`✓ ${engine}: mobile/desktop, editorial pages, no overflow, archive, filters, quick view, AI success/error/limit/original`);
  } finally {await browser.close();}
}
// Public internal links from the built static pages must resolve locally.
const paths = new Set(['/','/faq','/practicas','/visa-pathways','/eventos','/bolsa','/terms','/contact',...pages.map(([,p])=>p)]);
const broken=[];
for(const path of paths) {
  const response=await fetch(base+path);
  if(response.status!==200) broken.push({path,status:response.status});
}
assert.deepEqual(broken,[]);
console.log(`✓ ${paths.size} primary public routes return 200`);

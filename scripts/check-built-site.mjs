#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist/client');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);
let checked=0;const missing=[];
for(const file of walk(root)){
  const html=fs.readFileSync(file,'utf8');
  for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)){
    if(!m[1].startsWith('/')||m[1].startsWith('//'))continue;
    const pathname=decodeURIComponent(new URL(m[1],'https://labormin.com').pathname);
    const target=path.join(root,pathname); checked++;
    if(!fs.existsSync(target)&&!fs.existsSync(path.join(target,'index.html')))missing.push({file:path.relative(root,file),href:m[1]});
  }
}
assert.deepEqual(missing,[]);
const xml=fs.readFileSync(path.join(root,'sitemap-0.xml'),'utf8');
const current=JSON.parse(fs.readFileSync('src/data/jobs.json')).jobs;
const archived=JSON.parse(fs.readFileSync('src/data/jobs-archive.json'));
assert.ok(xml.includes('/guias/formacion-minera-gratuita-economica-peru'));
for(const j of current)assert.ok(xml.includes('/jobs/'+j.slug),j.slug);
for(const j of archived)assert.equal(xml.includes('/jobs/'+j.slug),false,j.slug);
console.log({internalAnchorsChecked:checked,missing:0,activeJobsInSitemap:current.length,archivedJobsExcluded:archived.length});

const home = fs.readFileSync(path.join(root,'index.html'),'utf8');
const loaderTags = [...home.matchAll(/src="[^"]*adsbygoogle\.js[^\"]*"/g)];
assert.ok(loaderTags.length <= 1, 'Duplicate AdSense script');
const publisher = home.match(/name="google-adsense-account" content="ca-(pub-\d+)"/)?.[1];
if (publisher) {
  assert.ok(fs.readFileSync('public/ads.txt','utf8').includes(publisher), 'Publisher mismatch');
}
assert.equal([...home.matchAll(/data-ad-slot="(?![0-9]+")/g)].length,0,'Non-numeric ad unit');
console.log({adsenseLoaders:loaderTags.length,invalidAdUnits:0});

for (const job of archived) {
  const html = fs.readFileSync(path.join(root, 'jobs', job.slug, 'index.html'), 'utf8');
  assert.equal(html.includes('adsbygoogle.js'), false, 'Archived page must not load AdSense: ' + job.slug);
}
console.log({ archivedPagesWithoutAdsense: archived.length });

let guidance = 0, structured = 0;
for (const job of current) {
  const html = fs.readFileSync(path.join(root, 'jobs', job.slug, 'index.html'), 'utf8');
  assert.ok(html.includes('data-application-guide'), 'Missing original application guidance: ' + job.slug);
  assert.equal(html.includes('adsbygoogle.js'), false, 'Job details must stay outside monetization: ' + job.slug);
  assert.equal(html.includes('data-ad-slot='), false);
  if (html.includes('"@type":"JobPosting"')) structured++;
  guidance++;
}
// When serving is paused, no other page may enqueue a manual request either.
if (!loaderTags.length) for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  if (path.relative(root,file) === 'comprobar-consentimiento/index.html') {
    // Isolated, opt-in diagnostic: no initial Google tag and never resumes ads.
    assert.equal(/<script[^>]*src=["'][^"']*adsbygoogle/.test(html),false);
    assert.ok(html.includes('pauseAdRequests=1'));
    assert.equal(/pauseAdRequests\s*=\s*0/.test(html),false);
    assert.ok(html.includes('noindex, follow'));
    assert.equal(xml.includes('/comprobar-consentimiento'),false);
  } else assert.equal(html.includes('adsbygoogle.js'), false, file);
  assert.equal(html.includes('data-ad-slot='), false, file);
}
console.log({jobPagesWithGuidance:guidance,jobPostingPages:structured,verificationPublisher:publisher,adServingPaused:!loaderTags.length});

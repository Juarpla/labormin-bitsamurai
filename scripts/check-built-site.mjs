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
if (loaderTags.length) {
  const publisher = loaderTags[0][0].match(/ca-(pub-\d+)/)?.[1];
  assert.ok(fs.readFileSync('public/ads.txt','utf8').includes(publisher), 'Publisher mismatch');
}
assert.equal([...home.matchAll(/data-ad-slot="(?![0-9]+")/g)].length,0,'Non-numeric ad unit');
console.log({adsenseLoaders:loaderTags.length,invalidAdUnits:0});

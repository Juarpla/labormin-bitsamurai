import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inNiche, parseSalary, visaHeuristic } from '../../src/lib/job-policy.mjs';

test('remote modality does not admit an applicant in Peru when the employer restricts countries', () => {
  assert.equal(inNiche({country:'GLOBAL', remote:true, visaReported:false,
    description:'Remote-first workplace. All candidates must be legally authorized to work in one of the following countries: United States, Canada, Australia.'}), false);
});

test('generic work authorization and relocation do not report visa sponsorship', () => {
  assert.equal(visaHeuristic('Must already be authorized to work in the United States. Relocation assistance available.'), false);
  assert.equal(visaHeuristic('No visa sponsorship available.'), false);
});

test('salary parser rejects operational figures and an ambiguous employer range', () => {
  assert.equal(parseSalary('Our production is 250,000 tonnes with a USD 500,000 budget.', 'US'), null);
  assert.equal(parseSalary('The US base salary range per year is $140,00 - $240,000 (USD).', 'US'), null);
});

import { remoteEligibility, visaEvidence } from '../../src/lib/job-policy.mjs';
test('remote evidence must explicitly cover Peru and preserve incompatible restrictions', () => {
  for (const description of ['Work remotely from Peru.', 'Remote worldwide.']) {
    assert.equal(inNiche({country:'GLOBAL',remote:true,description}), true);
  }
  assert.equal(inNiche({country:'GLOBAL',remote:true,description:'Fully remote mining role.'}), false);
  assert.equal(inNiche({country:'US',remote:true,description:'Remote worldwide. Must already be authorized to work in the United States.'}), false);
  assert.equal(remoteEligibility({remote:true,description:'Remote worldwide. '+'A responsibility. '.repeat(500)+'Candidates must reside in Canada.'}).status,'restricted');
});
test('visa evidence separates an offer, denial, authorization and relocation', () => {
  assert.equal(visaEvidence('Visa sponsorship available.').status, 'offered');
  assert.equal(visaEvidence('Visa sponsorship is not available.').status, 'not-offered');
  assert.equal(visaEvidence('Must already be authorized to work.').status, 'authorization-required');
  assert.equal(visaEvidence('Relocation assistance available.').status, 'relocation-only');
  assert.equal(visaEvidence('Do you need visa sponsorship?').status, 'unknown');
});
test('salary retains exact, minimum, maximum and range meanings with period and geography', () => {
  for (const [text,kind,min,max] of [
    ['Salary: USD 65,000 per year.','exact',65000,null],
    ['Salary: from USD 65,000 per year.','minimum',65000,null],
    ['Salary: up to USD 65,000 per year.','maximum',null,65000],
    ['Salary: USD 65,000 - USD 90,000 per year.','range',65000,90000],
    ['Salary: USD 25.50 per hour.','exact',25.5,null],
  ]) {
    const salary = parseSalary(text,'US');
    assert.ok(salary, text); assert.equal(salary.kind,kind); assert.equal(salary.min,min); assert.equal(salary.max,max);
  }
  assert.equal(parseSalary('Salary: USD 65,000.', 'US'),null);
  assert.equal(parseSalary('The US base salary range is USD 65,000 - USD 90,000 per year.', 'GLOBAL').country,'US');
});

test('reused source text reclassifies legacy visa and salary instead of trusting stored flags', async () => {
  const { certifyJob } = await import('../../src/lib/job-policy.mjs');
  const job = certifyJob({country:'US',remote:false,title:'Mechanic',description:'Must already be authorized to work in the United States.',visaReported:true,salary:{min:240000,max:null,currency:'USD',period:'year'}});
  assert.equal(job.visaReported,false); assert.equal(job.salary,null);
});

import { repairFeed } from '../repair-job-feed.mjs';
import { formatSalaryValue, jobPosting } from '../../src/lib/job-policy.mjs';
test('offline repair expires a feed without changing its source refresh timestamp and is idempotent', () => {
  const feed = {generatedAt:'2026-09-22',jobs:[{id:'old',slug:'old',title:'Mechanic',company:'Mine',companySlug:'mine',country:'PE',remote:false,postedAt:'2026-09-22',url:'https://example.com/job',description:'A real description. '.repeat(10),visaReported:false,salary:null}]};
  const now = new Date('2026-10-26T12:00:00Z');
  const first = repairFeed(feed,{now});
  assert.equal(first.feed.jobs.length,0); assert.equal(first.archive[0].reason,'stale');
  assert.equal(first.feed.generatedAt,'2026-09-22');
  const second = repairFeed(first.feed,{now,previousArchive:first.archive});
  assert.deepEqual(second.archive,first.archive);
});
test('salary formatting never adds a plus to an exact amount', () => {
  assert.equal(formatSalaryValue(parseSalary('Salary: USD 25.50 per hour.','US')),'25.5 USD/hora');
  assert.equal(formatSalaryValue(parseSalary('Salary: up to USD 50,000 per year.','US')),'Hasta 50,000 USD/año');
});
test('structured data requires source publication date and full description, never guesses full time', () => {
  const job={title:'Mechanic',company:'Mine',country:'PE',city:'Lima',remote:false,description:'<p>Source requirements.</p>',descriptionStatus:'full',publishedAt:new Date().toISOString().slice(0,10)};
  assert.equal(jobPosting({...job,publishedAt:null}),null);
  assert.equal(jobPosting({...job,descriptionStatus:'source-extract'}),null);
  assert.equal(jobPosting(job).description,job.description);
  assert.equal('employmentType' in jobPosting(job),false);
});
test('ingest retains restrictions after the former description limit and rejects old cached details', async () => {
  const {mkJob,hydrateFromPrev} = await import('../ingest.mjs');
  const text = 'Responsibilities. '.repeat(500)+'Remote worldwide. Candidates must reside in Canada.';
  const job = mkJob({id:'x',source:'test',company:'Mine',title:'Geologist',country:'GLOBAL',remote:true,description:text,url:'https://example.com/job'});
  assert.ok(job.description.includes('Candidates must reside in Canada.'));
  assert.equal(inNiche(job),false);
  const previous = new Map([['x',{...job,visaReported:true,salary:{min:240000},policyVersion:1}]]);
  assert.equal(hydrateFromPrev(previous,{...job,description:''}),false);
});

test('global remote claims cannot override an exclusion of Peru or an unrecognized regional restriction', () => {
  assert.equal(inNiche({country:'GLOBAL',remote:true,description:'Remote worldwide. Candidates must reside in Brazil.'}),false);
  assert.equal(inNiche({country:'GLOBAL',remote:true,description:'Remote worldwide. We cannot hire candidates based in Peru.'}),false);
  assert.equal(inNiche({country:'GLOBAL',remote:true,description:'Remote worldwide except Peru.'}),false);
});

test('a mention of sponsorship without an offer is not evidence of sponsorship', () => {
  assert.equal(visaEvidence('Applicants requiring visa sponsorship will not be considered.').status,'not-offered');
  assert.equal(visaEvidence('Visa sponsorship requirements will be discussed during interviews.').status,'unknown');
  assert.equal(parseSalary('Competitive salary; manage an annual USD 500,000 production budget.','US'),null);
});

test('HiringRoom preserves requirements and benefits instead of publishing only the social teaser', async () => {
  const {hiringroomDescription} = await import('../ingest.mjs');
  const html = '<meta property="og:description" content="A teaser">' +
    '<div class="job-description-content"><p>MISI&Oacute;N: mantener equipos.</p></div>' +
    '<div class="job-description-content"><p>Requisitos: 5 a&ntilde;os de experiencia.</p></div>' +
    '<div class="job-description-content"><p>Beneficios seg&uacute;n ley.</p></div>';
  const text = hiringroomDescription(html);
  assert.ok(text.includes('MISIÓN')); assert.ok(text.includes('5 años')); assert.ok(text.includes('Beneficios según ley.'));
});

test('offline repair removes an explicitly expired posting even if recently observed', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const result = repairFeed({generatedAt:'2026-10-26',jobs:[{id:'expired',slug:'expired',title:'Mechanic',company:'Mine',country:'PE',postedAt:'2026-10-25',_validThrough:'2026-10-24',remote:false,url:'https://example.com/job',description:'Requirements and responsibilities. '.repeat(5)}]},{now});
  assert.equal(result.feed.jobs.length,0); assert.equal(result.archive[0].reason,'expired');
});

test('a legacy extract with a global promise cannot prove the absence of a later restriction', () => {
  assert.equal(inNiche({country:'GLOBAL',remote:true,descriptionStatus:'unknown',description:'Remote worldwide.'}),false);
});

test('general work and shift requirements are not work authorization requirements', () => {
  assert.equal(visaEvidence('Must be available for shift work, overtime, holidays, and weekends.').status,'unknown');
  assert.equal(visaEvidence('Must be a self-starter with the ability to work with others.').status,'unknown');
  assert.equal(visaEvidence('Must be legally authorized to work in the United States.').status,'authorization-required');
});

test('a marked description retains nested sections and final restrictions but excludes the footer', async () => {
  const {sourceJobDetail} = await import('../ingest.mjs');
  const html = '<meta itemprop="datePosted" content="2026-10-24"><div itemprop="description"><p>Responsibilities. '.repeat(1) +
    'Maintain equipment safely.</p><section><div>Requirements: valid license and five years experience.</div></section>' +
    '<p>No visa sponsorship available.</p></div><footer>Unrelated footer</footer>';
  const detail = sourceJobDetail(html);
  assert.ok(detail.description.includes('No visa sponsorship available.'));
  assert.ok(detail.description.includes('five years experience.'));
  assert.equal(detail.description.includes('Unrelated footer'),false);
  assert.equal(detail.publishedAt,'2026-10-24');
});

test('a teaser, a broken container and a multi-job page never become verified full text', async () => {
  const {sourceJobDetail} = await import('../ingest.mjs');
  assert.equal(sourceJobDetail('<meta property="og:description" content="'+'Source teaser. '.repeat(20)+'">'),null);
  assert.equal(sourceJobDetail('<div itemprop="description">'+'Unclosed content. '.repeat(20)),null);
  const jp = {'@type':'JobPosting',description:'Source requirements. '.repeat(10)};
  assert.equal(sourceJobDetail(`<script type="application/ld+json">${JSON.stringify([jp,jp])}</script>`),null);
  assert.equal(sourceJobDetail(`<script type="application/ld+json">${JSON.stringify(jp)}</script>`).publishedAt,null);
});

test('excerpt truncation never splits an emoji at the UTF-16 boundary', async () => {
  const { certifyJob } = await import('../../src/lib/job-policy.mjs');
  const description = 'a'.repeat(279) + '📆 resto de la oferta';
  const job = certifyJob({country:'PE',remote:false,title:'Técnico',description});
  assert.equal(job.excerpt.isWellFormed(),true);
  assert.equal(description.startsWith(job.excerpt),true);
  assert.equal(job.description,description);
});

test('foreign onsite jobs are excluded even when sponsorship or international applicants are mentioned', () => {
  assert.equal(inNiche({country:'CA', remote:false, visaReported:true, openToInternational:true, descriptionStatus:'full'}), false);
  assert.equal(inNiche({country:'PE', remote:false}), true);
  assert.equal(inNiche({country:'GLOBAL', remote:true, descriptionStatus:'full', description:'Work remotely from anywhere in the world.'}), true);
});

test('expiry respects the Lima day, the earlier employer deadline and the exact cutoff', async () => {
  const { isExpired, jobExpiration } = await import('../../src/lib/job-policy.mjs');
  const job = { postedAt: '2026-10-13', publishedAt: null };
  const at = new Date('2026-11-12T05:00:00Z');
  assert.equal(jobExpiration(job).date, at.toISOString());
  assert.equal(isExpired(job, new Date(at.getTime() - 1)), false);
  assert.equal(isExpired(job, at), true);
  assert.equal(jobExpiration({ ...job, validThrough: '2026-10-22' }).date, '2026-10-23T05:00:00.000Z');
  assert.equal(jobExpiration({ ...job, validThrough: '2026-10-22T18:24:00-05:00' }).date, '2026-10-22T23:24:00.000Z');
  assert.equal(jobExpiration({ ...job, firstReferenceAt: '2026-10-13', publishedAt: '2026-10-18' }).date, at.toISOString());
  const full = { ...job, title: 'Operador', company: 'Empresa', publishedAt: '2026-10-13', descriptionStatus: 'full', description: 'Texto fuente.', country: 'PE' };
  assert.equal(jobPosting(full, new Date(at.getTime() - 1)).validThrough, at.toISOString());
  assert.equal(jobPosting(full, at), null);
});

test('an observed listing keeps its clock until verified republication', async () => {
  const { withStableDates, updateArchive, compactArchiveEntry } = await import('../../src/lib/job-archive.mjs');
  const old = { id: 'a', slug: 'a', country: 'PE', remote: false, postedAt: '2026-10-01', description: 'Descripción de fuente. '.repeat(8) };
  const now = new Date('2026-11-12T05:00:00Z');
  const observed = withStableDates({ ...old, postedAt: '2026-11-12' }, old);
  assert.equal(observed.firstReferenceAt, old.postedAt);
  const unavailable = updateArchive([old], [], [], new Map(), {}, new Date('2026-10-20T05:00:00Z'));
  assert.equal(unavailable[0].reason, 'unavailable');
  const archive = updateArchive([], [], unavailable, new Map(), {}, now);
  assert.equal(archive[0].reason, 'stale');
  assert.deepEqual(archive[0], { slug: 'a', id: 'a', firstReferenceAt: old.postedAt, reason: 'stale' });
  const legacy = { slug: old.slug, reason: 'stale', referenceDate: old.postedAt, snapshot: old, title: 'Puesto', company: 'Empresa', url: 'https://example.com' };
  assert.deepEqual(compactArchiveEntry(legacy), archive[0]);
  assert.deepEqual(compactArchiveEntry(archive[0]), archive[0]);
  assert.equal(withStableDates({ ...old, postedAt: '2026-11-12' }, archive[0]).firstReferenceAt, old.postedAt);
  const republished = withStableDates({ ...old, postedAt: '2026-11-12', publishedAt: '2026-11-12' }, archive[0]);
  assert.equal(republished.firstReferenceAt, '2026-11-12');
  assert.deepEqual(updateArchive([], [republished], archive, new Map(), {}, now), []);
  assert.deepEqual(updateArchive([], [], archive, new Map(), { a: true }, now), []);
});

test('an existing source ID cannot extend an announced deadline without a new publication', async () => {
  const { withStableDates, compactArchiveEntry } = await import('../../src/lib/job-archive.mjs');
  const { isExpired } = await import('../../src/lib/job-policy.mjs');
  const old = compactArchiveEntry({
    id: 'a', slug: 'a', firstReferenceAt: '2026-10-25', publishedAt: '2026-10-25', validThrough: '2026-11-03', reason: 'expired',
  });
  const now = new Date('2026-11-13T05:00:00Z');
  const unchanged = withStableDates({ id: 'a', postedAt: '2026-11-12', publishedAt: null, validThrough: '2026-11-24' }, old);
  assert.equal(isExpired(unchanged, now), true);
  const republished = withStableDates({ id: 'a', postedAt: '2026-11-12', publishedAt: '2026-11-12' }, old);
  assert.equal(isExpired(republished, now), false);
});

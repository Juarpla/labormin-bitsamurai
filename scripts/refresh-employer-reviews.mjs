import { readFile, writeFile } from 'node:fs/promises';
import employers from '../src/data/employer-context.json' with { type: 'json' };

const cacheFile = new URL('../src/data/employer-reviews.json', import.meta.url);
const token = process.env.APIFY_TOKEN;
const reviewLimit = 20;
const topics = [
  ['Trabajo en equipo', /\b(?:companeros|companerismo|trabajo en equipo|colaboracion)\b/, 'mencionan la colaboración o el trato entre compañeros'],
  ['Seguridad', /\b(?:seguridad|induccion|epps?|protocolos)\b/, 'hablan de seguridad, inducción o protocolos en el trabajo'],
  ['Horarios y turnos', /\b(?:turnos?|horarios?|regimen|descansos?|guardias?)\b/, 'describen horarios, turnos o periodos de descanso'],
  ['Remuneración y beneficios', /\b(?:remuneracion|salario|sueldo|utilidades|beneficios)\b/, 'comentan la remuneración, las utilidades o los beneficios de su puesto'],
  ['Formación y desarrollo', /\b(?:aprendizaje|capacitacion|capacitaciones|ascensos?|crecimiento profesional)\b/, 'mencionan capacitación, aprendizaje o posibilidades de desarrollo'],
];

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function reviewKey(url) {
  const parsed = URL.parse(url ?? '');
  if (parsed?.protocol !== 'https:' || !/^(?:[a-z]+\.)?indeed\.com$/.test(parsed.hostname)) return '';
  return decodeURIComponent(parsed.pathname.split('/')[2] ?? '').toLowerCase();
}

function summarize(reviews) {
  const highlights = topics.map(([topic, pattern, phrase]) => {
    const count = reviews.filter(review => pattern.test(normalize([review.title, review.text, review.pros, review.cons].join(' ')))).length;
    return { topic, count, text: `${count} de ${reviews.length} opiniones ${phrase}.` };
  }).filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count).slice(0, 4)
    .map(({ topic, text }) => ({ topic, text }));
  return highlights.length >= 2 ? { total: reviews.length, highlights } : undefined;
}

async function runActor(actor, input, budget) {
  const endpoint = `https://api.apify.com/v2/actors/${actor}/run-sync-get-dataset-items?timeout=90&maxTotalChargeUsd=${budget}&forcePermissionLevel=LIMITED_PERMISSIONS`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(100_000),
  });
  if (!response.ok) throw new Error(`Apify devolvió HTTP ${response.status} para ${actor}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`Apify no devolvió resultados válidos para ${actor}.`);
  return rows;
}

async function checkOfficialSources() {
  const sources = new Map([
    ['https://southerncoppercorp.com/historia/', ['toquepala', 'cuajone', 'ilo']],
    ['https://www.chinalco.com.pe/contacto', ['san isidro', 'huancayo', 'nueva morococha']],
    ['https://www.chinalco.com.pe/operaciones/toromocho', ['toromocho', 'tajo abierto']],
  ]);
  const rows = await runActor('apify~website-content-crawler', {
    startUrls: [...sources.keys()].map(url => ({ url })),
    crawlerType: 'cheerio',
    maxCrawlDepth: 0,
    maxCrawlPages: sources.size,
    respectRobotsTxtFile: true,
  }, 0.15);
  for (const [url, terms] of sources) {
    const page = rows.find(row => row?.url?.replace(/\/$/, '') === url.replace(/\/$/, ''));
    const content = normalize(page?.text ?? page?.markdown);
    if (terms.every(term => content.includes(term))) {
      console.log(`Referencia de sedes encontrada en ${url}`);
    } else {
      console.warn(`::warning::Revisar las ubicaciones de ${url} porque la página no confirmó todas las referencias.`);
    }
  }
}

if (!token) {
  console.log('APIFY_TOKEN no configurado. Se conservan los resúmenes publicados.');
} else {
  const [locations, reviewRun] = await Promise.allSettled([
    checkOfficialSources(),
    runActor('scrapifier~indeed-reviews-scraper', {
      startUrls: Object.values(employers).map(employer => ({ url: employer.reviewsUrl })),
      reviewsFromCountry: 'PE',
      maxReviewsPerCompany: reviewLimit,
      maxChallengeRetries: 0,
    }, 0.5),
  ]);
  if (locations.status === 'rejected') console.warn(`::warning::No se pudieron contrastar las sedes. ${locations.reason.message}`);
  if (reviewRun.status === 'rejected') throw reviewRun.reason;

  const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
  let usable = 0;
  for (const [id, employer] of Object.entries(employers)) {
    const slug = reviewKey(employer.reviewsUrl);
    const matching = reviewRun.value.filter(row => row?.reviewId && normalize(row.country) === 'pe' &&
      reviewKey(row.url) === slug && typeof row.text === 'string' && row.text.trim());
    const distinct = [...new Map(matching.map(row => [row.reviewId, row])).values()].slice(0, reviewLimit);
    const all = summarize(distinct);
    if (!all) {
      console.log(`${id}: muestra insuficiente, se conserva el resumen publicado.`);
      continue;
    }
    usable++;
    const internships = summarize(distinct.filter(row => /\b(?:practicante|becari[oa]|intern)\b/.test(normalize(row.jobTitle))));
    cache[id] = { all, ...(internships && { internships }) };
    console.log(`${id}: resumen de ${distinct.length} opiniones.`);
  }
  if (!usable) throw new Error('Apify no devolvió muestras utilizables para las empresas configuradas.');
  await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n');
}

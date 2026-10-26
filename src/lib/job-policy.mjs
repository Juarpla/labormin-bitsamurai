/** Shared ingestion policy; no network or side effects. */
/** Negative or conflicting statements override positive snippets. */
export function visaEvidence(...texts) {
  const lines = sentences(texts.join('\n'));
  const topic = /visa|sponsor|patrocin|auspicio|permiso de trabajo/i;
  const negative = /(?:no|not|without|unable|cannot|can't|unavailable|sin|ning[uú]n|no se).{0,65}(?:sponsor|patrocin|visa)|(?:sponsor|patrocin|visa).{0,50}(?:not available|not provided|not be considered|unavailable|no disponible|no ofrec)/i;
  const offer = /(?:visa sponsorship (?:is |may be |can be |will be )?(?:available|provided|offered|considered)|sponsorship (?:is )?(?:available|provided|offered)|(?:will|can|may) (?:provide |offer )?sponsor|(?:provide|offer|support).{0,25}visa|(?:visa|immigration).{0,20}(?:support|provided)|(?:ofrece|ofrecemos|brinda|brindamos|proporciona).{0,40}(?:visa|patrocinio)|patrocinio de visa (?:disponible|ofrecido))/i;
  const denied = lines.filter(s => topic.test(s) && negative.test(s));
  const offered = lines.filter(s => offer.test(s) && !negative.test(s) && !/\?|whether|do you|need (?:a |visa )?sponsorship|requiere.*patrocin/i.test(s));
  const authorization = lines.filter(s => /(?:must|already|required|require|debe|exige|requiere).{0,60}(?:authori[sz]ed to work|eligible to work|right to work|work authori[sz]ation|work permit|permiso de trabajo|autorizaci[oó]n laboral)|(?:work permit|work authori[sz]ation|right to work|permiso de trabajo|autorizaci[oó]n laboral).{0,40}(?:required|must|exig|requier)/i.test(s));
  const relocation = lines.filter(s => /relocation (?:support|package|assistance)|ayuda (?:de |para )?reubicaci[oó]n/i.test(s));
  if (denied.length) return { status: offered.length ? 'conflicting' : 'not-offered', evidence: [...denied, ...offered] };
  if (offered.length) return { status: 'offered', evidence: offered };
  if (authorization.length) return { status: 'authorization-required', evidence: authorization };
  if (relocation.length) return { status: 'relocation-only', evidence: relocation };
  return { status: 'unknown', evidence: [] };
}
export function visaHeuristic(...texts) { return visaEvidence(...texts).status === 'offered'; }

/** Normalize only a single unambiguous compensation statement. Never combine
 * numbers from different sentences or repair an employer's malformed amounts. */
export function parseSalary(input, country) {
  if (!input) return null;
  const candidates = sentences(input).filter(s => /salary|salarial|sueldo|remuneraci[oó]n|salario|base pay|pay (?:range|rate)|compensation|^\s*(?:USD|CAD|AUD|PEN|S\/|US\$|\$)/i.test(s));
  const parsed = [];
  for (const raw of candidates) {
    if (/budget|production|tonnes|revenue|investment|presupuesto|tonelad/i.test(raw)) continue;
    if (/\d{2,},\d{1,2}(?!\d)/.test(raw) && /USD|US\$|\$/i.test(raw)) return null;
    const periods = [
      ['hour', /(?:per|an?|\/)\s*(?:hour|hr)\b|por hora|\/h\b/i],
      ['day', /(?:per|a|\/)\s*day\b|por d[ií]a|diario/i],
      ['month', /(?:per|a|\/)\s*(?:month|mo)\b|mensual|al mes|por mes/i],
      ['year', /(?:per|a|\/)\s*(?:year|yr)\b|annual|anual|al a[nñ]o|por a[nñ]o/i],
    ].filter(([, r]) => r.test(raw));
    if (periods.length !== 1) continue;
    let currency = /\bUSD\b|US\$/i.test(raw) ? 'USD' : /\bCAD\b|C\$/i.test(raw) ? 'CAD' : /\bAUD\b|A\$/i.test(raw) ? 'AUD' : /\bPEN\b|S\//i.test(raw) ? 'PEN' : /\bCLP\b/i.test(raw) ? 'CLP' : /EUR|€/i.test(raw) ? 'EUR' : /GBP|£/i.test(raw) ? 'GBP' : null;
    if (!currency && /\$/.test(raw)) currency = { US:'USD', CA:'CAD', AU:'AUD', CL:'CLP' }[country];
    if (!currency) continue;
    const matches = [...raw.matchAll(/(?:USD|CAD|AUD|PEN|CLP|US\$|C\$|A\$|S\/|\$|€|£)?\s*(?<![\w.,])(\d[\d,.]*)(?![\w.,])/g)];
    // Dates, percentages and operational quantities may share a pay paragraph.
    // A candidate must be currency-adjacent, or the second end of a pay range.
    const amounts = matches.filter((m,i) => {
      const prefix = raw.slice(Math.max(0,m.index-8),m.index + m[0].indexOf(m[1]));
      const suffix = raw.slice(m.index+m[0].length,m.index+m[0].length+8);
      return /USD|CAD|AUD|PEN|CLP|US\$|C\$|A\$|S\/|\$|€|£/i.test(prefix) || /USD|CAD|AUD|PEN|CLP/i.test(suffix) ||
        (i > 0 && /^\s*(?:[-–—]|to|a|hasta)\s*(?:\$|USD|CAD|AUD|PEN)?\s*$/i.test(raw.slice(matches[i-1].index+matches[i-1][0].length,m.index)));
    });
    if (!amounts.length || amounts.length > 2) continue;
    const numbers = amounts.map(m => {
      const v = m[1];
      if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(v)) return NaN;
      return Number(v.replaceAll(',',''));
    });
    if (numbers.some(n => !Number.isFinite(n) || n <= 0)) return null;
    let kind = numbers.length === 2 ? 'range' : /up to|maximum|m[aá]ximo|hasta/i.test(raw) ? 'maximum' : /from|starting|minimum|m[ií]nimo|desde|at least|\d\s*\+/i.test(raw) ? 'minimum' : 'exact';
    if (kind === 'range' && (numbers[0] > numbers[1] || numbers[1] / numbers[0] > 10)) return null;
    const scope = /(?:US|United States|U\.S\.) (?:base |pay|salary)|based (?:in|outside) the US/i.test(raw) ? 'US' : null;
    parsed.push({kind, min:kind === 'maximum' ? null : numbers[0], max:kind === 'range' ? numbers[1] : kind === 'maximum' ? numbers[0] : null, currency, period:periods[0][0], raw, ...(scope ? {country:scope} : {})});
  }
  return parsed.length === 1 ? parsed[0] : null;
}

const ALLOWED_COUNTRIES = new Set(['PE', 'CL', 'CA', 'US', 'AU']);

export const POLICY_VERSION = 2;
export const sourceText = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, '\n').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
const sentences = (text) => sourceText(text).split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(Boolean);
const COUNTRY_PATTERNS = {
  PE: /\bper[uú]\b/i, US: /\b(?:united states|usa|u\.s\.|estados unidos)\b/i,
  CA: /\bcanad[aá]\b/i, AU: /\baustralia\b/i, CL: /\bchile\b/i,
  GB: /\b(?:united kingdom|uk|reino unido)\b/i, ZA: /\b(?:south africa|sud[aá]frica)\b/i,
};
const countriesIn = s => Object.entries(COUNTRY_PATTERNS).filter(([,r]) => r.test(s)).map(([c]) => c);

/** Modality is separate from permission to perform the job while living in Peru.
 * Evidence is copied verbatim; unknown is never promoted to a positive. */
export function remoteEligibility(job) {
  if (!job.remote) return { status: 'unknown', countries: [], evidence: [] };
  const lines = sentences(job.description);
  const restriction = /(?:must|only|restricted|require[ds]?|limited|candidates? (?:must|need)|candidatos? deben|solo|[uú]nicamente|debe[n]?|necesita).{0,100}(?:authori[sz]|work|resid|bas(?:ed|e)|countr|ubic|pa[ií]s|trabaj)|(?:authori[sz]ed to work|right to work|residen(?:ts|cia)|based in|remote (?:in|within|from|[-–]))/i;
  const geography = /must.{0,45}(?:reside|be based|live in|be legally authori[sz]ed)|candidates?.{0,45}(?:based in|resid|from |located in)|(?:limited|restricted|hiring only|only hiring|eligible countries|remote only).{0,40}(?:in |to |from |countries)|(?:no|cannot|can't|not|except|excluding).{0,60}(?:per[uú]|worldwide)/i;
  const explicitlyDenied = lines.filter(s => /(?:no|cannot|can't|not|except|excluding|excepto).{0,70}per[uú]/i.test(s));
  if (explicitlyDenied.length) return {status:'restricted', countries:[], evidence:explicitlyDenied};
  const restrictions = lines.filter(s => (restriction.test(s) && countriesIn(s).length) || geography.test(s));
  const locationCountries = countriesIn(job.locationRaw || '');
  if (locationCountries.length && !locationCountries.includes('PE')) restrictions.push(job.locationRaw);
  // An incompatible requirement takes precedence over a generic global promise.
  const incompatible = restrictions.filter(s => !countriesIn(s).includes('PE'));
  if (incompatible.length) return { status: 'restricted', countries: [...new Set(incompatible.flatMap(countriesIn))], evidence: incompatible };
  const peru = lines.filter(s => /(?:remote|remot[oa]|work from|trabajar desde|candidates?|contrat|resid|based|ubic)/i.test(s) && COUNTRY_PATTERNS.PE.test(s));
  const worldwide = lines.filter(s => /(?:work (?:from )?anywhere|remote.{0,35}(?:worldwide|globally|anywhere in the world)|(?:worldwide|global).{0,20}remote|desde cualquier (?:pa[ií]s|parte del mundo))/i.test(s) && !/\b(?:not|no|except|excluding|exclu|excepto)\b/i.test(s));
  if (peru.length || worldwide.length || locationCountries.includes('PE')) return {
    status: 'peru-supported', countries: ['PE'], evidence: [...peru, ...worldwide, ...(locationCountries.includes('PE') ? [job.locationRaw] : [])],
  };
  return { status: 'unknown', countries: [], evidence: [] };
}

export function inNiche(job) {
  if (job.country === 'PE') return true;
  if (!ALLOWED_COUNTRIES.has(job.country) && job.country !== 'GLOBAL') return false;
  if (job.remote && job.descriptionStatus !== 'unknown' && remoteEligibility(job).status === 'peru-supported') return true;
  return ALLOWED_COUNTRIES.has(job.country) && ((job.descriptionStatus !== 'unknown' && job.visaReported === true) || job.openToInternational === true);
}

/** All ingestion paths and offline repair go through this boundary. Stored
 * booleans and legacy salary normalization are never classification evidence. */
export function certifyJob(input, { legacy = false } = {}) {
  const job = { ...input };
  job.descriptionStatus = job.descriptionStatus || (legacy ? 'unknown' : 'source-extract');
  job.visa = visaEvidence(job.title, job.description);
  job.visaReported = job.visa.status === 'offered' && job.descriptionStatus !== 'unknown';
  job.remoteEligibility = remoteEligibility(job);
  job.salary = parseSalary(job.salary?.kind && job.salary?.raw ? job.salary.raw : job.description, job.country);
  job.policyVersion = POLICY_VERSION;
  job.publishedAt = job.publishedAt || null;
  job.validThrough = job.validThrough || job._validThrough || null;
  delete job._validThrough;
  job.excerpt = sourceText(job.description).replace(/\s+/g,' ').slice(0,280);
  return job;
}

export function formatSalaryValue(salary) {
  if (!salary?.kind) return null;
  const fmt = n => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(n);
  const amount = salary.kind === 'range' ? `${fmt(salary.min)}–${fmt(salary.max)}` : salary.kind === 'maximum' ? `Hasta ${fmt(salary.max)}` : salary.kind === 'minimum' ? `Desde ${fmt(salary.min)}` : fmt(salary.min);
  const suffix = {year:'año',month:'mes',day:'día',hour:'hora'}[salary.period];
  return `${amount} ${salary.currency}/${suffix}${salary.country ? ` · solo ${salary.country}` : ''}`;
}

/** Only describe a current, sufficiently complete posting whose required
 * properties are backed by the source. Omit optional unconfirmed properties. */
export function isExpired(job, now = new Date()) {
  if (!job.validThrough) return false;
  const value = job.validThrough.length === 10 ? job.validThrough + 'T23:59:59Z' : job.validThrough;
  return Number.isFinite(Date.parse(value)) && Date.parse(value) < now.getTime();
}

export function jobPosting(job) {
  if (isExpired(job)) return null;
  if (!job.publishedAt || job.descriptionStatus !== 'full' || !job.description || !job.company) return null;
  const date = Date.parse(job.publishedAt);
  if (!Number.isFinite(date) || date < Date.now()-30*86400000 || date > Date.now()+86400000) return null;
  if (job.remote && job.remoteEligibility?.status !== 'peru-supported') return null;
  if (!job.remote && job.country === 'GLOBAL') return null;
  const salary = job.salary;
  return {
    '@context':'https://schema.org', '@type':'JobPosting', title:job.title,
    description:job.description, datePosted:job.publishedAt,
    ...(job.validThrough ? {validThrough:job.validThrough} : {}),
    hiringOrganization:{'@type':'Organization',name:job.company},
    ...(job.employmentType ? {employmentType:job.employmentType} : {}),
    ...(job.remote ? {jobLocationType:'TELECOMMUTE',applicantLocationRequirements:{'@type':'Country',name:'PE'}} : {jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:job.country,...(job.city ? {addressLocality:job.city} : {})}}}),
    ...(salary && !salary.country ? {baseSalary:{'@type':'MonetaryAmount',currency:salary.currency,value:{'@type':'QuantitativeValue',unitText:salary.period.toUpperCase(),...(salary.kind === 'exact' ? {value:salary.min} : {...(salary.min !== null ? {minValue:salary.min} : {}),...(salary.max !== null ? {maxValue:salary.max} : {})})}}} : {}),
    directApply:false,
  };
}

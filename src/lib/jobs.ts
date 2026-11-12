import { formatSalaryValue, isExpired, jobExpiration } from './job-policy.mjs';
import { archiveEntry, isPublicClosure } from './job-archive.mjs';
import rawArchive from '../data/jobs-archive.json';
import overrides from '../data/overrides.json';
import raw from '../data/jobs.json';
import rawPresentation from '../data/job-presentation.json';
import { localPresentation, organizeDescriptionBlocks, presentationKey, sectionLabels } from './job-presentation.mjs';
import { JobFileSchema, type Job } from '../schemas';
import { GLOBAL, countryName, useTranslations, type Locale } from './i18n';

export type Tier = 1 | 2;

/** Perú primero, seguido por empleos remotos compatibles con Perú. */
export function tierOf(job: Pick<Job, 'country' | 'remote' | 'remoteEligibility'>): Tier {
  return job.country === 'PE' ? 1 : 2;
}

function tierSorted(list: Job[]): Job[] {
  return [...list].sort(
    (a, b) => tierOf(a) - tierOf(b) || b.postedAt.localeCompare(a.postedAt)
  );
}

const parsed = JobFileSchema.parse(raw);
type ClearSection = { heading: keyof typeof sectionLabels; blocks: string[] };
const presentations = rawPresentation as Record<string, { titleEs: string | null; sections: ClearSection[] }>;

function prepared(job: Job) {
  return presentations[presentationKey(job)];
}

export function clearViewFor(job: Job, historical = false) {
  const sections = historical ? undefined : prepared(job)?.sections;
  const onlyOverview = sections?.length === 1 && sections[0].heading === 'overview';
  return sections?.length
    ? { sections: onlyOverview ? organizeDescriptionBlocks(sections[0].blocks) as ClearSection[] : sections, generated: true }
    : { sections: localPresentation(job.description) as ClearSection[], generated: false };
}

function withPresentation(job: Job): Job {
  const titleEs = prepared(job)?.titleEs;
  return titleEs ? { ...job, translations: { es: titleEs } } : job;
}

export type ArchivedJob = {
  slug: string; title: string; company: string; referenceDate: string; removedAt: string;
  reason: string; closedAt?: string; snapshot?: Job;
};

const excluded = new Set(Object.keys(overrides.exclude ?? {}));
export const catalogTime = new Date(import.meta.env.LABORMIN_BUILD_TIME);
const publicFeed = parsed.jobs.filter(job => !excluded.has(job.id));
export const allJobs: Job[] = tierSorted(publicFeed.filter(job => !isExpired(job, catalogTime)).map(withPresentation));
const feedSlugs = new Set(parsed.jobs.map(job => job.slug));
export const archivedJobs: ArchivedJob[] = [
  ...(rawArchive as ArchivedJob[]).filter(entry => !feedSlugs.has(entry.slug) && !excluded.has(entry.snapshot?.id ?? '')),
  ...publicFeed.filter(job => isExpired(job, catalogTime)).map(job => archiveEntry(job, jobExpiration(job).reason, catalogTime)),
].map(entry => entry.snapshot ? { ...entry, snapshot: withPresentation(entry.snapshot) } : entry);
export const closedJobs = archivedJobs.filter(isPublicClosure)
  .sort((a, b) => (b.closedAt ?? b.removedAt).localeCompare(a.closedAt ?? a.removedAt) || a.slug.localeCompare(b.slug));
/** Pool general (/, /jobs): sin prácticas — viven solo en /practicas (Perú). */
export const jobs: Job[] = allJobs.filter((j) => !(j.internship && j.country === 'PE'));
/** Prácticas/trainee/becarios activos en Perú, postedAt desc. */
export const internships: Job[] = allJobs
  .filter((j) => j.internship === true && j.country === 'PE')
  .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
export const generatedAt: string = parsed.generatedAt;

export type JobIndexEntry = {
  id: string;
  slug: string;
  title: string;
  company: string;
  country: string;
  city: string | null;
  location: string;
  remote: boolean;
  visaReported: boolean;
  openToInternational?: boolean;
  category: string;
  postedAt: string;
  salaryText: string | null;
  excerpt: string;
  url: string;
  translations?: { es?: string; en?: string; pt?: string };
};

const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Single location line for a job: the verbatim source location when it carries
 *  the place (e.g. "Cotui, Sanchez Ramirez, Dominican Republic"), otherwise the
 *  country, or "Global". The country name is only appended when the location
 *  string does not already name it — never shows contradictory pairs. */
export function locationLine(
  job: Pick<Job, 'locationRaw' | 'country'>,
  t: (key: string) => string,
): string {
  const raw = (job.locationRaw || '').trim();
  if (!raw || /^remote$/i.test(raw)) {
    if (job.country === GLOBAL) return raw || t('card.global');
    // "Remote" keeps the source wording; the country adds hire scope ("Remote · Peru").
    return raw ? `${raw} · ${countryName(job.country)}` : countryName(job.country);
  }
  if (job.country === GLOBAL) return raw;
  const n = normalizeText(raw);
  const named =
    n.includes(normalizeText(countryName(job.country))) ||
    new RegExp(`\\b${job.country}\\b`, 'i').test(n);
  return named ? raw : `${raw} · ${countryName(job.country)}`;
}

/** Translated title from the prepared presentation. */
export function titleFor(job: Pick<Job, 'title' | 'translations'>, locale: Locale): string {
  return job.translations?.[locale as 'es' | 'en' | 'pt'] || job.title;
}

/** True when the title shown for `locale` is an auto-translation (badge). */
export function isAutoTranslated(job: Pick<Job, 'title' | 'translations'>, locale: Locale): boolean {
  const t = job.translations?.[locale as 'es' | 'en' | 'pt'];
  return Boolean(t && t !== job.title);
}

/** Lightweight index embedded into pages for client-side hydration.
 *  `list` defaults to the general pool; /practicas passes `internships`. */
export function jobIndex(locale: Locale = 'es', list: Job[] = jobs): JobIndexEntry[] {
  const t = useTranslations(locale);
  return list.map((j) => ({
    id: j.id,
    slug: j.slug,
    title: j.title,
    company: j.company,
    country: j.country,
    city: j.city,
    location: locationLine(j, t),
    remote: j.remote,
    visaReported: j.visaReported,
    openToInternational: j.openToInternational,
    category: j.category,
    postedAt: j.postedAt,
    salaryText: formatSalary(j),
    excerpt: j.excerpt,
    url: j.url,
    translations: j.translations,
  }));
}

export function getJob(slug: string): Job | undefined {
  // Busca en TODO el feed: las prácticas no están en `jobs` pero su
  // detail page (/jobs/[slug]) debe seguir resolviendo.
  return allJobs.find((j) => j.slug === slug);
}

export function byCountry(code: string): Job[] {
  return jobs.filter((j) => j.country === code);
}

export function remoteJobs(): Job[] {
  return jobs.filter((j) => j.remote && j.remoteEligibility.status === 'peru-supported');
}

export function relatedJobs(job: Job, n = 4): Job[] {
  if (job.internship) {
    const sameListing = (candidate: Job) =>
      normalizeText(candidate.title).trim() === normalizeText(job.title).trim() &&
      candidate.companySlug.replace(/-peru$/, '') === job.companySlug.replace(/-peru$/, '');
    const relevance = (candidate: Job) =>
      2 * Number(job.category !== 'other' && candidate.category === job.category) +
      Number(Boolean(job.city) && candidate.city === job.city);

    return internships
      .filter(candidate => candidate.id !== job.id && !sameListing(candidate))
      .sort((a, b) => relevance(b) - relevance(a))
      .slice(0, n);
  }
  return jobs
    .filter((j) => j.id !== job.id && (j.country === job.country || j.category === job.category))
    .slice(0, n);
}

export function currentAlternatives(job: Job, limit = 3): Job[] {
  const pool = job.internship ? internships : jobs;
  const relevance = (candidate: Job) => 2 * Number(candidate.category === job.category && job.category !== 'other')
    + Number(candidate.country === job.country);
  return pool.filter(candidate => candidate.id !== job.id && relevance(candidate) > 0)
    .sort((a, b) => relevance(b) - relevance(a) || b.postedAt.localeCompare(a.postedAt))
    .slice(0, limit);
}

export function formatSalary(job: Job): string | null {
  return formatSalaryValue(job.salary);
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR', {
    dateStyle: 'medium',
    timeZone: iso.length === 10 ? 'UTC' : 'America/Lima',
  }).format(new Date(iso));
}

export const categoryOrder = [
  'exploration', 'drill-blast', 'geology', 'hse', 'maintenance',
  'processing', 'engineering', 'operations', 'other',
];

const categoryLabels = new Map([
  ['exploration', 'Exploración'],
  ['drill-blast', 'Perforación y voladura'],
  ['geology', 'Geología'],
  ['hse', 'Seguridad y ambiente'],
  ['maintenance', 'Mantenimiento'],
  ['processing', 'Procesamiento'],
  ['engineering', 'Ingeniería'],
  ['operations', 'Operaciones'],
  ['other', 'Otras áreas'],
]);

export function categoryLabel(category: string): string {
  return categoryLabels.get(category) ?? 'Otras áreas';
}

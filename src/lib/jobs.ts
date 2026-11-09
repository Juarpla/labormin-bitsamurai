import { formatSalaryValue } from './job-policy.mjs';
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

export function clearViewFor(job: Job) {
  const sections = prepared(job)?.sections;
  const onlyOverview = sections?.length === 1 && sections[0].heading === 'overview';
  return sections?.length
    ? { sections: onlyOverview ? organizeDescriptionBlocks(sections[0].blocks) as ClearSection[] : sections, generated: true }
    : { sections: localPresentation(job.description) as ClearSection[], generated: false };
}

export const allJobs: Job[] = tierSorted(parsed.jobs.map(job => {
  const titleEs = prepared(job)?.titleEs;
  return { ...job, translations: titleEs ? { es: titleEs } : undefined };
}));
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
  return jobs
    .filter((j) => j.id !== job.id && (j.country === job.country || j.category === job.category))
    .slice(0, n);
}

export function formatSalary(job: Job): string | null {
  return formatSalaryValue(job.salary);
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR', {
    dateStyle: 'medium',
  }).format(new Date(iso));
}

export const categoryOrder = [
  'exploration', 'drill-blast', 'geology', 'hse', 'maintenance',
  'processing', 'engineering', 'operations', 'other',
];

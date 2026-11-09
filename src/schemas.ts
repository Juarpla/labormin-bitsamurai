import { z } from 'astro/zod';

export const SalarySchema = z
  .object({
    kind: z.enum(['exact', 'range', 'minimum', 'maximum']),
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string(),
    period: z.enum(['year', 'month', 'day', 'hour']),
    raw: z.string(),
    country: z.string().optional(),
  })
  .nullable();

export const JobSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  company: z.string(),
  companySlug: z.string(),
  source: z.string(),
  /** ISO-3166 alpha-2 of a supported mining country, or "GLOBAL" */
  country: z.string(),
  city: z.string().nullable(),
  locationRaw: z.string(),
  remote: z.boolean(),
  remoteEligibility: z.object({
    status: z.enum(['peru-supported', 'restricted', 'unknown']),
    countries: z.array(z.string()),
    evidence: z.array(z.string()),
  }),
  visa: z.object({
    status: z.enum(['offered', 'not-offered', 'authorization-required', 'relocation-only', 'unknown', 'conflicting']),
    evidence: z.array(z.string()),
  }),
  policyVersion: z.number(),
  /** Heuristic visa-sponsorship signal — shown as "reported", never guaranteed */
  visaReported: z.boolean(),
  /** Listing source explicitly opens the job to international candidates
   *  (e.g. Canada Job Bank with the international-candidates filter). */
  openToInternational: z.boolean().optional(),
  /** Detectado en ingest por heurística de título/descripción: práctica
   *  (pre)profesional, trainee o becario. Se lista solo en /practicas (Perú). */
  internship: z.boolean().optional(),
  category: z.string(),
  salary: SalarySchema,
  /** Sorting/TTL reference; not necessarily the employer publication date. */
  postedAt: z.string(),
  publishedAt: z.string().nullable(),
  validThrough: z.string().nullable().optional(),
  fetchedAt: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'OTHER']).optional(),
  url: z.string().url(),
  description: z.string(),
  excerpt: z.string(),
  descriptionStatus: z.enum(['full', 'source-extract', 'unknown']),
  /** Legacy title translations may still be present in older feeds. */
  translations: z
    .object({
      es: z.string().optional(),
      en: z.string().optional(),
      pt: z.string().optional(),
    })
    .optional(),
});

export const JobFileSchema = z.object({
  generatedAt: z.string(),
  jobs: z.array(JobSchema),
});

export const PathwaySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['working-holiday', 'temporary', 'student', 'sponsorship', 'skilled']),
  /** Destination country (ISO-2) */
  country: z.string(),
  /** ISO-2 nationality codes. null = open to all nationalities */
  eligibleNationalities: z.array(z.string()).nullable(),
  ageRange: z.string().nullable(),
  duration: z.string(),
  workRights: z.string(),
  officialUrl: z.string().url(),
  notes: z.string().optional(),
  lastVerifiedAt: z.string(),
});

/** Manually verified mining event with its official source. */
export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** presencial: only Peru. virtual: Peru or the mining powers. */
  mode: z.enum(['presencial', 'virtual']),
  type: z.enum(['feria-laboral', 'expo', 'conferencia', 'webinar']),
  /** ISO-2: PE for presencial; PE/CL/CA/US/AU for virtual */
  country: z.string(),
  city: z.string().nullable(),
  /** ISO date (YYYY-MM-DD) — start */
  date: z.string(),
  /** ISO date (YYYY-MM-DD), optional — last day of multi-day events */
  endDate: z.string().optional(),
  officialUrl: z.string().url(),
  notes: z.string().optional(),
  lastVerifiedAt: z.string(),
});

export const EventFileSchema = z.object({
  generatedAt: z.string(),
  events: z.array(EventSchema),
});

/** Punto mensual de una serie de indicadores (fecha YYYY-MM). */
export const IndicatorPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

/** Serie de indicadores generada por scripts/ingest-indicators.mjs (cron mensual). */
export const IndicatorSeriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  sourceId: z.string(),
  points: z.array(IndicatorPointSchema),
});

/** Ranking de unidades metálicas en producción por departamento (MINEM, anual). */
export const DepartmentsSchema = z.object({
  sourceId: z.string(),
  label: z.string(),
  totalMetallic: z.number(),
  totalAll: z.number(),
  rows: z.array(z.object({ name: z.string(), count: z.number() })),
});

/** Cifra curada a mano del empleo minero formal (BEM MINEM, mensual). */
export const EmploymentStatSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  period: z.string(),
  changeYoYPct: z.number(),
  breakdown: z.array(z.object({ label: z.string(), value: z.number() })),
  note: z.string(),
  officialUrl: z.string().url(),
  lastVerifiedAt: z.string(),
});

export const IndicatorSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  officialUrl: z.string().url(),
  lastVerifiedAt: z.string(),
});

export const IndicatorsFileSchema = z.object({
  generatedAt: z.string(),
  series: z.array(IndicatorSeriesSchema),
  departments: DepartmentsSchema.nullable(),
  sector: z.object({ employment: EmploymentStatSchema.nullable() }),
  sources: z.array(IndicatorSourceSchema),
});

/** Cotización mensual de una minera listada (Yahoo Finance, ADR en USD).
 *  name/ticker/exchange/metal/mines son CURADOS en scripts/ingest-stocks.mjs;
 *  los números los produce la ingesta. */
export const StockCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  ticker: z.string(),
  exchange: z.string(),
  exchangeRef: z.string().nullable(),
  metal: z.string(),
  mines: z.string(),
  currency: z.string(),
  price: z.number(),
  yearAgoClose: z.number(),
  change1yPct: z.number().nullable(),
  high52w: z.number().nullable(),
  low52w: z.number().nullable(),
  series: z.array(z.number()),
});

export const StocksFileSchema = z.object({
  generatedAt: z.string(),
  source: IndicatorSourceSchema,
  companies: z.array(StockCompanySchema),
});

export type Job = z.infer<typeof JobSchema>;
export type Salary = z.infer<typeof SalarySchema>;
export type Pathway = z.infer<typeof PathwaySchema>;
export type Event = z.infer<typeof EventSchema>;
export type IndicatorSeries = z.infer<typeof IndicatorSeriesSchema>;
export type IndicatorPoint = z.infer<typeof IndicatorPointSchema>;
export type Departments = z.infer<typeof DepartmentsSchema>;
export type EmploymentStat = z.infer<typeof EmploymentStatSchema>;
export type StockCompany = z.infer<typeof StockCompanySchema>;

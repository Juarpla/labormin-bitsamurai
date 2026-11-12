import { archivedJobs, allJobs, catalogTime, clearViewFor, tierOf, titleFor, type ArchivedJob } from './jobs';
import { jobExpiration } from './job-policy.mjs';
import { archiveEntry, isPublicClosure } from './job-archive.mjs';
import { education } from './education';
import { events } from './events';
import { editorialGuides, visualGuides, type GuideMetadata } from './editorial-guides';
import { searchText } from './pagination';
import type { Event, Job } from '../schemas';

export type CatalogKind = keyof CatalogTypes;
export type JobRecord = { job: Job | null; archive: ArchivedJob | null; clearView?: ReturnType<typeof clearViewFor> };
export type JobMeta = {
  type: 'job' | 'internship' | 'archived';
  indexable: boolean;
  indexableAfterClosing: boolean;
  closesAt: string | null;
  closesFor: 'expired' | 'stale' | null;
  country: string;
  category: string;
  remote: boolean;
  tier: number;
  search: string;
  excerptKey: string;
};
export type Training = typeof education[number];
export type TrainingMeta = Pick<Training, 'type' | 'department' | 'mode' | 'costKind'> & { search: string };
export type GuideSummary = Omit<GuideMetadata, 'steps'> & { visual?: boolean };
export type GuideArticle = (GuideSummary & { visual: true }) | (GuideMetadata & { visual?: false; html: string; updatedAt: string });
export type EventMeta = { endsOn: string; date: string };
type CatalogTypes = {
  jobs: [JobMeta, JobRecord];
  training: [TrainingMeta, Training];
  events: [EventMeta, Event];
  guides: [GuideSummary, GuideArticle];
};
export type CatalogEntry<K extends CatalogKind> = { slug: string; metadata: CatalogTypes[K][0] };
export type CatalogRow<K extends CatalogKind> = CatalogEntry<K> & { payload: CatalogTypes[K][1] };

function jobRow(job: Job | null, archive: ArchivedJob | null): CatalogRow<'jobs'> {
  const expiration = job && !archive ? jobExpiration(job) : null;
  return {
    slug: (job?.slug ?? archive?.slug)!,
    metadata: {
      type: archive ? 'archived' : job?.internship && job.country === 'PE' ? 'internship' : 'job',
      indexable: archive ? isPublicClosure(archive) : true,
      indexableAfterClosing: !!(job && expiration && isPublicClosure(archiveEntry(job, expiration.reason, catalogTime))),
      closesAt: expiration?.date ?? null,
      closesFor: expiration?.reason ?? null,
      country: job?.country ?? '',
      category: job?.category ?? '',
      remote: job?.remote ?? false,
      tier: job ? tierOf(job) : 0,
      search: job ? searchText(`${titleFor(job, 'es')} ${job.title} ${job.company} ${job.city ?? ''} ${job.locationRaw ?? ''}`) : '',
      excerptKey: !archive && job ? job.excerpt.trim().replace(/\s+/g, ' ').toLowerCase() : '',
    },
    payload: { job, archive, ...(!archive && job ? { clearView: clearViewFor(job) } : {}) },
  };
}

const compareTraining = (a: Training, b: Training) => {
  const rank = ['capacita-t', 'jovenes-productivos', 'promae-comas', 'cetpro-juliaca'];
  const order = (item: Training) => rank.includes(item.id) ? rank.indexOf(item.id) : rank.length;
  return order(a) - order(b);
};

function guideSummary(guide: GuideSummary): GuideSummary {
  return { title: guide.title, description: guide.description, group: guide.group, icon: guide.icon, visual: guide.visual };
}

export const guideDate = '2026-11-12';

let jobsSnapshot: CatalogRow<'jobs'>[] | undefined;
const snapshot = {
  jobs: () => jobsSnapshot ??= [
    ...allJobs.map(job => jobRow(job, null)),
    ...archivedJobs.map(archive => jobRow(archive.snapshot ?? null, archive)),
  ],
  training: () => [...education].sort(compareTraining).map(option => ({
    slug: option.id,
    metadata: {
      type: option.type, department: option.department, mode: option.mode, costKind: option.costKind,
      search: searchText(`${option.title} ${option.name} ${option.location} ${option.program}`),
    },
    payload: option,
  })),
  events: () => events.map(event => ({
    slug: event.id,
    metadata: { endsOn: event.endDate ?? event.date, date: event.date },
    payload: event,
  })),
  guides: async () => [
    ...visualGuides.map(guide => {
      const payload = { ...guideSummary(guide), visual: true as const };
      return { slug: guide.slug, metadata: payload, payload };
    }),
    ...await Promise.all(editorialGuides.map(async guide => ({
      slug: guide.slug,
      metadata: guideSummary(guide),
      payload: { ...guideSummary(guide), visual: false as const, steps: guide.steps, html: await guide.compiledContent(), updatedAt: guideDate },
    }))),
  ],
} satisfies { [K in CatalogKind]: () => CatalogRow<K>[] | Promise<CatalogRow<K>[]> };

const memo = new Map<CatalogKind, Promise<unknown[]>>();
export async function snapshotRows<K extends CatalogKind>(kind: K): Promise<CatalogRow<K>[]> {
  if (!memo.has(kind)) memo.set(kind, Promise.resolve(snapshot[kind]()));
  return await memo.get(kind) as CatalogRow<K>[];
}

export function catalogNow() {
  // Astro's build sandbox can report the Unix epoch while prerendering.
  return new Date(Math.max(Date.now(), catalogTime.getTime()));
}

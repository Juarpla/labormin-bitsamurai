import { inNiche, isExpired, jobDate, jobExpiration } from './job-policy.mjs';

export function needsArchiveEntry(reason) {
  return reason === 'stale' || reason === 'expired' || reason === 'unavailable';
}

// This history belongs to ingestion. It must not contain a public copy of a vacancy.
export function compactArchiveEntry(entry) {
  const job = entry.snapshot ?? entry;
  const validThrough = job.validThrough || (entry.reason === 'expired' ? entry.closedAt : null);
  return {
    slug: entry.slug,
    ...(job.id && { id: job.id }),
    firstReferenceAt: job.firstReferenceAt || job.postedAt || entry.referenceDate,
    ...(job.publishedAt && { publishedAt: job.publishedAt }),
    ...(validThrough && { validThrough }),
    reason: entry.reason,
  };
}

export function archiveEntry(job, reason) {
  return compactArchiveEntry({ ...job, reason });
}

/** Keep a source listing's first reference stable across observations and disappearances. */
export function withStableDates(job, previous) {
  const old = previous?.snapshot ?? previous;
  const firstReferenceAt = old?.firstReferenceAt || old?.postedAt || previous?.referenceDate || job.firstReferenceAt || job.postedAt;
  const closingTime = old && jobExpiration({ ...old, firstReferenceAt })?.time;
  const confirmed = jobDate(job.publishedAt);
  if (old && Number.isFinite(confirmed) && confirmed >= closingTime && confirmed !== jobDate(old.publishedAt)) {
    return { ...job, firstReferenceAt: job.publishedAt };
  }
  return {
    ...job,
    firstReferenceAt,
    publishedAt: old?.publishedAt || job.publishedAt,
    validThrough: (previous?.reason === 'expired' && old?.validThrough) || job.validThrough || old?.validThrough || null,
  };
}

export function updateArchive(previous, active, archive, observed, excluded, now) {
  const bySlug = new Map(archive.filter(entry => needsArchiveEntry(entry.reason)).map(compactArchiveEntry).map(entry => [entry.slug, entry]));
  const stillActive = new Set(active.map(job => job.slug));
  const activeIds = new Set(active.map(job => job.id));
  for (const job of previous) {
    if (excluded[job.id] || stillActive.has(job.slug) || activeIds.has(job.id)) continue;
    const latest = observed.get(job.id) ?? job;
    const expired = isExpired(latest, now);
    const reason = !inNiche(latest) ? 'eligibility-unverified' : expired ? jobExpiration(latest).reason : 'unavailable';
    if (needsArchiveEntry(reason)) bySlug.set(job.slug, archiveEntry({ ...latest, slug: job.slug }, reason));
    else bySlug.delete(job.slug);
  }
  for (const [slug, entry] of bySlug) {
    if (stillActive.has(slug) || activeIds.has(entry.id) || excluded[entry.id]) {
      bySlug.delete(slug);
    } else if (entry.reason === 'unavailable' && isExpired(entry, now)) {
      bySlug.set(slug, { ...entry, reason: jobExpiration(entry).reason });
    }
  }
  return [...bySlug.values()];
}

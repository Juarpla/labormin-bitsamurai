import { inNiche, isExpired, jobDate, jobExpiration, sourceText } from './job-policy.mjs';

export function isPublicClosure(entry) {
  return (entry.reason === 'stale' || entry.reason === 'expired') &&
    Boolean(entry.snapshot && sourceText(entry.snapshot.description).length >= 80 && inNiche(entry.snapshot));
}

export function archiveEntry(job, reason, now) {
  return {
    slug: job.slug,
    title: job.title,
    company: job.company,
    url: job.url,
    referenceDate: job.postedAt,
    removedAt: now.toISOString().slice(0, 10),
    reason,
    ...(['stale', 'expired', 'unavailable'].includes(reason) && {
      snapshot: job,
      ...(reason !== 'unavailable' && { closedAt: jobExpiration(job)?.date }),
    }),
  };
}

/** Keep a source listing's first reference stable across observations and disappearances. */
export function withStableDates(job, previous) {
  const old = previous?.snapshot ?? previous;
  const closingTime = old && (jobExpiration(old)?.time ?? jobExpiration({ postedAt: old.referenceDate })?.time);
  const confirmed = jobDate(job.publishedAt);
  if (old && Number.isFinite(confirmed) && confirmed >= closingTime) {
    return { ...job, firstReferenceAt: job.publishedAt };
  }
  return {
    ...job,
    firstReferenceAt: old?.firstReferenceAt || old?.postedAt || old?.referenceDate || job.postedAt,
    publishedAt: old?.publishedAt || job.publishedAt,
    validThrough: job.validThrough || old?.validThrough || null,
  };
}

export function updateArchive(previous, active, archive, observed, excluded, now) {
  const bySlug = new Map(archive.map(entry => [entry.slug, entry]));
  const stillActive = new Set(active.map(job => job.slug));
  for (const job of previous) {
    if (excluded[job.id] || stillActive.has(job.slug)) continue;
    const latest = observed.get(job.id) ?? job;
    const expired = isExpired(latest, now);
    const reason = !inNiche(latest) ? 'eligibility-unverified' : expired ? jobExpiration(latest).reason : 'unavailable';
    const snapshot = { ...job, publishedAt: latest.publishedAt, validThrough: latest.validThrough, firstReferenceAt: latest.firstReferenceAt || job.firstReferenceAt };
    bySlug.set(job.slug, archiveEntry(snapshot, reason, now));
  }
  for (const [slug, entry] of bySlug) {
    if (stillActive.has(slug) || (entry.snapshot && excluded[entry.snapshot.id])) {
      bySlug.delete(slug);
    } else if (entry.reason === 'unavailable' && entry.snapshot && isExpired(entry.snapshot, now)) {
      const { reason, date } = jobExpiration(entry.snapshot);
      bySlug.set(slug, { ...entry, reason, closedAt: date });
    }
  }
  return [...bySlug.values()];
}

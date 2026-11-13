import { z } from 'zod';
import { trainingTopics, topicsForProgram } from './training-topics.mjs';

const text = z.string().trim().min(1).max(1200);
const slug = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const webUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });
const source = z.object({ label: text, url: webUrl }).strict();
const mode = z.enum(['virtual', 'presencial', 'consultar']);
const mapEmbed = z.url().refine(value => {
  const url = new URL(value);
  if (url.origin !== 'https://www.google.com' || url.username || url.password) return false;
  if (url.pathname === '/maps/embed') return Boolean(url.searchParams.get('pb'));
  // Some institutions publish an iframe for their street address directly.
  return url.pathname === '/maps' && Boolean(url.searchParams.get('q')) && url.searchParams.get('output') === 'embed';
}, 'Usa la inserción de Google Maps publicada por la institución.');

export const programSchema = z.object({
  center: slug,
  slug,
  title: z.string().trim().min(2).max(200),
  source: source.extend({ verifiedAt: z.iso.date() }),
  summary: text.optional(),
  mode: mode.optional(),
  cost: z.object({ kind: z.enum(['gratuito', 'parcial', 'consultar']), label: text, detail: text.optional() }).strict().optional(),
  duration: text.optional(),
  credential: text.optional(),
  admission: text.optional(),
  availability: text.optional(),
  action: source.optional(),
  curriculum: z.array(text).min(1).max(12).optional(),
  location: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('campus'), label: text, address: text, source, embed: mapEmbed.optional() }).strict(),
    z.object({ kind: z.enum(['city', 'region']), label: text, source: source.optional() }).strict(),
  ]).optional(),
  notes: z.array(source.extend({ kind: z.enum(['area', 'alumni', 'employers', 'outlook']), text })).max(12).optional(),
  topics: z.array(z.enum(Object.keys(trainingTopics))).max(8).optional(),
  reviewed: z.boolean().optional(),
}).strict().refine(program => !program.reviewed || (program.summary && program.curriculum &&
  (program.duration || program.credential || (program.mode && program.mode !== 'consultar') || program.cost?.kind === 'parcial' || program.cost?.kind === 'gratuito')),
'Para indexar una ficha, incluye qué se aprende y al menos un dato verificable para decidir.');

export function programKey(program) {
  return `${program.center}/${program.slug}`;
}

/** @param {string} center @param {string} [program] */
export function trainingPath(center, program) {
  return `/formacion/${encodeURIComponent(center)}/${program ? `${encodeURIComponent(program)}/` : ''}`;
}

export function programMetadata(program) {
  const topics = program.topics ?? topicsForProgram(program.title);
  return {
    center: program.center,
    title: program.title,
    mode: program.mode ?? 'consultar',
    costKind: program.cost?.kind ?? 'consultar',
    costLabel: program.cost?.label,
    costNote: program.cost?.detail,
    location: program.location?.label,
    search: [program.title, ...(program.curriculum ?? [])].join(' '),
    priority: topics.some(topic => trainingTopics[topic].mining) ? 0 : topics.length ? 1 : 2,
    indexable: program.reviewed === true,
  };
}

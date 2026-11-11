import contexts from '../data/employer-context.json';
import reviews from '../data/employer-reviews.json';

interface EmployerLocation {
  name: string;
  address: string;
  description: string;
  sourceUrl?: string;
}

interface ReviewSummary {
  total: number;
  highlights: { topic: string; text: string }[];
}

const reviewCache: Record<string, { all: ReviewSummary; internships?: ReviewSummary }> = reviews;

export function employerContext(company: string, country: string, internship?: boolean) {
  if (country !== 'PE') return null;
  const name = company.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const match = Object.entries(contexts).find(([, context]) => context.aliases.includes(name));
  if (!match) return null;
  const [id, context] = match;
  const collected = reviewCache[id];
  const practiceSample = internship ? collected?.internships : undefined;
  const locations: EmployerLocation[] = context.locations;
  return { ...context, locations, reviewSummary: practiceSample ?? collected?.all, practiceSample: Boolean(practiceSample) };
}

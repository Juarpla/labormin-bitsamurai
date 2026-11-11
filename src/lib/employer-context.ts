import { verifiedEmployer } from './job-analysis.mjs';
import reviews from '../data/employer-reviews.json';

interface EmployerLocation {
  name: string;
  address: string;
  description: string;
  sourceUrl?: string;
  headquarters?: boolean;
}

interface ReviewSummary {
  total: number;
  highlights: { topic: string; text: string }[];
}

const reviewCache: Record<string, { all: ReviewSummary; internships?: ReviewSummary }> = reviews;

export function employerContext(company: string, country: string, internship?: boolean) {
  const match = verifiedEmployer(company, country);
  if (!match) return null;
  const [id, context] = match;
  const profile: {
    summary: string; summaryUrl?: string; network?: string; contactUrl?: string;
    phone?: string; phoneLabel?: string; contactTip?: string;
  } | undefined = context.profile;
  const collected = reviewCache[id];
  const practiceSample = internship ? collected?.internships : undefined;
  const locations: EmployerLocation[] = context.locations;
  return { ...context, profile, locations, reviewSummary: practiceSample ?? collected?.all, practiceSample: Boolean(practiceSample) };
}

import research from '../data/job-research.json' with { type: 'json' };
import { matchText } from './job-matching.mjs';

export const companyName = company => matchText(company).replace(/\s+(?:s a a|s a c|s r l|s a|saa|sac|srl|ltd|inc)$/, '');
export const companyKey = job => `${job.country.toLowerCase()}:${companyName(job.company)}`;
export const placeKey = (job, destination) => `${job.country.toLowerCase()}:${matchText(destination)}`;

export function researchedCompany(job) {
  return research.companies[companyKey(job)]?.facts ?? [];
}

export function researchedPlace(job, destination) {
  return !job.remote && destination ? research.places[placeKey(job, destination)]?.facts ?? [] : [];
}

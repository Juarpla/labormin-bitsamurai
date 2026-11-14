import { decodeHTML } from 'entities';
import { sourceText } from './job-policy.mjs';
import { departments } from './peru-regions.mjs';

const plain = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const regionByName = new Map(departments.map(region => [plain(region), region]));
const regionPattern = [...regionByName.keys()].join('|');
const workRegion = new RegExp(
  `\\b(?:trabaj(?:o|ar)|laborar|practicas?|puesto|sede|unidad minera)(?:\\s+(?:presencial(?:es)?|bajo regimen minero|se (?:realiza|desarrolla)|ubicad[ao]))*\\s+en\\s+(?:el departamento de\\s+)?(${regionPattern})\\b`, 'g',
);

export function jobWorksite(job) {
  const text = decodeHTML(sourceText(job.description)).replace(/\s+/g, ' ');
  // Prefer affirmative wording about where the work takes place. Do not
  // treat a negated placement or a residence requirement as the worksite.
  const normalized = plain(text);
  const sourceRegions = new Set([...normalized.matchAll(workRegion)]
    .filter(match => !/\b(?:no|sin)\s+(?:[a-z]+\s+){0,2}$/.test(normalized.slice(Math.max(0, match.index - 40), match.index)))
    .map(match => regionByName.get(match[1])));
  const region = job.country === 'PE' && !job.remote && sourceRegions.size === 1 ? [...sourceRegions][0] : undefined;
  const directoryText = plain(`${job.city ?? ''} ${job.locationRaw ?? ''}`);
  const directoryRegions = departments.filter(name => new RegExp(`\\b${plain(name)}\\b`).test(directoryText));
  const conflicting = Boolean(region && directoryRegions.length && !directoryRegions.includes(region));
  const roster = text.match(/\b(?:r[eé]gimen|sistema)\s+(?:at[ií]pico\s+)?(?:de\s+)?(\d+\s*[x×]\s*\d+)\b/iu)?.[1];
  const mineRoster = /\br[eé]gimen minero\b/i.test(text);
  return { region, conflicting, roster, mineRoster };
}

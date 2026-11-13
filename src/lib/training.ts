import type { CatalogEntry, Training } from './catalog-data';
import { departments } from './education';
import { searchText } from './pagination';

export const modeLabels = { virtual: 'Virtual', presencial: 'Presencial', consultar: 'Modalidad por confirmar' };
export function trainingDepartment(department: string, location: string) {
  if (departments.includes(department)) return department;
  return location.split('·').map(part => part.trim()).findLast(part => departments.includes(part)) ?? '';
}

export function trainingPlace(center: Training, allowCity = true) {
  if (center.mode === 'virtual') return;
  const parts = center.location.split('·').map(part => part.trim());
  const department = trainingDepartment(center.department, center.location);
  const city = allowCity && parts.length > 1 && !/^UGEL\b/i.test(parts[0]) && parts[0] !== department ? parts[0] : '';
  const label = [city, department].filter(Boolean).join(' · ');
  return label ? { kind: city ? 'city' as const : 'region' as const, label } : undefined;
}

export function trainingDirectory(centers: CatalogEntry<'training'>[], programs: CatalogEntry<'programs'>[]) {
  const centersById = new Map(centers.map(center => [center.slug, center]));
  const hasPrograms = new Set(programs.map(program => program.metadata.center));
  const rows = programs.flatMap(({ slug, metadata }) => {
    const center = centersById.get(metadata.center);
    if (!center) return [];
    const { name, type } = center.metadata;
    const department = trainingDepartment('', metadata.location ?? '') || trainingDepartment(center.metadata.department, center.metadata.location);
    const location = metadata.mode === 'virtual' ? 'Virtual · desde Perú' : metadata.location ?? (type === 'certificado' ? department || center.metadata.location : center.metadata.location);
    return [{
      slug, center: center.slug, name, type, department, location, isProgram: true,
      title: metadata.title, mode: metadata.mode, costKind: metadata.costKind,
      costLabel: metadata.costLabel ?? 'Precio por consultar', costNote: metadata.costNote,
      priority: metadata.priority, indexable: metadata.indexable,
      search: searchText(`${metadata.search} ${name} ${location} ${center.slug.replaceAll('-', ' ')}`),
    }];
  });
  for (const { slug, metadata } of centers) {
    if (hasPrograms.has(slug)) continue;
    const { name, type, location, mode, costKind, costLabel } = metadata;
    const department = trainingDepartment(metadata.department, location);
    rows.push({
      slug, center: slug, name, type, department, location: department || location, mode: mode === 'virtual' ? mode : 'consultar', costKind, costLabel,
      costNote: undefined, isProgram: false, title: name, priority: 3, indexable: false, search: metadata.search,
    });
  }
  const collator = new Intl.Collator('es-PE');
  return rows.sort((a, b) => Number(b.indexable) - Number(a.indexable) || a.priority - b.priority ||
    collator.compare(a.title, b.title) || collator.compare(a.name, b.name) || a.slug.localeCompare(b.slug));
}

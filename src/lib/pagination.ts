export const PAGE_SIZE = 12;

export function paginate<T>(items: readonly T[], url: URL, size = PAGE_SIZE, key = 'pagina', focusIndex = -1) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const value = url.searchParams.get(key) ?? '';
  const requested = /^\d+$/.test(value) ? Number(value) : focusIndex < 0 ? 1 : Math.floor(focusIndex / size) + 1;
  const page = Math.min(pages, Math.max(1, requested));
  const offset = (page - 1) * size;
  return { items: items.slice(offset, offset + size), page, pages, total, first: total ? offset + 1 : 0, last: Math.min(offset + size, total) };
}

export function resultRange(page: { first: number; last: number; total: number }) {
  return page.total ? `${page.first}–${page.last} de ${page.total}` : '0';
}

export function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

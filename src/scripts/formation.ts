const filterDetails = document.querySelector<HTMLDetailsElement>('#training-filter-details');
if (filterDetails) {
  const desktop = matchMedia('(min-width: 701px)');
  filterDetails.open = desktop.matches;
  desktop.addEventListener('change', ({ matches }) => { filterDetails.open = matches; });
}

const id = location.hash.slice(1);
if (/^[a-z0-9-]{1,120}$/.test(id) && id !== 'resultados' && !location.search.includes('opcion=')) {
  // Fragments never reach the server. Resolve old links through the same
  // validated redirect as ?opcion=, including centers outside page one.
  location.replace(`/formacion/?opcion=${encodeURIComponent(id)}`);
}

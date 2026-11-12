const filterDetails = document.querySelector<HTMLDetailsElement>('#training-filter-details');
if (filterDetails) {
  const desktop = matchMedia('(min-width: 701px)');
  filterDetails.open = desktop.matches;
  desktop.addEventListener('change', ({ matches }) => { filterDetails.open = matches; });
}

const id = location.hash.slice(1);
if (/^[a-z0-9-]+$/i.test(id) && id !== 'resultados') {
  const card = document.getElementById(id);
  if (card?.hasAttribute('data-training-row')) {
    card.querySelector('details')!.open = true;
    card.scrollIntoView();
  } else {
    const url = new URL(location.href);
    if (!url.searchParams.has('opcion')) {
      url.search = '';
      url.searchParams.set('opcion', id);
      location.replace(url);
    }
  }
}

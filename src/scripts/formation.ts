const form = document.querySelector<HTMLFormElement>('#formation-filters');
if (form) {
  const department = form.querySelector<HTMLSelectElement>('#training-department')!;
  const mode = form.querySelector<HTMLSelectElement>('#training-mode')!;
  const cost = form.querySelector<HTMLSelectElement>('#training-cost')!;
  const query = form.querySelector<HTMLInputElement>('#training-query')!;
  const remote = form.querySelector<HTMLInputElement>('#training-remote')!;
  const goals = [...document.querySelectorAll<HTMLAnchorElement>('.formation-goal')];
  const rows = [...document.querySelectorAll<HTMLElement>('[data-training-row]')];
  const empty = document.querySelector<HTMLElement>('#formation-empty')!;
  const count = document.querySelector<HTMLElement>('#formation-count')!;
  const filterDetails = form.querySelector<HTMLDetailsElement>('#training-filter-details')!;
  const filterFeedback = form.querySelector<HTMLElement>('#formation-filter-feedback')!;
  const desktop = window.matchMedia('(min-width: 701px)');
  filterDetails.open = desktop.matches;
  desktop.addEventListener('change', event => { filterDetails.open = event.matches; });
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  let type = '';

  function readUrl() {
    const params = new URLSearchParams(location.search);
    type = goals.some(goal => goal.dataset.type === params.get('tipo')) ? params.get('tipo')! : '';
    for (const [control,key] of [[department,'departamento'],[mode,'modalidad'],[cost,'costo']] as const) {
      const value = params.get(key) || '';
      control.value = [...control.options].some(option => option.value === value) ? value : '';
    }
    query.value = params.get('q') || '';
    remote.checked = params.get('virtual') !== '0';
  }

  function filter(updateUrl = true, push = false) {
    const words = normalize(query.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const row of rows) {
      const matchesDepartment = !department.value || row.dataset.department === department.value || (remote.checked && row.dataset.mode === 'virtual');
      const matches = (!type || row.dataset.type === type) && matchesDepartment && (!mode.value || row.dataset.mode === mode.value) && (!cost.value || row.dataset.cost === cost.value) && words.every(word => normalize(row.dataset.search || '').includes(word));
      row.hidden = !matches;
      if (matches) visible++;
    }
    goals.forEach(goal => {
      if (goal.dataset.type === type) goal.setAttribute('aria-current','true');
      else goal.removeAttribute('aria-current');
    });
    empty.hidden = visible !== 0;
    count.textContent = `${visible} ${visible === 1 ? 'opción' : 'opciones'} de ${rows.length}`;
    const activeFilters = [department.value, mode.value ? mode.selectedOptions[0].text : '', cost.value ? cost.selectedOptions[0].text : '', !remote.checked ? 'Sin virtuales de otras regiones' : ''].filter(Boolean);
    filterFeedback.textContent = `${activeFilters.join(' · ') || 'Sin filtros adicionales'} · ${visible} ${visible === 1 ? 'opción' : 'opciones'}`;
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [key,value] of [['tipo',type],['departamento',department.value],['modalidad',mode.value],['costo',cost.value],['q',query.value.trim()],['virtual',remote.checked ? '' : '0']]) {
        if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
      }
      history[push ? 'pushState' : 'replaceState'](null,'',url);
    }
  }

  goals.forEach(goal => goal.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    type = goal.dataset.type!;
    filter(true,true);
  }));
  document.querySelector<HTMLAnchorElement>('[data-all]')!.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); type = ''; filter(true,true);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button => button.addEventListener('click', () => {
    const wasEmpty = !empty.hidden;
    form.reset(); type = ''; filter(true,true);
    // Do not leave keyboard focus in the empty panel after hiding it.
    if (wasEmpty) document.querySelector<HTMLElement>('#resultados')!.focus({preventScroll:true});
  }));
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('change', () => filter(true,true));
  query.addEventListener('input', () => filter());
  window.addEventListener('popstate', () => { readUrl(); filter(false); });
  readUrl(); filter(false); form.hidden = false;
}

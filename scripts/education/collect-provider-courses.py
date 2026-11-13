"""Refresh the provider catalogue snapshot from public course directories."""

import concurrent.futures
import html
import json
import re
import unicodedata
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
AT = datetime.now(ZoneInfo('America/Lima')).date().isoformat()
CAPACITA = 'https://capacitacionlaboral.trabajo.gob.pe'
JOVENES = 'https://comunidad.jovenesproductivos.gob.pe/capacitacion_laboral/'
PROMAE = 'https://www.promaecomas.edu.pe/'
JULIACA = 'https://cetprohzgj.edu.pe'
JCM = 'https://iesjcm.edu.pe/newsites/index.php/'
NARCISO = 'https://iesnarcisovillanuevamanzo.edu.pe/'
CHAL = 'https://iestpchalhuahuacho.edu.pe/'


def get(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode('utf-8')


def slug(text):
    plain = ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', plain.lower()).strip('-')


def plain(text):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', '', text)).split())


def row(center, title, url, label, key=None, **facts):
    return dict(center=center, slug=key or slug(title), title=title,
                source=dict(label=label, url=url, verifiedAt=AT), **facts)


def capacita(page):
    url = f'{CAPACITA}/page/{page}/?pagename=cursos' if page > 1 else f'{CAPACITA}/cursos/'
    data = get(url)
    cards = re.findall(r'class="item-curso"(.*?)(?=class="item-curso"|class=["\'](?:wp-pagenavi|pagination)|$)', data, re.S)
    if not cards:
        raise ValueError(f'No se encontraron cursos en {url}')
    for card in cards:
        link, title = re.search(r'<a href="(https://[^"/]+/cursos/[^"/]+/)">\s*<h3 class="titulo">([^<]+)</h3>', card).groups()
        credential = re.search(r'</p>\s*Certifica\s+([^<]+)', card)
        duration = re.search(r'class="tiempo">([^<]+)', card)
        facts = dict(mode='virtual', cost=dict(kind='gratuito', label='Curso y certificado gratuitos'))
        if credential:
            facts['credential'] = 'Certifica ' + plain(credential[1]) + ', según el catálogo.'
        if duration and plain(duration[1]):
            facts['duration'] = plain(duration[1])
        yield row('capacita-t', plain(title), link, 'Ficha del curso en CAPACÍTA-T', link.rstrip('/').split('/')[-1], **facts)


def provider_rows():
    first = get(f'{CAPACITA}/cursos/')
    pages = int(re.search(r"class='pages'>Page \d+ of (\d+)<", first)[1])
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for batch in pool.map(lambda page: list(capacita(page)), range(1, pages + 1)):
            yield from batch

    jovenes = get(JOVENES)
    options = re.search(r'Cursos disponibles:.*?<ul[^>]*>(.*?)</ul>', jovenes, re.S)[1]
    for option in re.findall(r'<li[^>]*>(.*?)</li>', options, re.S):
        for title in re.split(r'\.(?=[A-ZÁÉÍÓÚ])', plain(option).rstrip('.')):
            yield row('jovenes-productivos', title, JOVENES, 'Oferta virtual de Jóvenes Productivos',
                      mode='virtual', cost=dict(kind='gratuito', label='Capacitación virtual gratuita'),
                      action=dict(label='Consultar el aula virtual', url='https://aulavirtual.jovenesproductivos.gob.pe/'))

    promae = get(PROMAE)
    for group in ('programas', 'ocupacional', 'continua'):
        for item in json.loads(re.search(fr'const {group} = (\[.*?\]);', promae)[1]):
            title = item['name']
            key = slug(title) + ('-formacion-continua' if group == 'continua' else '')
            if group == 'continua':
                title += ' · Formación continua'
            summary = {'programas': 'Programa de nivel auxiliar técnico incluido en la oferta del centro.',
                       'ocupacional': 'Opción ocupacional publicada por el centro.',
                       'continua': 'Curso de formación continua publicado por el centro.'}[group]
            yield row('promae-comas', title, PROMAE + '#programas', 'Oferta del CETPRO PROMAE Comas', key, mode='presencial', summary=summary)

    urls = sorted(set(re.findall(r'href="(/carreras/[a-z0-9-]+)"', get(f'{JULIACA}/carreras'))))
    for url in urls:
        detail = get(JULIACA + url)
        title = plain(re.search(r'<h1[^>]*>(.*?)</h1>', detail, re.S)[1])
        yield row('cetpro-juliaca', title, JULIACA + url, 'Oferta del CETPRO Horacio Zeballos Gámez', url.split('/')[-1],
                  mode='presencial', cost=dict(kind='parcial', label='Sin pensiones · mantenimiento por confirmar'),
                  duration='1 año según el centro', action=dict(label='Consultar admisión', url=JULIACA + '/admision'))

    careers = {
        'arquitectura-de-plataformas-y-servicios-de-tecnologias-de-informacion': 'Arquitectura de Plataformas y Servicios de Tecnologías de Información',
        'asistencia-administrativa': 'Asistencia Administrativa', 'contabilidad': 'Contabilidad',
        'construccion-civil': 'Construcción Civil', 'electronica-industrial': 'Electrónica Industrial',
        'enfermeria-tecnica': 'Enfermería Técnica', 'laboratorio-clinico-y-anatomia-patologica': 'Laboratorio Clínico y Anatomía Patológica',
        'mecanica-de-produccion-industrial': 'Mecánica de Producción Industrial', 'mecatronica-automotriz': 'Mecatrónica Automotriz',
        'produccion-agropecuaria': 'Producción Agropecuaria',
    }
    jcm = get(JCM + 'electronica-industrial/')
    for key, title in careers.items():
        if JCM + key + '/' not in jcm:
            raise ValueError(f'El IES ya no enlaza a {key} en su menú de programas.')
        yield row('jose-carlos-mariategui', title, JCM + key + '/', 'Programa publicado por el IES José Carlos Mariátegui', key)

    if 'Producción Agropecuaria' in get(NARCISO):
        yield row('narciso-villanueva', 'Producción Agropecuaria', NARCISO, 'Programas publicados por el IESTP Narciso Villanueva Manzo',
                  duration='3 años según el instituto')

    yield row('chalhuahuacho', 'Gestión Administrativa', CHAL + 'gestion-administrativa/', 'Programa publicado por el IESTP Chalhuahuacho',
              mode='presencial', duration='3 años · 6 ciclos', action=dict(label='Consultar la próxima admisión', url=CHAL + 'admision/'))
    yield row('chalhuahuacho', 'Mecánica de Producción Industrial', CHAL + 'admision/', 'Oferta de admisión 2026-I del IESTP Chalhuahuacho',
              availability='Programa incluido en la admisión 2026-I. Confirma si volverá a ofrecerse.',
              cost=dict(kind='parcial', label='S/ 180 por el examen 2026-I', detail='Importe histórico. Consulta el próximo tarifario.'))


rows = {(record['center'], record['slug']): record for record in provider_rows()}
out = ROOT / 'training-provider-courses.json'
out.write_text('[\n' + ',\n'.join(json.dumps(rows[key], ensure_ascii=False, separators=(',', ':'))
                                 for key in sorted(rows)) + '\n]\n', encoding='utf-8')
print(f'{len(rows)} programas en {out.name}.')

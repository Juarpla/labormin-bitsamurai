# -*- coding: utf-8 -*-
"""Genera registros nuevos para src/data/education.json desde:
   1) Diccionario de carreras del MTPE (API micarrera) — carreras mineras
   2) PDFs «CETPROS por región» del MINEDU — CETPROs de regiones mineras
"""
"""Genera los registros de src/data/education.json desde:
   1) Diccionario de carreras del MTPE (API de micarrera.trabajo.gob.pe)
   2) work/cetpros-parsed.json (salida de parse-cetpros.py)
Conserva los7 registros originales de la guía y reescribe el resto.

Uso (desde la raíz del repo):
    python3 scripts/education/generate-records.py [--write]
"""
import json, re, unicodedata, urllib.request, urllib.parse, sys
from pathlib import Path

WORK = Path(__file__).resolve().parent / 'work'
REPO = Path(__file__).resolve().parents[2]
WORK.mkdir(parents=True, exist_ok=True)

TODAY = '2026-11-09'
CAREER_ORDER = [490, 502, 329, 109, 207, 349, 184, 328]

def fetch_detalle(cid):
    path = WORK / f'detalle-{cid}.json'
    if not path.exists():
        url = f'https://portal.trabajo.gob.pe/micarreraback/api/diccionario-carreras/{cid}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0', 'Origin': 'https://micarrera.trabajo.gob.pe',
            'Referer': 'https://micarrera.trabajo.gob.pe/', 'Accept': 'application/json'})
        path.write_text(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'), encoding='utf-8')
    return json.loads(path.read_text(encoding='utf-8'))['data']
SKIP_ENTITIES = {'NARCISO VILLANUEVA MANZO', 'CHALHUAHUACHO'}
ACRONYMS = {'CETPRO', 'UGEL', 'BIRF', 'INA', 'CEO', 'CEFOP', 'IB', 'FAP', 'IV'}
CONNECTIVES = {'DE','DEL','LA','LAS','EL','LOS','Y','EN','CON','A','AL','E','POR','SOBRE','SAN'}

def title_case(text):
    out = []
    for i, token in enumerate(text.split()):
        if token in ACRONYMS or any(ch in token for ch in '"()') or any(ch.isdigit() for ch in token):
            out.append(token)
        elif token.upper() in CONNECTIVES:
            out.append(token.capitalize() if i == 0 else token.lower())
        elif '-' in token and token.isupper():
            out.append('-'.join(p.capitalize() for p in token.split('-')))
        elif token.isupper():
            out.append(token.capitalize())
        else:
            out.append(token)
    return ' '.join(out)

def maps_url(name, location):
    """Ubicación en Google Maps: se usa como «Oferta del centro» cuando la
    fuente no publica una página web con la oferta formativa."""
    query = urllib.parse.quote(f"{name}, {location.replace(' · ', ', ')}, Perú")
    return f'https://www.google.com/maps/search/?api=1&query={query}'

def slug(text):
    s = unicodedata.normalize('NFD', text)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s

# ---------- 1) Diccionario MTPE ----------
entities = {}
for cid in CAREER_ORDER:
    d = fetch_detalle(cid)
    for e in d.get('entidadesFormacion') or []:
        if e['institucionNombre'] in SKIP_ENTITIES: continue
        if e['id'] not in entities:
            entities[e['id']] = {'e': e, 'careers': [], 'durations': []}
        entities[e['id']]['careers'].append(d['carreraNombre'])
        entities[e['id']]['durations'].append(d.get('duracion') or '')

diccionario_records = []
for eid, v in entities.items():
    e = v['e']
    careers = [title_case(c) for c in v['careers']]
    ubic = [p.strip() for p in (e.get('ubicacion') or '').split('/') if p.strip()]
    dept = ubic[0] if ubic else ''
    parts = []
    for p in reversed(ubic):  # distrito, provincia, departamento (dedupe consecutivo)
        if not parts or parts[-1].lower() != p.lower():
            parts.append(p)
    location = ' · '.join(parts)
    durs = [d for d in v['durations'] if d]
    dur = durs[0] if durs else ''
    duration = (f"{dur}, según el Diccionario de carreras del MTPE." if dur
                else 'No publicada en la fuente: confirma la duración con la institución.')
    web = e.get('paginaWeb')
    official = f'https://micarrera.trabajo.gob.pe/entidades-formacion/{eid}'
    diccionario_records.append({
        'id': slug(title_case(e['institucionNombre'])),
        'group': 'carreras',
        'name': title_case(e['institucionNombre']),
        'location': location,
        'program': ' · '.join(careers) + ', según el Diccionario de carreras del MTPE.',
        'cost': 'La fuente no publica aranceles: solicita el tarifario vigente a la institución.',
        'duration': duration,
        'credential': 'La fuente no publica la credencial: confirma el título exacto que otorga el programa.',
        'admission': 'La fuente no publica requisitos de acceso: consulta el proceso de admisión con la institución.',
        'status': 'El Diccionario de carreras del MTPE no publica convocatoria ni aranceles: confirma admisión y costos con la institución.',
        'officialUrl': official,
        'actionUrl': web if (web and web != 'S/D') else maps_url(title_case(e['institucionNombre']), location),
        'lastVerifiedAt': TODAY,
    })

# ---------- investigación de oferta (work/research/*.json) ----------
def load_research():
    merged = {}
    rdir = WORK / 'research'
    if rdir.exists():
        for path in sorted(rdir.glob('*.json')):
            data = json.loads(path.read_text(encoding='utf-8'))
            if isinstance(data, dict) and isinstance(data.get('results'), list):
                for item in data['results']:
                    if item.get('found') and item.get('courses') and item.get('sourceUrl'):
                        merged[item['id']] = item
    return merged

SOURCE_LABELS = {
    'web': 'la web del centro', 'facebook': 'su página de Facebook',
    'instagram': 'su página de Instagram', 'tiktok': 'su cuenta de TikTok',
    'youtube': 'su canal de YouTube', 'directory': 'el buscador CETPRO del MTPE (captura archivada)',
    'gobpe': 'gob.pe',
}

# ---------- 2) CETPROs (PDFs por región) ----------
cetpros = json.loads((WORK / 'cetpros-parsed.json').read_text(encoding='utf-8'))
pdf_urls = json.loads((WORK / 'pdf-urls.json').read_text(encoding='utf-8'))
INDEX_URL = 'https://www.gob.pe/institucion/minedu/informes-publicaciones/6480539-cetpros-por-region'

research_map = load_research()
print(f'registros de investigación: {len(research_map)}')
cetpro_records = []
for dept, entries in cetpros.items():
    for e in entries:
        ugel = e['ugel']
        location = f"{ugel} · {dept}" if ugel and ugel.lower() != dept.lower() else dept
        record = {
            'id': '',  # se resuelve tras tener todos
            'group': 'oficios',
            'name': e['name'],
            'location': location,
            'program': 'El listado oficial del MINEDU registra el centro sin detallar programas ni horarios.',
            'cost': 'La fuente no publica costos: consulta el arancel con el centro.',
            'duration': 'La fuente no publica la duración: confirma el programa con el centro.',
            'credential': 'La fuente no publica la credencial: confirma qué otorga el programa.',
            'admission': 'La fuente no publica requisitos ni calendario: consulta la admisión con el centro.',
            'status': 'En el listado oficial «CETPROS por región» del MINEDU (17 de febrero de 2025), V Convocatoria Mi Oportunidad Técnica. La fuente no informa de admisión abierta.',
            'officialUrl': pdf_urls[e['file']],
            'actionUrl': maps_url(e['name'], location),
            'additionalSources': [{'label': 'Índice de CETPROs por región (gob.pe)', 'url': INDEX_URL}],
            'lastVerifiedAt': TODAY,
        }
        cetpro_records.append(record)

# ---------- ids únicos ----------
repo = str(REPO)
GUIDE_ORIGINALS = {'capacita-t','jovenes-productivos','cetpro-juliaca','promae-comas',
                   'jose-carlos-mariategui','narciso-villanueva','chalhuahuacho'}
current = json.load(open(f'{repo}/src/data/education.json'))
existing = [r for r in current if r['id'] in GUIDE_ORIGINALS]
assert len(existing) == 7, f'esperaba7 originales, hay {len(existing)}'
used = {r['id'] for r in existing}

def unique_id(base):
    cid, n = base, 2
    while cid in used:
        cid, n = f'{base}-{n}', n + 1
    used.add(cid)
    return cid

for r in diccionario_records:
    r['id'] = unique_id(r['id'])
for r in cetpro_records:
    r['id'] = unique_id(f"{slug(r['name'])}-{slug(r['location'].split('·')[-1].strip())}")

# Investigación de oferta: se aplica tras asignar ids (título = cursos
# publicados; «Oferta del centro» → web que detalla la oferta, si existe).
for r in cetpro_records:
    found = research_map.get(r['id'])
    if not found:
        continue
    courses = found['courses']
    r['title'] = ' · '.join(courses[:3]) + (' …' if len(courses) > 3 else '')
    r['program'] = f"Cursos publicados: {', '.join(courses)}."
    r['actionUrl'] = found['sourceUrl']
    label = SOURCE_LABELS.get(found.get('sourceType', ''), 'una fuente pública')
    r['status'] = (r['status'] +
        f" Oferta documentada en {label} (verificada el 10 de noviembre de 2026).")
    r['lastVerifiedAt'] = '2026-11-10'

new_records = diccionario_records + cetpro_records
print(f"diccionario: {len(diccionario_records)} | cetpros: {len(cetpro_records)} | total: {len(new_records)}")
print(f"total con originales: {len(existing) + len(new_records)}")

# muestra
for r in diccionario_records[:2] + diccionario_records[20:21] + cetpro_records[:2]:
    print('---', r['id'], '|', r['name'], '|', r['location'], '|', r['program'][:70])

if '--write' in __import__('sys').argv:
    out = existing + new_records
    with open(f'{repo}/src/data/education.json', 'w') as f:
        f.write(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print('education.json escrito ✓')

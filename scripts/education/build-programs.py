"""Build the Formación snapshot from structured source records.

Run after collecting the eight MTPE responses into work/detalle-*.json with
generate-records.py. Curated program data takes precedence over directory rows.
"""

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent / 'work'
DATA = ROOT / 'src/data'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def slug(text):
    plain = ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', plain.lower()).strip('-')


def program_title(text):
    # The upstream arrays provide complete names, including their punctuation.
    text = ' '.join(text.split())
    return text[:1] + text[1:].lower() if text.isupper() else text


centers = {center['id']: center for center in read(DATA / 'education.json')}
programs = {}


def add(center, title, source, **facts):
    title = program_title(title)
    key = slug(title)
    if key:
        programs.setdefault((center, key), dict(center=center, slug=key, title=title, source=source, **facts))


for path in sorted((WORK / 'research').glob('*.json')):
    batch = read(path)
    for record in batch.get('results', []) if isinstance(batch, dict) else []:
        center = centers.get(record['id'])
        # Match the evidence retained by the current directory edition.
        if not center or not record.get('found') or center['actionUrl'] != record.get('sourceUrl'):
            continue
        host = record['sourceUrl'].split('/')[2]
        label = {'directory': 'Directorio consultado', 'web': 'Oferta publicada en la web',
                 'facebook': 'Publicación en Facebook', 'youtube': 'Publicación en YouTube',
                 'gobpe': 'Documento público'}.get(record.get('sourceType'), 'Oferta publicada')
        if host == 'web.archive.org':
            label = 'Oferta publicada (copia archivada)'
        for course in record.get('courses', []):
            add(center['id'], course, dict(label=label, url=record['sourceUrl'], verifiedAt=batch['generatedAt']))

entities = {center['officialUrl']: center for center in centers.values() if center['group'] == 'carreras'}
matched = set()
for path in sorted(WORK.glob('detalle-*.json')):
    career = read(path)['data']
    for entity in career['entidadesFormacion']:
        url = f"https://micarrera.trabajo.gob.pe/entidades-formacion/{entity['id']}"
        center = entities.get(url)
        if not center:
            continue
        matched.add(url)
        facts = {'duration': f"{career['duracion']} según el diccionario del MTPE. Confirma el plan del centro."} if career.get('duracion') else {}
        add(center['id'], career['carreraNombre'], dict(label='Ficha del centro en Mi Carrera (MTPE)', url=url,
            verifiedAt=center['lastVerifiedAt']), **facts)

missing = {url for url in entities if 'micarrera.trabajo.gob.pe/entidades-formacion/' in url} - matched
if missing:
    raise SystemExit(f'Faltan carreras del diccionario para {len(missing)} centros en work/detalle-*.json.')

for filename in ('training-provider-courses.json', 'training-reviewed.json'):
    for record in read(Path(__file__).with_name(filename)):
        if record['center'] not in centers:
            raise SystemExit(f"Centro desconocido: {record['center']}")
        key = (record['center'], record['slug'])
        programs[key] = {**programs.get(key, {}), **record}

rows = sorted(programs.values(), key=lambda row: (row['center'], row['slug']))
(DATA / 'training-programs.json').write_text('[\n' + ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':'))
    for row in rows) + '\n]\n', encoding='utf-8')
print(f'{len(rows)} programas de {len({row["center"] for row in rows})} centros con oferta documentada.')

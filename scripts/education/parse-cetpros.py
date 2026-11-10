"""Parsea los PDFs «CETPROS por región» del MINEDU y extrae nombre + UGEL de
cada centro. Descarga los PDFs a scripts/education/work/pdfs/ si faltan.

Uso (desde la raíz del repo):
    python3 -m venv scripts/education/.venv
    scripts/education/.venv/bin/pip install pdfplumber
    scripts/education/.venv/bin/python scripts/education/parse-cetpros.py
"""
import pdfplumber, re, json, urllib.request
from pathlib import Path

WORK = Path(__file__).resolve().parent / 'work'
PDF_DIR = WORK / 'pdfs'
WORK.mkdir(parents=True, exist_ok=True)
PDF_DIR.mkdir(parents=True, exist_ok=True)

PDF_URLS = {
    "amazonas": "https://cdn.www.gob.pe/uploads/document/file/7645470/6480539-convocatoria-dre-amazonas.pdf?v=1739825519",
    "ancash": "https://cdn.www.gob.pe/uploads/document/file/7645670/6480539-convocatoria-dre-ancash.pdf?v=1739826984",
    "apurimac": "https://cdn.www.gob.pe/uploads/document/file/7645671/6480539-convocatoria-dre-apurimac.pdf?v=1739827061",
    "arequipa": "https://cdn.www.gob.pe/uploads/document/file/7645686/6480539-convocatoria-dre-arequipa.pdf?v=1739827061",
    "ayacucho": "https://cdn.www.gob.pe/uploads/document/file/7645687/6480539-convocatoria-dre-ayacucho.pdf?v=1739827062",
    "cajamarca": "https://cdn.www.gob.pe/uploads/document/file/7645688/6480539-convocatoria-dre-cajamarca.pdf?v=1739827062",
    "callao": "https://cdn.www.gob.pe/uploads/document/file/7645747/6480539-convocatoria-dre-callao.pdf?v=1739827428",
    "cusco": "https://cdn.www.gob.pe/uploads/document/file/7645748/6480539-convocatoria-dre-cusco.pdf?v=1739827429",
    "huanuco": "https://cdn.www.gob.pe/uploads/document/file/7645749/6480539-convocatoria-dre-huanuco.pdf?v=1739827429",
    "huancavelica": "https://cdn.www.gob.pe/uploads/document/file/7645755/6480539-convocatoria-dre-huancavelica.pdf?v=1739827461",
    "ica": "https://cdn.www.gob.pe/uploads/document/file/7645862/6480539-convocatoria-dre-ica.pdf?v=1739827984",
    "junin": "https://cdn.www.gob.pe/uploads/document/file/7645863/6480539-convocatoria-dre-junin.pdf?v=1739827985",
    "la-libertad": "https://cdn.www.gob.pe/uploads/document/file/7645884/6480539-convocatoria-dre-la-libertad.pdf?v=1739828082",
    "lambayeque": "https://cdn.www.gob.pe/uploads/document/file/7645890/6480539-convocatoria-dre-lambayeque.pdf?v=1739828117",
    "lima-metropolitana": "https://cdn.www.gob.pe/uploads/document/file/7645905/6480539-convocatoria-dre-lima-metropolitana.pdf?v=1739828211",
    "lima-provincias": "https://cdn.www.gob.pe/uploads/document/file/7645906/6480539-convocatoria-dre-lima-provincias.pdf?v=1739828265",
    "loreto": "https://cdn.www.gob.pe/uploads/document/file/7645915/6480539-convocatoria-dre-loreto.pdf?v=1739828265",
    "moquegua": "https://cdn.www.gob.pe/uploads/document/file/7645925/6480539-convocatoria-dre-moquegua.pdf?v=1739828306",
    "pasco": "https://cdn.www.gob.pe/uploads/document/file/7645931/6480539-convocatoria-dre-pasco.pdf?v=1739828350",
    "piura": "https://cdn.www.gob.pe/uploads/document/file/7645977/6480539-convocatoria-dre-piura.pdf?v=1739828649",
    "puno": "https://cdn.www.gob.pe/uploads/document/file/7645978/6480539-convocatoria-dre-puno.pdf?v=1739828649",
    "san-martin": "https://cdn.www.gob.pe/uploads/document/file/7645994/6480539-convocatoria-dre-san-martin.pdf?v=1739828696",
    "tacna": "https://cdn.www.gob.pe/uploads/document/file/7646004/6480539-convocatoria-dre-tacna.pdf?v=1739828731",
    "tumbes": "https://cdn.www.gob.pe/uploads/document/file/7646007/6480539-convocatoria-dre-tumbes.pdf?v=1739828772",
    "ucayali": "https://cdn.www.gob.pe/uploads/document/file/7646017/6480539-convocatoria-dre-ucayali.pdf?v=1739828824"
}

def download(stem):
    path = PDF_DIR / f'{stem}.pdf'
    if not path.exists():
        req = urllib.request.Request(PDF_URLS[stem], headers={'User-Agent': 'Mozilla/5.0'})
        path.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return path

DEPT_BY_FILE = {
 'amazonas':'Amazonas','ancash':'Áncash','apurimac':'Apurímac','arequipa':'Arequipa',
 'ayacucho':'Ayacucho','cajamarca':'Cajamarca','callao':'Callao','cusco':'Cusco',
 'huanuco':'Huánuco','huancavelica':'Huancavelica','ica':'Ica','junin':'Junín',
 'la-libertad':'La Libertad','lambayeque':'Lambayeque','lima-metropolitana':'Lima',
 'lima-provincias':'Lima','loreto':'Loreto','moquegua':'Moquegua','pasco':'Pasco',
 'piura':'Piura','puno':'Puno','san-martin':'San Martín','tacna':'Tacna',
 'tumbes':'Tumbes','ucayali':'Ucayali',
}
CONNECTIVES = {'DE','DEL','LA','LAS','EL','LOS','Y','EN','CON','A','AL','E','POR','SOBRE','SAN'}
KEEP = {'CETPRO','UGEL'}

ACRONYMS = {'CETPRO', 'UGEL', 'BIRF', 'INA', 'CEO', 'CEFOP', 'IB', 'FAP', 'IV'}

def title_case(text):
    out = []
    tokens = text.split()
    for i, token in enumerate(tokens):
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

def cell_text(page, bbox):
    """Texto de celda uniendo runs partidos (hueco < 1pt) y respetando líneas."""
    words = page.crop(bbox).extract_words()
    merged = []
    for w in words:
        same_line = merged and abs(w['top'] - merged[-1]['top']) < 3
        if same_line and (w['x0'] - merged[-1]['x1']) < 1.0:
            merged[-1]['text'] += w['text']
            merged[-1]['x1'] = w['x1']
        else:
            merged.append({'text': w['text'], 'top': w['top'], 'x0': w['x0'], 'x1': w['x1']})
    lines = []
    for w in merged:
        if lines and abs(w['top'] - lines[-1][0]) < 3:
            lines[-1][1].append(w['text'])
        else:
            lines.append([w['top'], [w['text']]])
    return ' '.join(' '.join(parts) for _, parts in lines)

def clean_ugel(text):
    t = re.sub(r'\s+', ' ', text).strip()
    t = re.sub(r'^UGEL\s*', '', t, flags=re.I)
    t = re.sub(r'^\d+\s*-\s*', '', t)
    return t  # se title-cased al final

def parse_region(path):
    entries, seen = [], set()
    ugel_raw, bounds = '', None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for tbl in page.find_tables():
                for row in tbl.rows:
                    cells = [(b, cell_text(page, b) if b else '') for b in row.cells]
                    texts = [t for _, t in cells]
                    # cabecera → límites por X
                    if any(t.strip() == 'CETPRO' for t in texts) and any(t.strip() == 'UGEL' for t in texts):
                        lx = {}
                        for b, t in cells:
                            s = t.strip()
                            if s in ('UGEL', 'II.EE.', 'CETPRO') and b: lx[s] = b[0]
                        if len(lx) == 3:
                            bounds = ((lx['UGEL'] + lx['II.EE.']) / 2, (lx['II.EE.'] + lx['CETPRO']) / 2)
                        continue
                    if bounds is None: continue
                    ugel_cell = cet_cell = ''
                    for b, t in cells:
                        if not b or not t.strip(): continue
                        col = 0 if b[0] < bounds[0] else (1 if b[0] < bounds[1] else 2)
                        if col == 0: ugel_cell = (ugel_cell + ' ' + t).strip()
                        elif col == 2: cet_cell = (cet_cell + ' ' + t).strip()
                    if ugel_cell:
                        if ugel_cell.upper().startswith('UGEL'):
                            ugel_raw = clean_ugel(ugel_cell)
                        elif ugel_cell.upper() != ugel_raw.upper():
                            ugel_raw = (ugel_raw + ' ' + clean_ugel(ugel_cell)).strip()
                    if not cet_cell: continue
                    name = re.sub(r'\s+', ' ', cet_cell).strip()
                    name = re.sub(r'^\d{1,6}\s+', '', name)
                    name = re.sub(r'^[-–]\s*', '', name).strip()
                    if not name or name.isdigit(): continue
                    name = title_case(name)
                    if not name.upper().startswith('CETPRO'):
                        name = 'CETPRO ' + name
                    key = name.upper()
                    if key in seen: continue
                    seen.add(key)
                    entries.append({'name': name, 'ugel': title_case(ugel_raw)})
    return entries

result, total = {}, 0
for stem, dept in DEPT_BY_FILE.items():
    es = parse_region(str(download(stem)))
    bucket = result.setdefault(dept, [])
    seen = {e['name'].upper() for e in bucket}
    added = 0
    for e in es:
        if e['name'].upper() in seen:  # dedup entre archivos (Lima metro/provincias)
            continue
        seen.add(e['name'].upper())
        bucket.append({**e, 'file': stem})
        added += 1
    total += added
    print(f"{dept:14} +{added:<3} (archivos: {stem})")
print(f"TOTAL: {total}")
(WORK / 'cetpros-parsed.json').write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
(WORK / 'pdf-urls.json').write_text(json.dumps(PDF_URLS, indent=1), encoding='utf-8')
print(f"escrito: {WORK / 'cetpros-parsed.json'}")

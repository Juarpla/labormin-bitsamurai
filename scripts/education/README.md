# Pipeline de formación

Regenera `src/data/education.json` (directorio `/formacion`) desde fuentes
públicas. No toca la guía: los siete registros originales se conservan tal cual.

## Requisitos

- Python 3 y `pdfplumber` (solo para parsear los PDFs)
- Red: `gob.pe` (PDFs) y `portal.trabajo.gob.pe` (Diccionario de carreras)

## Pasos (desde la raíz del repo)

```bash
python3 -m venv scripts/education/.venv
scripts/education/.venv/bin/pip install pdfplumber

# 1) PDFs «CETPROS por región» del MINEDU → work/cetpros-parsed.json
scripts/education/.venv/bin/python scripts/education/parse-cetpros.py

# 2) Diccionario de carreras del MTPE + fusión → src/data/education.json
python3 scripts/education/generate-records.py           # dry-run: imprime conteos
python3 scripts/education/generate-records.py --write   # reescribe el JSON

# 3) Verificar
pnpm build && pnpm test
```

## Qué hace cada script

- **`parse-cetpros.py`** — Descarga (si faltan) los 25 PDFs de la publicación
  «CETPROS por región» a `work/pdfs/` y extrae, por columna, el nombre de cada
  CETPRO y su UGEL. Une los runs de texto partidos del PDF (hueco < 1 pt) y
  descarta las entradas que solo traen código. Salida: `work/cetpros-parsed.json`
  (con el archivo de origen por entrada; Lima tiene dos PDFs) y
  `work/pdf-urls.json`.
- **`generate-records.py`** — Consulta la API del Diccionario de carreras
  (ocho carreras mineras; caché en `work/detalle-*.json`), construye los
  registros de institutos y universidades, añade los CETPROs y reescribe
  `src/data/education.json` conservando los siete ids originales de la guía.

## Reglas

- **Nunca inventar datos**: cada registro nuevo lleva `officialUrl` y
  `lastVerifiedAt`; lo que la fuente no publica se declara «por consultar».
- `work/` y `.venv/` están en `.gitignore` (trabajo intermedio, no se commitea).
- El metadata de descubrimiento (título, departamento, modalidad, costo) se
  deriva en `src/lib/education.ts` para los registros sin entrada editorial.
- Si la publicación de gob.pe cambia, la lista de URLs vive en
  `PDF_URLS` dentro de `parse-cetpros.py`; actualízala desde la página de la
  publicación.

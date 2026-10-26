# Revisión de fiabilidad y preparación de AdSense

Revisión local: **26 de octubre de 2026**. Los hallazgos técnicos no son una
confirmación de la causa del rechazo de Google. Mejorar el sitio no garantiza
aprobación. No se reenvió la solicitud ni se creó otra cuenta.

## Implementado en el código

- [x] Modalidad remota separada de elegibilidad desde Perú. La ingestión exige
  evidencia compatible y conserva los fragmentos que fundamentan su decisión.
- [x] Visa: patrocinio ofrecido, no ofrecido, autorización previa, reubicación,
  desconocido y conflicto. Solo el ofrecimiento explícito activa la etiqueta.
- [x] Salarios con contexto de remuneración, moneda, periodo y tipo exacto,
  rango, mínimo o máximo. Cifras ambiguas se omiten; no se añade `+` por defecto.
- [x] Eliminado el recorte de 6.000 caracteres de las descripciones obtenidas.
  Los extractos se identifican; todos enlazan al original. HiringRoom ahora
  extrae las secciones del puesto y requisitos, no solo el resumen social.
- [x] Caché de detalles versionada, con plazo de siete días para textos completos.
  Las clasificaciones se recalculan; no se copian booleanos antiguos.
- [x] Reparación reproducible offline: `node scripts/repair-job-feed.mjs`
  simula; `--write` aplica. `ingest.mjs --repair`/`--prune` usan la misma ruta.
- [x] Se contrastó la copia local antigua con `origin/main` (9b6a89a, feed del
  26/10/2026). De 833 registros actuales: 725 permanecen, 104 quedan fuera por
  elegibilidad sin evidencia suficiente y 4 por contenido insuficiente. Se
  retiraron 78 señales positivas de visa y cambiaron 45 salarios normalizados.
  Son cambios de clasificación; no significan 108 ofertas cerradas ni 45
  salarios falsos. El informe `docs/JOB-FEED-REPAIR.json` conserva el detalle.
  El archivo histórico también conserva URLs de la copia local anterior.
- [x] Enlaces históricos resuelven a una explicación de retiro, con `noindex`,
  sin JobPosting ni anuncios de vacantes vigentes; fuera del sitemap.
- [x] JobSchema conserva `excerpt`. JobPosting usa la descripción obtenida,
  exige publicación respaldada y texto completo; no inventa FULL_TIME.
  Los extractos o fechas desconocidas no emiten JobPosting.
- [x] Metodología ampliada en `/about#metodologia`; contacto para correcciones.
- [x] Dos guías nuevas: formación accesible en Perú y verificación de
  remoto/visa/salario. Fuentes visibles, costos faltantes explícitos,
  credenciales diferenciadas y convocatorias cerradas identificadas.
- [x] Privacidad describe Cloudflare, publicidad, Google Fonts, correo,
  vista IA, caché y límite por IP según el código inspeccionado.
- [x] Descripción original por defecto; IA bajo demanda, badge y vuelta al
  original. Los campos largos de IA no se cortan silenciosamente.
- [x] Publicidad siempre identificada «Anuncio», fuera de grillas filtrables.
  Los nombres internos requieren un ID numérico real mediante
  `PUBLIC_ADSENSE_SLOTS`; no se envían nombres ficticios a AdSense.
- [x] Un solo cargador de AdSense en Layout. Se mantiene como método de
  verificación. ID normalizado y validado; `ads.txt` contiene el editor
  `pub-1972487168739114`. El build contiene un solo cargador y cero unidades
  con identificadores inválidos; todavía no hay unidades numéricas configuradas.
- [x] Enlace para revisar consentimiento preparado para la API de Google;
  solo aparece cuando esa API está disponible. No se agregó una segunda CMP.

## Verificado en la cuenta, solo lectura

Sesión existente de AdSense, editor `pub-1972487168739114`, el 26/10/2026:
la pantalla de inicio muestra **«Your account wasn't approved»**, un control
para confirmar políticas y **Resubmit**. El menú disponible muestra Home,
Reports y opciones deshabilitadas; no hay acceso a «Privacidad y mensajes».
No se marcó la confirmación ni se pulsó Resubmit.

El editor coincide con `public/ads.txt`. Esta coincidencia no confirma
propiedad legal, publicación de mensajes ni la configuración del despliegue.

## Pendientes en la cuenta y producción

- [ ] Confirmar el mensaje de consentimiento para Labormin y su URL de
  privacidad cuando el panel lo permita. No se pudo comprobar publicación ni
  cobertura territorial del mensaje.
- [ ] Crear/consultar las unidades de anuncio y configurar sus IDs reales como
  JSON en `PUBLIC_ADSENSE_SLOTS`; se documenta en `.env.example`. No se
  inventaron IDs. Comprobar `PUBLIC_ADSENSE_CLIENT` en el despliegue.
- [ ] Publicar los cambios revisados y comprobar las páginas públicas,
  respuestas HTTP, anuncios, sitemap y destinos de postulación.
- [ ] Validar en Resultados enriquecidos una ficha publicada que disponga de
  fecha original y descripción completa. Las fichas migradas sin fecha original o con texto incompleto y las tres
  fichas de HiringRoom sin publicación precisa no emiten marcado.
- [x] Confirmadas las cinco ejecuciones diarias recientes de `refresh-jobs.yml`,
  todas exitosas. La del 26/10 está en
  https://github.com/Juarpla/labormin-bitsamurai/actions/runs/40299311934 .
  El retraso era de esta copia local, no un fallo demostrado del cron.
- [ ] Revalidar el texto completo de registros migrados que conservan estado
  de descripción `unknown`; se identifican como extractos. Se recuperó de
  forma limitada el texto de tres ofertas de Chinalco. No se hicieron consultas
  masivas de pago ni se comprobaron todos los destinos externos.
- [ ] Confirmar datos identificativos y política de conservación del operador
  que todavía no están documentados. No se inventaron domicilio, razón social
  ni plazos generales.
- [ ] Decidir el reenvío de la solicitud tras verificar el sitio publicado.
  La falta de acceso a CMP en esta pantalla no se presenta como impedimento
  absoluto para solicitar revisión.

Mantener Labormin y los demás dominios del mismo editor en su cuenta
correspondiente. No crear otra para eludir el rechazo.

## Verificación local ejecutada

- `pnpm test`: 19 pruebas, incluidos casos reales de clasificación y regresión
  de extractos, fechas límite y caché de detalles.
- `pnpm build`: build estático y Worker correcto.
- `pnpm visual`: Chromium y WebKit en 375, 768 y 1280 px. Inspección de capturas
  en `screenshots/` y páginas editoriales en `screenshots/reliability/`.
- `pnpm verify:site`: guías/metodología/privacidad, fichas y archivo a móvil y
  escritorio, sin overflow; filtros, drawer y estados de IA simulados sin LLM.
  Estas pruebas no verifican respuestas reales de los proveedores de IA.

## Fuentes oficiales consultadas

- [JobPosting: propiedades, coherencia y ofertas caducadas](https://developers.google.com/search/docs/appearance/structured-data/job-posting?hl=es).
- [Requisitos de privacidad de AdSense](https://support.google.com/adsense/answer/1348695?hl=es).
- [CMP para EEE, Reino Unido y Suiza](https://support.google.com/adsense/answer/13554116?hl=es).
- [API de privacidad y revisión de consentimiento](https://developers.google.com/funding-choices/fc-api-docs?hl=es-419).
- [Conectar el sitio y solicitar revisión](https://support.google.com/adsense/answer/7584263?hl=es).
- [Varios sitios del mismo editor](https://support.google.com/adsense/answer/9729?hl=es).

No hay una cantidad de artículos o de ofertas que garantice admisión. La
selección editorial responde a necesidades del visitante, no a una cuota.

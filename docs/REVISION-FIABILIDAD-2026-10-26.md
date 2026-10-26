# Revisión de fiabilidad y contenido editorial — 26/10/2026

Cambios locales preparados para revisión. No se desplegó ni se reenvió AdSense.
Los defectos reproducidos no prueban por sí solos la causa del rechazo de Google.

## Base y catálogo revisado

La copia local tenía 873 ofertas y un archivo generado el 22/09. Se comprobó
GitHub antes de concluir que el cron fallaba: las cinco ejecuciones recientes
son exitosas. Se obtuvo `origin/main`, commit **9b6a89a**, cuyo feed se generó
el 26/10 a las 10:17 UTC y contiene **833 registros**. Solo había cambios de
datos respecto de la base local; no se sustituyó código remoto modificado.

[Última ejecución comprobada de actualización](https://github.com/Juarpla/labormin-bitsamurai/actions/runs/40299311934).

Se actualizó el feed, el caché de títulos y las señales operativas desde ese
commit. Se incorporó el texto actual obtenido directamente de tres anuncios
públicos de Chinalco. No se ejecutaron Apify, Adzuna ni proveedores LLM.

| Resultado sobre el catálogo de 833 | Cantidad | Interpretación |
| --- | ---: | --- |
| Activos tras reparación | 725 | Publicables con el contenido y alcance identificado |
| Retirados por elegibilidad sin respaldo suficiente | 104 | No equivale a oferta cerrada ni empresa que nunca patrocina |
| Retirados por descripción insuficiente | 4 | No se completa texto ausente |
| Señales positivas de visa retiradas | 78 | 49 exigían autorización, 16 solo reubicación y 13 no tenían información suficiente en el texto almacenado; ver informe por registro |
| Normalizaciones salariales cambiadas | 45 | Se retiraron cifras sin interpretación segura; no son 45 sueldos demostrados falsos |
| Remotos sin elegibilidad peruana confirmada | 27 | No se usa modalidad remota como prueba de país admitido |
| Registros con integridad del texto anterior desconocida | 830 | El límite antiguo impide certificar ausencia de restricciones finales |

El archivo conserva 899 URLs históricas procedentes de ambas instantáneas,
con estado de retiro y enlace original. No son 899 cierres confirmados. Las
fichas activas se eliminan del archivo por slug. Las históricas no emiten
JobPosting, llevan noindex y quedan fuera del sitemap. Noindex no protege datos.

El informe procesable es `docs/JOB-FEED-REPAIR.json`. Los contadores de
normalización incluyen metadatos nuevos, no cambios inventados en anuncios.

## Dos casos originales

### KoBold — Data Scientist (Australia)

[Fuente oficial](https://job-boards.greenhouse.io/koboldmetals/jobs/4677639005).
La página consultada el 26/10 describe trabajo remoto, pero exige autorización
en una lista que no incluye Perú. También limita el rango salarial al mercado
estadounidense y contiene un importe ambiguo. Antes: elegible por remoto y
salario normalizado de 240.000 USD con `+`. Después: fuera del catálogo
compatible con Perú, sin salario normalizado. No se corrige la cifra del empleador.

El registro almacenado estaba recortado antes de las condiciones finales.
La prueba incluye restricciones después del antiguo límite de 6.000 caracteres.

### Kinross — MEM Mechanic, Fort Knox

[Enlace de la fuente](https://jobs.kinross.com/job/Fort-Knox-MEM-Mechanic-AK/1442878200/).
El registro del feed actual contiene la condición «US work permit required».
Antes: `visaReported: true`. Después: autorización laboral exigida, sin señal
positiva de patrocinio, fuera del catálogo internacional por falta de respaldo.
La apertura directa de la fuente no pudo completarse desde las herramientas;
se distingue esta comprobación del contenido capturado por la tarea de GitHub.
No se afirma que Kinross nunca patrocine visas.

## Cambios técnicos y límites

- `src/lib/job-policy.mjs`: reglas compartidas sin red, evidencia textual,
  salario exacto/rango/mínimo/máximo y marcado condicionado a datos respaldados.
- `scripts/ingest.mjs`: contenido obtenido sin corte de 6.000 caracteres,
  extracción de requisitos/beneficios de HiringRoom, entidades HTML completas,
  caché de siete días versionada, recálculo de campos y fechas límite reales.
- `scripts/repair-job-feed.mjs`: reparación offline con simulación por defecto;
  `--write` persiste feed, archivo e informe. No confunde reparación con
  actualización de fuentes; conserva `generatedAt`.
- `src/schemas.ts` y `src/lib/jobs.ts`: el extracto se conserva, fecha de
  publicación separada de referencia, tier remoto exige evidencia compatible.
- Tarjetas, drawer y ficha: títulos traducidos con original consultable,
  fecha identificada, fuente, alcance de descripción y condiciones visibles.
- Publicidad: se conserva el editor real y el cargador único; se requiere un
  mapa de unidades numéricas reales. No se inventan IDs.
- IA: original por defecto, acceso a fuente independiente de la función,
  estados de error/límite y retorno al original. Campos largos no se recortan
  silenciosamente. No se verificó fidelidad factual de un proveedor real.

La migración no vuelve a consultar los 830 textos cuya integridad histórica se
desconoce. Se identifican como extractos; los casos internacionales sin evidencia
quedan fuera. La próxima ingestión con el nuevo código vuelve a obtener detalles
que no cumplan versión/integridad/antigüedad de caché. No se comprobó el estado
HTTP de todos los destinos externos ni se pagó por completar datos ausentes.

## Contenido y transparencia

Se añadieron una guía de formación accesible en Perú y otra de verificación de
remoto, visa y salario, con enlaces desde guías y home. La investigación base
está en `docs/FORMACION-ACCESIBLE-PERU.md`. La primera distingue costos
confirmados, faltantes, credenciales y convocatorias cerradas. No hay ranking
inventado de calidad ni promesas de contratación.

`/about#metodologia` explica operador, automatización, fuentes, selección,
etiquetas, frecuencia programada, limitaciones y contacto. `/privacy` describe
publicidad, Google Fonts, Cloudflare, correo, proveedores de IA, caché y contador
por IP a partir del código. Datos legales y plazos no documentados quedan
pendientes del propietario, sin inventarlos.

## Verificación

- `pnpm test`: regresiones de remoto, visa, salarios, descripciones largas,
  caché, expiración, marcado y configuración publicitaria.
- `pnpm build`: generación estática y Worker.
- `pnpm visual`: Chromium y WebKit, móvil/tablet/escritorio; inspección de
  capturas y corrección del capítulo Perú vacío cuando solo había tres anuncios.
- `pnpm verify:site`: lectura en móvil/escritorio, overflow, filtros y drawer;
  estados de IA simulados 200/429/500 y retorno al original sin llamar al LLM.
  Detectó y permitió corregir overflow del grid con el catálogo de 725 ofertas.
- `pnpm check:built`: comprobación de enlaces internos del build y separación
  del sitemap entre activas y retiradas. El panel operativo dejó de enlazar
  fichas que nunca fueron publicadas.

Capturas: `screenshots/` y `screenshots/reliability/` (ignoradas por Git).
Las pruebas locales y el marcado condicional no sustituyen Resultados
Enriquecidos ni la comprobación del despliegue. No se simuló una oferta publicada
con fecha inventada para obtener un resultado positivo de Google.

## Pendientes externos

En la sesión de AdSense se verificó el mismo editor de `ads.txt` y la pantalla
de cuenta rechazada. No estaba disponible «Privacidad y mensajes». No se
aceptaron políticas ni se pulsó Resubmit. Configuración de CMP, unidades reales,
datos del operador, validación de marcado en producción y publicación están
separados en `docs/ADSENSE-CHECKLIST.md`.

## Cierre de revisión visual y documental

Revisión independiente Impeccable: **ship**, limitada a las superficies y
pendientes inspeccionados. Se resolvieron avisos home, capítulo vacío,
overflow del listado y evidencia móvil de la ficha educativa. Las capturas
móviles aisladas de esa ficha ocultan temporalmente navegación fija y toolbar
de desarrollo para mostrar el bloque completo; el código del producto no se
modificó para esas tomas. Las capturas generales conservan contexto del sitio.

El documentador confirmó herencia del sistema existente y ausencia de nuevos
tokens: no se modificaron DESIGN.md ni global.css. Se observó formato histórico
de la documentación y utilidades antiguas sin token declarado; no se reparó
ese drift fuera del alcance. No se ejecutó el detector Impeccable.

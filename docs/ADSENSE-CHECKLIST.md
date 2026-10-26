# Preparación de Labormin para AdSense

Estado revisado el **26 de octubre de 2026**. No se ha reenviado la solicitud.
Estas comprobaciones no identifican por sí mismas la causa del rechazo ni
aseguran la aprobación de Google.

## Estado vigente

- [x] Contacto público confirmado por el propietario: **labormin.com@gmail.com**.
- [x] Cuatro guías propias, incluida formación gratuita/económica en Perú con
  fuentes oficiales y distinción entre curso, certificado, título y bachiller.
- [x] Las 725 fichas incluyen orientación de Labormin separada del anuncio:
  contraste de requisitos, preparación según el tipo de puesto, preguntas sobre
  sueldo/ubicación/contrato y recursos de formación. No se presenta como
  requisitos ni beneficios del empleador.
- [x] Se volvieron a consultar 33 fichas de SuccessFactors, Gupy,
  SmartRecruiters y PageUp, con descripción completa y fechas respaldadas por
  su página pública. Ahora hay **36 textos completos y 689 de integridad
  desconocida**; desconocido no significa necesariamente recortado. Los tres
  textos completos anteriores no tienen fecha original precisa.
- [x] Se mantienen los avisos de integridad desconocida y el enlace al original.
  La IA solo trabaja con el texto disponible y no completa requisitos ausentes.
- [x] La extracción de microdatos conserva secciones anidadas y restricciones
  finales, excluyendo el pie de página del portal. Computrabajo y
  SmartRecruiters conservan la integridad y fecha original cuando su respuesta
  pública las respalda. Nunca se convierten metadatos sociales en texto completo.
- [x] Auditoría reproducible sin LLM ni servicios de pago:
  `node scripts/refresh-job-details.mjs` simula y `--write` aplica. No refresca
  artificialmente la fecha del feed ni altera IDs, URLs o fechas de referencia.
  Evidencias: [JOB-DETAIL-REFRESH.json](./JOB-DETAIL-REFRESH.json).
- [x] La reparación offline posterior encuentra cero exclusiones nuevas.
  Se conservan 725 ofertas activas y 899 páginas históricas fuera del sitemap.
- [x] Solo las 33 fichas con publicación original y texto completo emiten
  JobPosting. No se inventan tipo de contrato, salario ni publicación.
- [x] Se retiran los espacios manuales de las fichas y su cargador global,
  también si en el futuro se habilita publicidad en otras secciones. Recuperar
  una descripción no equivale por sí solo a aportar contenido editorial propio.

## Consentimiento y publicidad

**La carga publicitaria está desactivada globalmente**, con
`PUBLIC_ADSENSE_ENABLED=false` y estado apagado por defecto. Se aplica tanto al
cargador como a las unidades manuales. En producción no se muestran espacios
vacíos de publicidad; en desarrollo siguen disponibles para probar el diseño.
La política de privacidad y el pie explican la pausa.

Se mantienen la etiqueta `google-adsense-account` con
`ca-pub-1972487168739114` y `public/ads.txt` con el mismo editor para verificar
el sitio **sin solicitar anuncios**. La guía de Google admite esos métodos y
permite elegir una CMP después de solicitar revisión.
[Conexión y revisión del sitio](https://support.google.com/adsense/answer/7584263?hl=es).

La cuenta existente muestra «Your account wasn't approved», confirmación de
políticas y botón Resubmit. Se volvió a comprobar la sesión: no ofrece acceso
a «Privacidad y mensajes». No se marcó la confirmación ni se pulsó Resubmit.
No se creó otra cuenta ni se publicó una CMP que no pudiera verificarse.

No se añade un banner propio para simular una CMP certificada. El pie mantiene
preparada la API `googlefc` de revocación y solo muestra el control cuando la
herramienta está disponible. Inicializar su cola no carga una CMP ni recoge
consentimiento. Los anuncios limitados tampoco equivalen a ausencia de cookies.
La investigación y las fuentes están en
[CONSENT-RESEARCH.md](./CONSENT-RESEARCH.md).

### Antes de reactivar publicidad

- [ ] Publicar una CMP certificada para el sitio, comprobar la URL de privacidad,
  idioma, proveedores y cobertura aplicable. Google exige CMP certificada para
  anuncios personalizados en EEE, Reino Unido y Suiza; Perú como público editorial
  no excluye visitas desde esos territorios.
- [ ] Probar aceptar, rechazar, persistencia y revocar en el dominio real,
  escritorio y móvil. Probar solicitudes de red, no solo el aspecto del aviso.
- [ ] Habilitar la publicidad únicamente después de esas comprobaciones.
- [ ] Para unidades manuales, configurar IDs numéricos reales en
  `PUBLIC_ADSENSE_SLOTS`. Nunca usar los nombres internos como IDs de cuenta.

La revisión del sitio y la activación de anuncios son pasos distintos. La pausa
no obliga a esperar por un panel inaccesible para solicitar revisión; evita
servir publicidad con una configuración de consentimiento no comprobada.

## Antes de volver a enviar

- [x] Revisar en móvil y escritorio las fichas con texto completo y desconocido,
  los enlaces de formación, privacidad y la navegación.
- [x] Comprobar build, pruebas y enlaces internos; meta del editor y ads.txt;
  ausencia de carga/unidades/solicitudes publicitarias durante la pausa.
- [ ] **Leer el motivo exacto del correo de rechazo.** El panel sigue mostrando
  una explicación genérica. No se atribuye automáticamente a contenido, CMP u
  otra causa no demostrada. No se accedió al correo del propietario.
- [ ] Completar datos identificativos y conservación del operador con datos
  reales cuando se definan; no inventar domicilio, razón social o plazos.
- [ ] Solicitar revisión cuando el propietario decida hacerlo, atendiendo al
  motivo específico de Google. Ninguna cantidad de artículos u ofertas, ni una
  espera fija, garantiza admisión.

## Validación de esta actualización

- `pnpm test`: 22 pruebas, con regresiones de secciones finales, contenedores
  incompletos, páginas con varios puestos y publicidad apagada por defecto.
- `pnpm build` y `pnpm check:built`: 725 fichas con orientación, 33 JobPosting,
  899 históricas excluidas, enlaces internos correctos y publicidad pausada.
- `pnpm visual`: Chromium y WebKit en 375, 768 y 1280 px; capturas en
  `screenshots/` e inspección de las superficies modificadas.
- `pnpm verify:site`: texto desconocido/completo, privacidad y guías en móvil y
  escritorio; sin overflow, filtros, drawer y estados IA con respuestas simuladas
  (no se llama a un proveedor de pago); no se permiten peticiones publicitarias.

## Historial y comprobaciones anteriores

Las versiones `9556f0b` y `5634679` publicaron mejoras editoriales, de contacto y
fiabilidad. La reparación del feed del 26/10 partió de 833 registros: permanecen
725, con 104 exclusiones por elegibilidad sin evidencia suficiente y 4 por
contenido insuficiente. No significa que esos 108 empleos estuvieran cerrados.
El informe original está en [JOB-FEED-REPAIR.json](./JOB-FEED-REPAIR.json).

Se verificaron las cinco ejecuciones diarias recientes del refresco, todas
exitosas; el retraso estaba en la copia local, no en el cron demostrado.
[Ejemplo del 26/10](https://github.com/Juarpla/labormin-bitsamurai/actions/runs/40299311934).
`www.labormin.com` no resolvía; el dominio canónico sin www funciona. El alias y
su redirección son una mejora de dominio opcional.

## Fuentes oficiales

- [Rechazo de cuenta y contenido original](https://support.google.com/adsense/answer/81904?hl=es).
- [Requisitos para participar](https://support.google.com/adsense/answer/9724?hl=es).
- [Privacidad de AdSense](https://support.google.com/adsense/answer/1348695?hl=es).
- [CMP certificada y territorios](https://support.google.com/adsense/answer/13554116?hl=es).
- [API de privacidad y revocación](https://developers.google.com/funding-choices/fc-api-docs).
- [Conectar y verificar el sitio](https://support.google.com/adsense/answer/7584263?hl=es).
- [Marcado JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting?hl=es).

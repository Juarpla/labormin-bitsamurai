# Catálogo de Labormin en Cloudflare D1

Los cinco listados renderizan en Workers. Formación, Empleos, Prácticas y Eventos
muestran hasta 12 registros por página; Guías, hasta cuatro por tema. Los filtros
se aplican al catálogo completo antes de buscar los detalles de la página.
La navegación y los formularios usan URL compartibles y funcionan sin JavaScript.

- `catalog_jobs`: vacantes y prácticas vigentes. La URL de detalle sigue siendo
  `/jobs/{slug}/` para todas. La ingestión sigue validando fuentes y elegibilidad.
- `catalog_guides`: índice y contenido de las guías editoriales; todas comparten
  `/guias/{slug}/`. Las dos guías visuales existentes conservan su componente
  editorial especial, sus anclas y sus espacios para anuncios.
- `catalog_training`: centros y plataformas. `catalog_programs` guarda los
  programas por centro y su evidencia. Cada programa usa `/formacion/{centro}/{programa}/`.
  Los centros también tienen una URL con sus programas documentados.
- `catalog_events`: fichas y fuentes documentadas.
- `catalog_ready`: habilita la lectura de cada catálogo cuando su carga termina.
  Un entorno sin carga usa la instantánea validada del repositorio. Para empleos,
  también usa esa instantánea si contiene un feed más nuevo que D1. El cron
  sigue respaldando la ingestión de las vacantes en Git.

Cada fila tiene un `slug` estable, una posición, metadatos ligeros para el
listado y el contenido completo. Los metadatos y el contenido deben actualizarse
juntos. El Worker lee D1 por el binding privado `CATALOG_DB`. El navegador no
recibe credenciales ni conecta directamente a la base. Las fichas de programa
marcadas como revisadas salen en `/sitemap-catalog.xml`, referenciado en `robots.txt`.

## Operación

- Inicializar D1 local: `node scripts/catalog/import.mjs`.
- Cargar datos en D1 remoto: `node scripts/catalog/import.mjs --remote`.
  Aplica migraciones, importa las guías, eventos y formación una sola vez, y
  actualiza el feed de empleo. Usa la sesión de Wrangler o un token dedicado.
- Para que el cron actualice D1 a diario, configura `CATALOG_D1_API_TOKEN` en
  los secretos de GitHub Actions con permiso **Account → D1 → Edit** en la
  cuenta de Labormin. La tarea actualiza solo empleo y prácticas; no sobreescribe
  las guías, la formación ni los eventos que se gestionen en D1.
- Para reimportar las vacantes publicadas, abre **01 · Actualizar vacantes**
  en GitHub Actions, elige **Run workflow** en `main` y marca **Solo sincronizar D1**.
  El modo omite la consulta de fuentes y la preparación con IA. En **Summary**
  verás si la sincronización se completó, se omitió o falló. Si se completó,
  GitHub muestra la revisión del feed y el recuento de registros que confirmó D1.
- Para agregar o actualizar una guía editorial sin tocar Astro, prepara un
  JSON con `slug`, `title`, `description`, `group` (`primer-empleo`,
  `formacion` o `evaluar`), `icon` (`credential`, `materials`, `time`,
  `map` o `remote`), `steps` (tres textos), `updatedAt` (AAAA-MM-DD) y
  `html` (artículo con fuentes). Ejecuta
  `node scripts/catalog/publish-guide.mjs /ruta/guia.json --remote`.
  Sin `--remote` solo actualiza D1 local. El HTML se sanitiza al renderizar.
- Para editar formación o eventos desde el panel de D1, consulta la fila
  existente como modelo. Conserva la fecha de verificación real y las URL
  oficiales. En eventos, sincroniza las fechas del contenido con los metadatos
  `date` y `endsOn`; en formación, actualiza `search` (minúsculas y sin
  tildes) si cambias el programa o la institución.
- Para cargar solo los programas del repositorio, ejecuta
  `node scripts/catalog/publish-training.mjs --remote`. El comando aplica
  la migración y conserva las fichas existentes, incluidas las editadas en D1.
  Para añadir o actualizar un programa, usa
  `node scripts/catalog/publish-training.mjs /ruta/programa.json --remote`.
  Toma como ejemplo una ficha de `scripts/education/training-reviewed.json`
  y conserva `center` y `slug` para que el enlace siga funcionando. Puedes
  pasar un solo programa o un arreglo. Omite `--remote` para probar en D1 local.

Verifica un despliegue con `pnpm build`, `pnpm astro preview --background` y
`node scripts/check-runtime-catalog.mjs`. Para verificar D1 en el entorno
local, importa antes de arrancar la vista previa. D1 remoto no se usa en dev
ni en la vista previa por defecto.

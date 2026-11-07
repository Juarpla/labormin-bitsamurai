# Formación — cierre de implementación

## Alcance

Nueva página `/formacion`, navegación principal y reorganización de la guía de formación. Las páginas de inicio y rutas de visa siguen existiendo. Se conservan los siete registros documentados, sus campos completos, enlaces y fechas originales. No se añaden convocatorias ni precios supuestos.

El diseño conserva la identidad de Labormin y adapta la propuesta aprobada con búsqueda por texto, modalidad, departamento y categorías de costo. Los objetivos son «Una habilidad», «Un certificado» y «Una carrera». En móvil, la búsqueda permanece visible y los filtros secundarios se despliegan con un control nativo que muestra los filtros activos y el número de resultados.

## Verificación

- Compilación de producción y comprobación de enlaces internos completadas sin errores.
- Verificación funcional previa de búsqueda sin tildes, combinaciones de filtros, resultados vacíos, limpieza, apertura de detalles, URL compartible, recarga y navegación atrás: 15 comprobaciones satisfactorias.
- Capturas de Formación y de la guía en Chromium y WebKit, a 375, 768 y 1280 píxeles; revisión de escritorio y móvil. La captura de la propuesta seleccionada usa 1487 × 1058.
- Corregidos el desbordamiento en tableta, la altura de los selectores en Safari, la llegada tardía a los resultados en móvil y el separador del último resultado visible.
- Revisión independiente final: sin bloqueos de publicación en los cambios revisados; disposición `ship`.

## Límites de la revisión

La puerta automatizada de similitud con la propuesta visual no quedó aprobada. No se certifica fidelidad numérica exacta: hay adaptaciones funcionales autorizadas y diferencias de composición. El usuario pidió cerrar las mejoras actuales sin continuar las iteraciones. Se conserva la evidencia local en `screenshots/` y `.impeccable/review/formacion/`; esas capturas y archivos temporales no forman parte del envío.

Las fuentes mantienen su fecha documental de octubre de 2026. El directorio no cubre todo el Perú ni implica admisiones abiertas; los importes parciales y los precios por consultar se identifican expresamente.

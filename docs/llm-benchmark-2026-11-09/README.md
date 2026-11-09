# Comparación práctica de proveedores LLM

Fecha: 9 de noviembre de 2026. Prueba desde el entorno local con las credenciales disponibles, sin cambios de configuración ni escritura en el feed. Se ejecutaron 36 llamadas: cuatro proveedores × tres tareas × tres casos. Dentro de cada proveedor, las llamadas fueron consecutivas; los proveedores se probaron en paralelo. La prueba anterior había consumido cuota y puede haber influido en los 429 de Mistral. La configuración de producción puede diferir.

Se usaron los modelos por defecto del repositorio, `temperature: 0`, el cuerpo HTTP y encabezados de `callProvider`, y prompts y topes de producción: títulos (120 s, sin máximo explícito), descripción (60 s, 2.000 tokens), orientación (25 s, 1.600 tokens). No se envió ningún selector de razonamiento; no es una comparación al máximo razonamiento. El código de prueba recopiló también `usage`, normalmente descartado por el cliente. Los tiempos son hasta obtener la respuesta completa y no incluyen espera previa de otro proveedor ni caché de la aplicación.

Los títulos son tres lotes de tres títulos reales, en inglés o mixtos. Son más cortos que el máximo de 20 por lote. Las descripciones proceden de `nv-BMPE-1118513543`, `nv-BMPE-1118511845` y `nv-BMPE-1118508487` de `src/data/jobs.json` (aprox. 2,6–2,9 mil caracteres): electricidad de palas, ingeniería eléctrica y perforación/voladura. Los primeros dos contextos de orientación comparten especialidad y catálogo; el tercero es voladura. `results.jsonl` contiene respuestas, errores, tiempos y uso devuelto, sin credenciales. La validación reproduce las comprobaciones relevantes de cada tarea; no es una ejecución extremo a extremo del endpoint ni comprueba fidelidad por sí misma.

## Resultados por tarea

Tiempos en segundos: mediana solo de respuestas válidas; entre paréntesis, número de respuestas disponibles. «Válido» significa que pasó JSON y validación de forma o selección, no que sea fiel. Ante timeout o error HTTP se cuenta fallo.

| Proveedor / modelo | Títulos válidos | Mediana títulos | Descripción válida | Mediana descripción | Orientación válida | Mediana orientación |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Agnes / `agnes-3.0-flash` | 3/3 | 1,16 | 3/3 | 7,12 | 3/3 | 0,84 |
| Mistral / `codestral-2508` | 1/3 | 0,95 (1) | 1/3 | 3,07 (1) | 0/3 | — |
| OpenCode Go / `mimo-v2.6-flash` | 3/3 | 2,85 | 3/3 | 15,07 | 3/3 | 5,01 |
| Workers AI / `@cf/qwen/qwen3.8-27b` | 3/3 | 13,64 | 0/3 | — | 3/3 | 6,69 |

Mistral devolvió HTTP 429 en 7 de 9 llamadas, después de dos respuestas; tanto la prueba anterior como el ritmo consecutivo pudieron influir. Esto indica comportamiento bajo esta ráfaga, no un porcentaje de disponibilidad general. Workers AI devolvió contenido vacío en dos descripciones (ambas consumieron el máximo de 2.000 tokens de salida) y agotó el plazo de 60 s en la tercera. No se conoce cuánto trabajo facturable realizó la llamada interrumpida.

## Revisión manual dirigida

Se revisaron los nueve títulos por proveedor cuando hubo respuesta, sin adjudicar una nota general de traducción. En el primer caso, Agnes produjo «Ingeniero de Cierre de Minera Ambiental», una traducción confusa de «Environmental Mine Closure Engineer»; Mistral dejó «Key Account Manager» en inglés. OpenCode y Workers tradujeron los nueve títulos de sus respuestas, aunque eso no demuestra ausencia de errores semánticos.

Para descripciones se revisaron seis puntos por empleo: (1) formación eléctrica, año de experiencia, terminaciones eléctricas, 10x10, residencia sur/deseable Arequipa, y cobertura 100 % de EPS/seguro y alimentación; (2) titulado/colegiado, tres años, experiencia en luminarias, pozos a tierra, pararrayos y régimen 21x7; (3) título técnico, tres años en interior mina, manipulación de explosivos (I), Excel avanzado (I), AutoCAD (D) y uso de EPP junto a PETS/PETAR. Agnes y OpenCode conservaron los 18 puntos revisados en las tres respuestas. En la respuesta disponible de Mistral se observaron cinco de seis de forma clara: la cobertura al 100 % para EPS quedó ambigua. Workers no devolvió una descripción evaluable. Esto no garantiza que otros datos o matices estén completos ni que las salidas sean literalmente fieles; se requieren evaluaciones humanas más amplias.

Para orientación, se comprobó el validador real: exactamente dos IDs distintos del catálogo, al menos uno técnico. Los tres casos de Agnes, OpenCode y Workers lo cumplieron; Mistral no llegó a producir una respuesta. Validez no mide utilidad editorial ni preferencia del postulante.

## Capacidad y costos

OpenCode Go devolvió `opencode.allowance` en cada respuesta. Para las tres llamadas válidas por tarea, el promedio fue: títulos USD 0,0000259133 por lote de tres; descripción USD 0,00040656; orientación USD 0,0000503933. Son unidades del cupo, no cargos adicionales por llamada. Usando solo como escenario los cupos teóricos de USD 12 por 5 h, USD 30 por semana y USD 60 por mes (20 %, 50 % y 100 % del cupo del plan), el cálculo es piso(cupo / consumo medio):

| Carga exclusiva de OpenCode Go | 5 h | Semana | Mes |
| --- | ---: | ---: | ---: |
| Lotes de tres títulos | 463.082 | 1.157.705 | 2.315.410 |
| Descripciones de este tamaño | 29.515 | 73.789 | 147.579 |
| Selecciones de orientación | 238.126 | 595.316 | 1.190.633 |

**No son llamadas garantizadas.** Cada fila supone dedicarle toda la cuota sin consumo previo, caché, entradas o salidas diferentes de esta muestra, ni otros límites; las tareas comparten cuota entre sí y con otros usos de la cuenta. Algunos ejemplos de títulos y orientación usaron caché, que puede no repetirse. Los límites temporales se solapan y el número real será menor si otro límite o el tiempo disponible domina. Los lotes de producción pueden tener hasta 20 títulos y las descripciones hasta 10.000 caracteres; estos resultados no proyectan su consumo.

En Workers AI, los tres lotes de títulos consumieron 187, 125,70 y 139,83 neuronas; las tres orientaciones, 89,66, 89,66 y 146,26. Las dos descripciones fallidas con respuesta consumieron 615,98 y 618,51 neuronas respectivamente. La asignación gratuita pública de 10.000 neuronas por día es compartida y no implica que esta cuenta la tenga intacta. Agnes ofrece actualmente una promoción gratuita anunciada y Mistral tarifa por tokens; no hay suficientes datos para convertirlos a cuotas personales de llamadas. Precios y fuentes: [investigación de proveedores](../LLM-PROVIDERS-RESEARCH.md).

## Interpretación para el respaldo

Para títulos, OpenCode es candidato principal y Workers candidato de respaldo por estos casos; Agnes fue rápido pero presentó un error de sentido. Para descripciones, OpenCode y Agnes son candidatos y ninguno demostró preservación total de todos los hechos; Workers no funcionó con el límite actual. Para orientación, Agnes fue el más rápido y pasó los tres casos, seguido por OpenCode o Workers. Mistral necesita una nueva prueba espaciada y una revisión de límites antes de descartarlo o priorizarlo: siete 429 no son prueba de mala calidad de modelo. Estas son hipótesis, no una decisión automática ni un cambio de configuración.

### Uso previsto de OpenCode Go

[La documentación oficial](https://dev.opencode.ai/docs/console/go/#where-can-i-use-it) describe Go como diseñado para OpenCode y otros agentes de programación con tráfico similar, y dice que el cliente debe enviar tráfico típico de agentes de programación. La traducción y orientación de Labormin son cargas de producto distintas; que la API haya respondido no confirma que el uso esté contemplado. Antes de depender de Go en producción, confirmar con OpenCode si este caso está permitido. Por esta razón, las estimaciones anteriores son aritméticas y no una recomendación de uso autorizado.

# Proveedores LLM: fuentes y costos

Consulta: 9 de noviembre de 2026. Los valores son públicos y pueden cambiar; no prueban disponibilidad, cuota ni rendimiento de la cuenta de Labormin. Los modelos efectivos pueden ser distintos a los predeterminados si se configuran variables de entorno.

| Proveedor / modelo predeterminado en código | Precio público | Límites y observaciones |
| --- | --- | --- |
| Agnes `agnes-3.0-flash` | Lista: USD 0,05 / millón de tokens de entrada y USD 0,15 / millón de salida; precio promocional actual USD 0 para ambos. | Promoción sujeta a cambios; no se verificaron los límites de la cuenta. Existe soporte en código pero no figura en el orden predeterminado. [Precios oficiales](https://wiki.agnes-ai.com/en/docs/pricing.md). |
| Mistral `codestral-2508` | USD 0,30 entrada y USD 0,90 salida / millón de tokens; entrada en caché USD 0,03. | Los límites dependen de la organización y modelo. La documentación describe Codestral como especializado en código, por lo que su aptitud para traducción debe medirse. [Modelo](https://docs.mistral.ai/models/codestral-25-08), [precios](https://docs.mistral.ai/inference/pricing), [límites](https://docs.mistral.ai/admin/billing-usage/usage-limits). |
| Cloudflare Workers AI `@cf/qwen/qwen3.8-27b` | USD 0,45 entrada y USD 3,20 salida / millón de tokens; entrada en caché USD 0,05. | La asignación gratuita es de 10.000 neuronas diarias compartidas; la generación de texto tiene un límite general de 300 solicitudes/minuto salvo modelos con requisitos de pago. Los costes reales dependen de los tokens de cada tarea. [Modelo](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/), [precios](https://developers.cloudflare.com/workers-ai/platform/pricing/), [límites](https://developers.cloudflare.com/workers-ai/platform/limits/). |
| OpenCode Go `mimo-v2.6-flash` | En Go: USD 0,14 entrada y USD 0,28 salida / millón de tokens, y USD 0,0028 entrada en caché, para calcular el consumo de la asignación; límite mensual equivalente a USD 60. | Go cuesta USD 10/mes. Las ventanas son 20 % de la asignación mensual por 5 horas, 50 % por semana y 100 % por mes. La estimación oficial de 30.100 / 75.200 / 150.400 llamadas supone 830 tokens de entrada, 71.500 en caché y 295 de salida por llamada; no debe trasladarse a Labormin sin medir sus tokens y caché. [Plan](https://dev.opencode.ai/go), [límites y supuestos](https://dev.opencode.ai/docs/console/go/). |

## Límites de la comparación

Los precios por token, las neuronas gratuitas y la asignación de una suscripción no son cuotas directamente comparables. Para calcular llamadas posibles se necesita medir tokens de entrada, salida y caché por caso y conocer el plan y consumo existentes. Los modelos y planes efectivos de producción deben confirmarse en la configuración de Cloudflare/GitHub, sin divulgar secretos. Un resultado válido en JSON no demuestra fidelidad al original ni preservación de requisitos.

Cloudflare anunció que varios modelos dejarán de responder el 20 de noviembre de 2026; `@cf/qwen/qwen3.8-27b` figura entre los reemplazos recomendados. [Anuncio oficial](https://developers.cloudflare.com/changelog/product/workers-ai/).

## Prueba exploratoria de traducción de títulos

El 9 de noviembre de 2026 se invocó `callProvider` directamente con las credenciales y modelos predeterminados locales, sin cambiar la configuración. Se usó el prompt real de ingestión y su validación de JSON y longitud de arreglo. Cada proveedor recibió tres llamadas consecutivas con el mismo lote de 20 títulos públicos de `jobs.json` (una mezcla de español e inglés); proveedores diferentes se probaron en paralelo. Tiempos de pared, no rendimiento sostenido. Esta mezcla es una prueba de instrucciones, no una reproducción exacta de la selección de títulos del ingest. No se activaron ajustes de razonamiento adicionales.

| Proveedor / modelo | JSON con forma válida | Mediana de respuestas válidas | Observaciones |
| --- | ---: | ---: | --- |
| OpenCode Go / `mimo-v2.6-flash` | 3/3 | 3,0 s | Tradujo los títulos totalmente en inglés observados. |
| Mistral / `codestral-2508` | 2/3 | 1,85 s | La tercera llamada recibió HTTP 429; dejó expresiones inglesas en títulos mixtos. |
| Agnes / `agnes-3.0-flash` | 3/3 | 3,2 s | En una respuesta dejó sin traducir un título totalmente inglés; también dejó expresiones inglesas en títulos mixtos. |

En otra prueba con los mismos prompts y tres títulos seleccionados en inglés, Agnes y OpenCode tuvieron 3/3 respuestas válidas y Mistral 2/3, con otro 429. La muestra es pequeña y no establece disponibilidad sostenida, fidelidad semántica, cuotas ni orden óptimo para descripciones y orientación. Las respuestas pueden incurrir en costos y se probaron con la configuración local, que puede diferir de producción.

Workers AI / `@cf/qwen/qwen3.8-27b` completó una llamada válida en 91,9 s y tradujo los títulos en inglés observados; se interrumpió la segunda y no se inició la tercera. Esa única medición supera el timeout de 60 s usado en la API interactiva (aunque es inferior al de 120 s para títulos), por lo que no permite calcular mediana ni tasa de éxito de tres intentos.

La documentación de OpenCode Go indica que está diseñado para OpenCode y otros agentes de programación que generen tráfico similar, y que el cliente debe enviar tráfico típico de agentes de programación. Las tareas de traducción y orientación de Labormin son diferentes; conviene confirmar directamente con el proveedor si están cubiertas antes de depender de Go en producción. [Uso previsto](https://dev.opencode.ai/docs/console/go/#where-can-i-use-it).

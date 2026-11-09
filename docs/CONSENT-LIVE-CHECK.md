# Consentimiento: comprobación en producción

Revisión del 26 de octubre de 2026 en https://labormin.com.
Código publicado: `5649d50`; build de Cloudflare
`cde6d10b-7a47-4ace-aa25-22957cd8913d`.

## Resultado

**Pendiente de validar: no activar publicidad.** El panel confirma el mensaje
publicado, pero la prueba real no consiguió cargar su API ni mostrar el aviso.
No se pudieron probar aceptar, rechazar, persistencia o revocación. Publicado
en el panel no equivale a consentimiento funcionando en el dominio.

## Configuración corregida y publicada en AdSense

- Español predeterminado, conservando los idiomas adicionales.
- URL de privacidad: https://labormin.com/privacy/ (antes apuntaba a la portada).
- «No consentir» habilitado en todas las regiones del mensaje.
- Optimización entre mensaje estándar/limitado desactivada para comprobar
  una variante estable con tres opciones visibles.
- Sin cambios en el mensaje de goatlab.win ni en ajustes globales de cuenta.

## Evidencia observada

| Comprobación | Resultado |
| --- | --- |
| Portada y privacidad | HTTP 200, sin cargador AdSense |
| Página de prueba antes de pulsar | Sin solicitudes a Google Ads |
| Página de prueba | HTTP 200, noindex, excluida del sitemap |
| Chromium limpio, escritorio | Carga dos scripts AdSense; no aparece la CMP |
| WebKit limpio, móvil | Carga dos scripts AdSense; no aparece la CMP |
| Brave del propietario | No se confirma la API de consentimiento tras iniciar |
| Peticiones observadas tras iniciar | Solo `adsbygoogle.js` y `show_ads_impl*.js`; sin peticiones de anuncios ni Funding Choices |
| Decisiones y persistencia | No comprobables sin mensaje real |

La ruta fija `pauseAdRequests=1` antes de cargar la etiqueta oficial y nunca
reanuda solicitudes. Google puede crear un elemento `ins` automáticamente;
eso no demuestra una petición ni un anuncio servido. No se añadieron unidades
propias. No se pulsó ningún anuncio ni se habilitó el interruptor global.

## Límite de la prueba y siguiente comprobación

El editor advierte que la publicación puede tardar hasta una hora en mostrarse.
La evidencia actual no distingue propagación, comportamiento de la etiqueta
pausada o estado de la cuenta. No se atribuye la ausencia a un rechazo ni a un
bloqueador: también se reprodujo en navegadores limpios sin extensiones.

Repetir la carga del mensaje tras la propagación. Si sigue sin aparecer,
revisar el despliegue de la CMP manteniendo bloqueadas las solicitudes, sin
activar anuncios para intentar resolverlo. Cuando aparezca, probar las tres
opciones, persistencia sin parámetros de depuración y revocación, y comprobar
las peticiones reales antes de habilitar monetización.

Fuentes:
[API y depuración del mensaje](https://developers.google.com/funding-choices/fc-api-docs),
[pausar solicitudes publicitarias](https://support.google.com/adsense/answer/7670312?hl=en),
[diagnóstico del despliegue](https://support.google.com/adsense/answer/14660912?hl=en).

Validación del código: build y pruebas existentes correctos; comprobación de
enlaces y sitemap correcta; `pnpm visual` e inspección de capturas en Chromium
y WebKit a 375, 768 y 1280 px; carga explícita y error de red comprobados.

## Segunda comprobación — 26 de octubre, 19:20–19:22 (Lima)

**El aviso sigue sin aparecer; no activar publicidad.** Se repitió la prueba
contra el dominio publicado con sesiones nuevas, sin cookies ni extensiones:

| Sesión | Resultado |
| --- | --- |
| Chromium, escritorio 1280 px, `fc=alwaysshow&fctype=gdpr` | Sin aviso ni API de consentimiento |
| WebKit, móvil 375 px, mismos parámetros | Sin aviso ni API de consentimiento |
| Chromium, escritorio, sin parámetros | Sin aviso ni API de consentimiento |
| Brave del propietario, recargando la prueba | Mismo mensaje de carga no confirmada |

En las tres sesiones limpias, la portada y la página de prueba antes de pulsar
no enviaron solicitudes a servicios publicitarios de Google. Después de pulsar
se cargaron únicamente `adsbygoogle.js` y `show_ads_impl*.js`, sin solicitudes a
`/pagead/ads`, `/pagead/adview` o `/gampad/ads`, sin peticiones a Funding Choices,
sin errores de carga y sin cookies creadas en esas sesiones. Tras el plazo de
20 segundos, `__tcfapi` y `googlefc.showRevocationMessage` seguían ausentes.

Aceptar, rechazar, recordar la decisión y cambiarla **siguen sin poder
comprobarse** porque no se mostró la interfaz real. No se sustituyó por un aviso
simulado ni se reanudaron solicitudes. `PUBLIC_ADSENSE_ENABLED` continúa en
`false`; no se cambió la configuración del sitio ni de la cuenta.

El panel confirma el mensaje de Labormin publicado, en español. En Sitios,
Labormin figura como **Getting ready**, con **Review requested** el 26 de
octubre a las 18:21. También muestra ads.txt como **Not found**; la comprobación
HTTP directa devuelve 200, texto plano y el editor correcto
`pub-1972487168739114`. Es una discrepancia con el panel, no un archivo ausente
en la web en esta prueba. No se atribuye a estos estados la causa del fallo de
la CMP sin evidencia adicional. No se solicitó otra revisión.

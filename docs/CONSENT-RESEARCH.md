# Consentimiento publicitario: revisión para Labormin

Investigación del **26 de octubre de 2026**. Fuentes primarias de Google y
Cloudflare; revisión del código al comenzar esta tarea. Este documento distingue
las reglas del producto, las observaciones y las recomendaciones técnicas. No
certifica cumplimiento legal integral ni identifica la causa del rechazo.

## Decisión recomendada antes del reenvío

**Mantener desactivada la carga publicitaria hasta publicar y comprobar una CMP,
y verificar el editor mediante la etiqueta meta y `ads.txt`.** Es una decisión
técnica conservadora: permite preparar el sitio sin solicitar anuncios ni
presentar una CMP inexistente como activa. No requiere geolocalizar al visitante
ni convertir páginas estáticas en páginas de servidor.

Google admite tres métodos para conectar el sitio: código AdSense, `ads.txt` o
`<meta name="google-adsense-account" content="ca-pub-…">`. La guía contempla
elegir una CMP **después de solicitar revisión**; si se elige la de Google, se
crea un mensaje que después puede editarse. La ausencia de acceso al panel CMP
no prueba por sí sola que sea imposible solicitar revisión. No deben confundirse
verificación, revisión del sitio y habilitación de anuncios.
[Fuente: conectar el sitio a AdSense](https://support.google.com/adsense/answer/7584263?hl=es).

## Qué exige Google y a qué visitantes se aplica

Google exige una CMP certificada integrada con el IAB TCF para **anuncios
personalizados** dirigidos a visitantes en el EEE, Reino Unido y Suiza. La regla
se refiere a la ubicación del usuario; fijar Perú como público editorial no
excluye automáticamente a lectores de esos territorios. La certificación evalúa
criterios de Google y no constituye validación completa de las leyes aplicables.
[Fuente: requisitos para editores](https://support.google.com/adsense/answer/13554116?hl=en).

La política europea de Google exige información sobre las partes que reciben o
usan los datos, consentimiento válido para personalización y para cookies u
otros almacenamientos cuando sea legalmente obligatorio, registro de decisiones
e instrucciones claras para revocarlas. Un aviso informativo o un enlace externo
de preferencias no registra por sí mismo consentimiento.
[Fuente: EU user consent policy](https://www.google.com/about/company/user-consent-policy/).

La configuración de proveedores importa: si el editor no la cambia, Google
utiliza su conjunto habitual de proveedores tecnológicos. La página de
configuración exige identificarlos ante los usuarios y enlazar información de
su tratamiento. No basta con identificar a Google si la configuración efectiva
incluye otros proveedores.
[Fuente: configurar y gestionar la CMP](https://support.google.com/adsense/answer/7670013?hl=en).

## Por qué «anuncios limitados» no resuelve automáticamente el consentimiento

La documentación actual permite intentar servir anuncios limitados incluso a
solicitudes europeas sin una cadena TC de una CMP certificada. No equivale a
publicidad sin procesamiento: se utiliza la IP para la entrega y, con anuncios
limitados programáticos, puede usarse almacenamiento local y cookies para
detectar tráfico no válido. Google indica que estos anuncios están activados
por defecto y que pueden desactivarse desde Seguridad de la marca → Controles
de bloqueo → Publicación de anuncios. También recuerda que, sin CMP, siguen
vigentes las obligaciones aplicables de su política de consentimiento.

Por tanto, no se recomienda dar por resuelto el problema cambiando una etiqueta
a «no personalizado» o confiando en el modo limitado predeterminado. La pausa
de carga propuesta evita depender de una configuración de cuenta que no se ha
podido comprobar.
[Fuente: Limited ads](https://support.google.com/adsense/answer/14210870?hl=en).

## Qué ofrece la CMP de Google

Google ofrece mensajes europeos y de estados estadounidenses en «Privacidad y
mensajes». El mensaje que se muestra depende de la ubicación y de las decisiones
existentes. Las opciones pueden permitir consentir, no consentir y gestionar
preferencias. Deben revisarse la cobertura y los proveedores reales; elegir
Google como CMP no demuestra que el mensaje de Labormin ya esté publicado.
[Fuente: cómo funciona la CMP de Google](https://support.google.com/adsense/answer/16918505?hl=en).

Los mensajes publicados pueden desplegarse mediante la etiqueta AdSense
existente. La API `googlefc` permite preparar un enlace de revocación con
`CONSENT_API_READY` y `showRevocationMessage()`. La inicialización de
`googlefc.callbackQueue` no carga una CMP. La vista previa
`?fc=alwaysshow&fctype=gdpr` exige que el mensaje esté publicado; debe probarse
en una sesión limpia, junto con aceptar, rechazar y cambiar la decisión.
[Fuente: Privacy & Messaging JavaScript API](https://developers.google.com/funding-choices/fc-api-docs).

## Observación del código y de la revisión previa

Al comenzar esta investigación, `Layout.astro` cargaba `adsbygoogle.js` en las
páginas indexables con editor válido, sin un interruptor de habilitación de
consentimiento. `Footer.astro` preparaba correctamente la entrada de revocación
de Google, pero su existencia no acreditaba una CMP publicada. La política de
privacidad reconocía esta incertidumbre. `ads.txt` ya declaraba el editor
`pub-1972487168739114`.

El [checklist](./ADSENSE-CHECKLIST.md) registra una inspección previa de la cuenta
del mismo día: rechazo y botón Resubmit, sin acceso a «Privacidad y mensajes».
Esta investigación no reabrió la cuenta ni cambió ajustes externos. No hay
evidencia suficiente para afirmar que Google ofrece la configuración CMP en
esa pantalla de rechazo concreta.

## Alternativa geográfica evaluada

Cloudflare ofrece `request.cf.country` (o `CF-IPCountry`) para conocer el código
del país de una solicitud. Es un dato del contexto de ejecución de Workers,
no una variable disponible durante la generación estática del HTML.
[Fuente: Request de Workers](https://developers.cloudflare.com/workers/runtime-apis/request/).

Los archivos estáticos suelen servirse antes de ejecutar el Worker. Interceptar
todas esas respuestas requiere cambiar el enrutamiento, por ejemplo con
`assets.run_worker_first`; la documentación admite patrones selectivos.
[Fuente: configuración de recursos estáticos](https://developers.cloudflare.com/workers/static-assets/binding/).

**Inferencia técnica:** bloquear anuncios únicamente para EEE/Reino Unido/Suiza
es posible con infraestructura adicional, pero modificaría el tratamiento de
ubicación, el enrutamiento y las pruebas. En este repositorio también entraría
en tensión con la instrucción vigente de no detectar país por IP. No se propone
ese cambio para esta preparación. Un interruptor global que impida cargar
AdSense conserva la arquitectura y facilita verificar el resultado.

## Implementación y comprobación sugeridas

- Introducir un interruptor publicitario desactivado por defecto y usarlo tanto
  en el cargador global como en las unidades manuales. Mantener la etiqueta meta
  de editor y `ads.txt` para la verificación.
- Ajustar privacidad y el pie para describir el estado real de la pausa; no
  añadir un banner propio que se presente como CMP certificada.
- Verificar en producción ausencia de solicitudes a AdSense, no solo ausencia
  de anuncios visibles. Comprobar también fichas, guías y archivo histórico.
- Conservar preparada la integración de revocación para cuando exista un
  mensaje publicado, sin mostrar un control que no funciona.

Estos puntos son recomendaciones de ingeniería derivadas del código y de las
fuentes, no requisitos literales de Google para obtener la aprobación.

## Pendientes de cuenta antes de habilitar monetización

1. Cuando esté disponible «Privacidad y mensajes», crear o comprobar el mensaje
   para `labormin.com`, URL `https://labormin.com/privacy`, idioma español,
   cobertura europea y proveedores. Configurar acceso claro a rechazar y
   gestionar preferencias. No afirmar publicación hasta verla en el sitio.
2. Revisar mensajes de otros territorios, incluido el tratamiento de estados
   estadounidenses, según tráfico y configuración real. Definir los datos del
   operador y la conservación de correo con información del propietario.
3. Probar mensaje publicado, decisiones, persistencia, revocación y comportamiento
   de anuncios en móvil y escritorio. Mantener la pausa si falla la prueba.
4. Habilitar el interruptor solo tras esa comprobación y con los ajustes reales
   de cuenta documentados. La habilitación de publicidad no debe quedar ligada
   automáticamente a una actualización del feed.

El motivo específico del rechazo debe obtenerse del mensaje de Google. Una
mejora técnica o la publicación de una CMP no garantiza aprobación.

## Prueba separada de la activación de anuncios

Tras habilitarse el panel, se confirmó y corrigió el mensaje publicado para
Labormin; ver el checklist para los ajustes observados. La pausa global inicial
impide también cargar el mensaje, porque el cargador de AdSense lo despliega.

La ruta de diagnóstico `/comprobar-consentimiento/` carga la etiqueta únicamente
tras pulsar un botón, fija antes `adsbygoogle.pauseAdRequests=1`, no contiene
unidades y nunca asigna cero a ese indicador. Google documenta esta API para
impedir solicitudes de anuncios mientras siguen cargándose sus scripts. Puede
leer cookies existentes de dominios Google; la pausa no significa ausencia de
todo tratamiento. La ruta informa de la carga de Google y de que la CMP puede
guardar la elección. No se habilita esa carga en las páginas habituales.
[Fuente: pausar solicitudes de anuncios](https://support.google.com/adsense/answer/7670312?hl=en).

La vista `?fc=alwaysshow&fctype=gdpr` fuerza el mensaje para depuración, pero
no sirve para demostrar que una elección persiste: esa comprobación debe
repetirse sin los parámetros. Ningún estado simulado sustituye la prueba del
mensaje real publicado. El panel advierte que una publicación puede tardar
hasta una hora en aparecer.

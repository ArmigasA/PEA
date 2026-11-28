# Firebase en el PEA

La app usa Firebase Authentication y Cloud Firestore. Las fotos se comprimen en el navegador y se guardan en Firestore; Firebase Storage no es necesario.

## Firestore

Crea la base Standard en modo de producción y publica `firestore.rules` desde **Firestore → Rules**. Las reglas cubren perfiles privados/públicos, imágenes comprimidas en subdocumentos, tokens privados de notificaciones y las invitaciones adulto-estudiante.

## Notificaciones

Los avisos dentro del sitio funcionan al activar el control en Perfil → Configuración. Para notificaciones push, en Firebase Console ve a **Project settings → Cloud Messaging → Web Push certificates**, genera o copia la clave pública y colócala en `fcmVapidKey` dentro de `firebase-config.js`. Publica `firebase-messaging-sw.js` en la raíz del sitio HTTPS. La persona usuaria debe permitir notificaciones en su navegador. La app guarda su token de forma privada en `users/{uid}/pushTokens`; desde Configuración puede copiarlo para una prueba.

El navegador puede recibir notificaciones en segundo plano cuando Firebase Cloud Messaging envíe un mensaje. Para probar, Firebase permite enviar una notificación de prueba a un token desde **Messaging → Notifications composer → Send test message**. El envío automático de campañas para todos los usuarios requiere una aplicación de servidor de confianza; nunca pongas credenciales Admin en el HTML o JavaScript público.

## Idiomas

La preferencia de idioma (español, inglés o portugués) se guarda en `users/{uid}.settings.language`. `i18n.js` traduce navegación, controles y resúmenes seleccionados; el aviso de idioma señala que algunos textos extensos aún se muestran en español.

## Vinculación adulto-estudiante

Cada cuenta debe completar el perfil con el rango correspondiente. El estudiante crea un código aleatorio de un solo uso y lo comparte en privado. El adulto lo canjea con una cuenta que tenga correo verificado y rango Adulto; las reglas exigen correos distintos y rango Estudiante para la otra cuenta. Cualquiera de las dos cuentas puede desvincularse.

La verificación de correo comprueba acceso a esa dirección, no edad ni identidad legal. La vinculación no sustituye la supervisión de un adulto ni controles parentales del dispositivo.

## Límites del plan gratuito

Cada documento de Firestore admite hasta 1 MiB. Las imágenes se reducen a un máximo de 220.000 caracteres para el avatar y 500.000 para el banner, en un documento aparte. Controla las cuotas de Firestore en Firebase Console si aumenta el uso.

## Acceso de desarrollador

El UID autorizado para el rango Equipo de Desarrollo se valida en profile.js y en las reglas de Firestore. Los nombres ADMIN, AD y Desarrollador quedan reservados por Rules. La contraseña no se guarda en el código: el panel vuelve a autenticar la cuenta mediante Firebase Authentication. Por eso, el texto ingresado debe coincidir con la contraseña actual de esa cuenta; el sitio no contiene ni compara una clave fija llamada `SystemAccess`. La cuenta autorizada debe tener proveedor Correo/Contraseña. La insignia se muestra solo para ese UID con el rango autorizado.

## Votos privados y acceso SYSTEM

El portal usa Authentication Anónima para que visitantes puedan enviar un voto sin crear una cuenta. En Firebase Console, abre **Authentication → Sign-in method** y habilita **Anonymous**. Los votos se guardan en `votes/{contentId}/ballots/{uid}` sin correo ni perfil público. Cada persona puede cambiar su voto; solo el Equipo de Desarrollo puede leer los documentos y consultar el resumen desde **Perfil → insignia (tres clics) → SYSTEM**. La interfaz muestra resultados agregados, nunca correos ni nombres de quienes votaron.

SYSTEM incorpora cuatro herramientas: consulta y exportación de votos; búsqueda de perfiles por UID y asignación/revocación del rango GOB (con restauración del rango anterior); edición visual/HTML segura con importación de archivos, vista previa aislada, borradores locales y acceso a las 25 versiones más recientes por página; y registro interno de actividad exportable. No consulta datos privados de cuenta ni contraseñas.

El editor guarda las publicaciones en `sitePages/{pageId}`, las copias previas en `sitePageRevisions/{pageId}/versions/{versionId}` y la auditoría en `systemAudit/{entryId}`. Revisa que los archivos HTML tengan cargado `page-content-runtime.js` para aplicar las publicaciones de Firestore. HTML y CSS pasan filtros en el navegador y el renderizador público vuelve a limpiar el HTML antes de insertarlo; no se admiten scripts desde el editor. El modo visual del editor es una herramienta básica para contenido; el modo HTML permite ajustes precisos.

Las reglas de Firestore son la autoridad real de acceso: solo el UID inicial de desarrollo puede recibir el rango Equipo de Desarrollo, y las operaciones administrativas requieren ese rango. Las asignaciones GOB se hacen en lote, se vinculan a una copia privada del rango anterior en `adminRoles/{uid}`, y solo el Equipo de Desarrollo puede consultar ese registro. El historial y la auditoría son de solo lectura y escritura para el Equipo de Desarrollo y no pueden editarse ni borrarse desde el cliente. `firebase.json` apunta a `firestore.rules`; publica las reglas actualizadas antes de utilizar estas funciones. Las reglas de Firestore permiten al Equipo de Desarrollo operar el panel aunque la aplicación comprueba además el UID inicial para abrir SYSTEM.

La preferencia **Epilepsia · reducir movimiento** apaga nieve, partículas, GIF y animaciones del portal. También se respeta `prefers-reduced-motion` del dispositivo.

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

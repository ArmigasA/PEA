# Preparar Firebase para el Portal Educativo Armiguense

La app web `registro-pea` ya está conectada en `firebase-config.js` con los valores que compartiste. El SDK modular usa Firebase 13.4.0 desde gstatic; Analytics no se inicializa.

## Activar proveedores

En Firebase Console → Authentication → Sign-in method, activa **Email/Password** y **Google**. En Authentication → Settings → Authorized domains agrega el dominio de producción y `localhost` para desarrollo local.

## Crear Firestore

En Build → Firestore Database, crea la base de datos y publica el contenido de `firestore.rules` desde la pestaña Rules. Las reglas limitan `/users/{uid}` a la cuenta autenticada cuyo UID coincide; el resto de las rutas queda denegado.

## Probar

Abre el sitio mediante un servidor local o su dominio HTTPS (los módulos ES no funcionan de forma confiable al abrir `file://`). En `login.html`, prueba alta con correo, salida, acceso y Google. Cada perfil se guarda en `users/{uid}`.

El acceso al panel de efectos consulta el estado real de Firebase Auth mediante `auth-session.js`. No confíes en una marca de `sessionStorage` como medida de seguridad para proteger datos; Firestore queda protegido por Rules.
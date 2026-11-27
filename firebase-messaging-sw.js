importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBwh0Q33XOipGmxwK1mAHLeOt97Z5ehYT8',
  authDomain: 'registro-pea.firebaseapp.com',
  projectId: 'registro-pea',
  messagingSenderId: '203315680971',
  appId: '1:203315680971:web:afd8cf1ff367b5bb0d2d4e'
});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const title=payload.notification?.title||payload.data?.title||'Novedades del PEA';
  const options={body:payload.notification?.body||payload.data?.body||'Hay una nueva comunicación del Portal Educativo Armiguense.',icon:'libro.png',data:{url:payload.fcmOptions?.link||payload.data?.url||'actualizacion/'}};
  return self.registration.showNotification(title,options);
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'actualizacion/',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
    return existing?existing.navigate(target):self.clients.openWindow(target);
  }));
});



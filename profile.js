import {app,auth,db,fcmVapidKey} from './firebase-config.js';
import {onAuthStateChanged,EmailAuthProvider,GoogleAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup,updateEmail,updatePassword,deleteUser,signOut} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {doc,getDoc,setDoc,serverTimestamp,deleteDoc,collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import {getMessaging,getToken,deleteToken,isSupported} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging.js';

const $=id=>document.getElementById(id);
let user=null,profile={},saveTimer,pushToken='';
const DEVELOPER_UIDS=new Set(['Jj7pIHpuqBNzaRT5i9FSoqRWTnD3']);
let developerAuthorized=false;
const isReservedDeveloperName=value=>/^(admin|ad|desarrollador)$/i.test(value.trim());
let settings={theme:'system',font:'sans',notifications:false,linkCheck:false,colorblind:false,vision:false,visualMode:'standard'};
const setStatus=(message,error=false)=>{const el=$('profile-save-status');el.textContent=message;el.classList.toggle('is-error',error)};

function applySettings(){
  localStorage.setItem('pea-site-settings',JSON.stringify(settings));
  localStorage.setItem('anerica-visual-mode',settings.visualMode||'standard');
  document.body.classList.toggle('theme-dark',settings.theme==='dark'||(settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));
  document.body.classList.toggle('font-serif',settings.font==='serif');
  document.body.classList.toggle('font-dyslexic',settings.font==='dyslexic');
  document.body.classList.toggle('colorblind',settings.colorblind===true);
  document.body.classList.toggle('vision-assist',settings.vision===true);
  document.body.classList.remove('ancient','console');
  if(settings.visualMode&&settings.visualMode!=='standard')document.body.classList.add(settings.visualMode);
}
function fill(){
  const name=profile.visibleName||user.displayName||user.email?.split('@')[0]||'Usuario';
  $('visible-name').value=profile.visibleName||'';
  $('profile-heading').textContent=name;
  $('welcome-name').textContent=name;
  $('signed-user-name').textContent=name;
  $('avatar-initial').textContent=(name[0]||'U').toLocaleUpperCase('es');
  $('bio').value=profile.bio||'';
  $('bio-count').value=$('bio').value.length;
  $('developer-rank-option').hidden=!DEVELOPER_UIDS.has(user.uid);
  $('rank').value=profile.rank||'';$('parental-dashboard-link').hidden=!['Adulto','Estudiante'].includes(profile.rank);
  $('developer-badge').hidden=!(DEVELOPER_UIDS.has(user.uid)&&profile.rank==='Equipo de Desarrollo'&&profile.developerBadge===true);
  (profile.socialLinks||[]).forEach((value,index)=>{if(index<3)$(`social-${index+1}`).value=value});
  if(profile.avatarURL){$('avatar-preview').src=profile.avatarURL;$('avatar-preview').hidden=false;$('avatar-initial').hidden=true;const header=$('header-avatar');if(header){header.src=profile.avatarURL;header.hidden=false;$('profile-initial').hidden=true}}
  if(profile.bannerURL)$('profile-cover').style.backgroundImage=`linear-gradient(90deg,#102b40aa,#102b4044),url("${profile.bannerURL}")`;
  $('theme-setting').value=settings.theme||'system';$('font-setting').value=settings.font||'sans';
  $('notifications-setting').checked=Boolean(settings.notifications);$('link-check-setting').checked=Boolean(settings.linkCheck);
  $('language-select').value=settings.language||localStorage.getItem('pea-language')||'es';document.dispatchEvent(new CustomEvent('pea-language-change',{detail:{language:$('language-select').value}}));
  $('colorblind-toggle').setAttribute('aria-pressed',String(Boolean(settings.colorblind)));
  $('vision-toggle').setAttribute('aria-pressed',String(Boolean(settings.vision)));
  $('vision-help').hidden=!settings.vision;$('speak-page').hidden=!settings.vision;
  document.querySelectorAll('[name="visual-mode"]').forEach(r=>r.checked=r.value===(settings.visualMode||'standard'));
}
async function load(){
  try{
    const [publicSnap,privateSnap,mediaSnap,pushSnap]=await Promise.all([getDoc(doc(db,'publicProfiles',user.uid)),getDoc(doc(db,'users',user.uid)),getDoc(doc(db,'publicProfiles',user.uid,'media','images')),getDocs(collection(db,'users',user.uid,'pushTokens'))]);
    profile=publicSnap.exists()?publicSnap.data():{};profile.avatarURL=null;profile.bannerURL=null;
    if(mediaSnap.exists()){const media=mediaSnap.data();profile.avatarURL=media.avatarData||null;profile.bannerURL=media.bannerData||null;cacheImage('avatar',profile.avatarURL);cacheImage('banner',profile.bannerURL)}
    settings={...settings,...(privateSnap.exists()?privateSnap.data().settings||{}:{})};
    pushToken=pushSnap.docs[0]?.data().token||'';$('copy-push-token').hidden=!pushToken;$('push-status').textContent=pushToken?'Este navegador está registrado para notificaciones push.':'';
    fill();$('profile-loading').hidden=true;$('profile-content').hidden=false;applySettings();
  }catch(error){$('profile-loading').textContent=`No se pudo cargar el perfil. Comprueba Firestore Rules. Código: ${error.code||'error'}`}
}
function collectProfile(){const rank=$('rank').value;return{visibleName:$('visible-name').value.trim(),bio:$('bio').value.trim(),socialLinks:[1,2,3].map(i=>$(`social-${i}`).value.trim()).filter(Boolean),rank,developerBadge:rank==='Equipo de Desarrollo',updatedAt:serverTimestamp()}}
function queueProfileSave(){
  clearTimeout(saveTimer);
  const name=$('visible-name').value.trim()||'Mi Perfil';
  $('profile-heading').textContent=name;$('welcome-name').textContent=name;$('avatar-initial').textContent=(name[0]||'U').toLocaleUpperCase('es');
  const reserved=isReservedDeveloperName(name),developerRole=$('rank').value==='Equipo de Desarrollo';
  $('developer-badge').hidden=!(developerRole&&developerAuthorized);
  if((reserved||developerRole)&&!developerAuthorized){setStatus('Ese nombre o rango requiere el acceso del Equipo de Desarrollo.',true);return}
  $('parental-dashboard-link').hidden=!['Adulto','Estudiante'].includes($('rank').value);
  $('bio-count').value=$('bio').value.length;setStatus('Guardando cambios…');
  saveTimer=setTimeout(async()=>{
    const data=collectProfile();
    if(!data.visibleName||!data.rank){setStatus('Completa Nombre Visible y Rango para guardar.',true);return}
    try{for(const value of data.socialLinks){const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error('invalid-url')}
      await setDoc(doc(db,'publicProfiles',user.uid),data,{merge:true});profile={...profile,...data};setStatus('Perfil guardado automáticamente.');
    }catch(error){setStatus(error.message==='invalid-url'?'Las redes deben ser enlaces http o https.':`No se pudo guardar el perfil. Código: ${error.code||'revisa reglas de Firestore'}`,true)}
  },700);
}
for(const id of ['visible-name','bio','social-1','social-2','social-3','rank']){ $(id).addEventListener('input',queueProfileSave);$(id).addEventListener('change',queueProfileSave); }
$('visible-name').addEventListener('blur',()=>{if(isReservedDeveloperName($('visible-name').value)&&!developerAuthorized)openDeveloperGate()});
$('rank').addEventListener('change',()=>{if($('rank').value==='Equipo de Desarrollo'&&!developerAuthorized)openDeveloperGate()});
function openDeveloperGate(){
  const allowed=DEVELOPER_UIDS.has(user.uid);$('developer-gate').hidden=false;$('developer-password').value='';$('developer-login-form').hidden=!allowed;$('developer-password').disabled=!allowed;
  $('developer-gate-status').textContent=allowed?'Confirma tu contraseña de Firebase.':'Esta cuenta de Firebase todavía no está autorizada para el acceso del equipo.';
}
$('developer-cancel').addEventListener('click',()=>{$('developer-gate').hidden=true;$('visible-name').value=profile.visibleName||'';$('rank').value=profile.rank||'';$('profile-heading').textContent=profile.visibleName||'Mi Perfil';setStatus('No se aplicaron los cambios reservados.')});
$('developer-login-form').addEventListener('submit',async event=>{event.preventDefault();if(!DEVELOPER_UIDS.has(user.uid)){openDeveloperGate();return}if(!user.providerData.some(provider=>provider.providerId==='password')){$('developer-gate-status').textContent='Esta verificación requiere una cuenta Firebase con correo y contraseña.';return}try{const credential=EmailAuthProvider.credential(user.email,$('developer-password').value);await reauthenticateWithCredential(user,credential);developerAuthorized=true;$('developer-rank-option').hidden=false;$('developer-gate').hidden=true;if(isReservedDeveloperName($('visible-name').value))$('rank').value='Equipo de Desarrollo';$('developer-badge').hidden=$('rank').value!=='Equipo de Desarrollo';queueProfileSave()}catch(error){$('developer-gate-status').textContent=error.code==='auth/invalid-credential'?'Contraseña incorrecta.':'No se pudo confirmar el acceso. Revisa la cuenta Firebase.'}});
$('bio').addEventListener('input',()=>{$('bio-count').value=$('bio').value.length});
function cacheImage(kind,value){if(!value)return;try{localStorage.setItem(`pea-${kind}-${user.uid}`,value)}catch{}}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
async function compressImage(file,kind){
  const bitmap=await createImageBitmap(file),maxSide=kind==='avatar'?512:1400,maxHeight=kind==='avatar'?512:520,maxChars=kind==='avatar'?220000:500000;
  let scale=Math.min(1,maxSide/bitmap.width,maxHeight/bitmap.height);let data='';
  for(let attempt=0;attempt<8;attempt++){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Math.max(.4,.82-attempt*.07)));
    if(!blob)throw new Error('image-encode-failed');data=await blobToDataUrl(blob);if(data.length<=maxChars){bitmap.close();return data}scale*=.78;
  }
  bitmap.close();throw new Error('image-too-large');
}
async function uploadImage(inputId,kind){
  const file=$(inputId).files[0];if(!file)return;if(!$('visible-name').value.trim()||!$('rank').value){setStatus('Antes de subir imágenes, completa Nombre Visible y Rango.',true);return}
  if(!file.type.startsWith('image/')||file.size>12*1024*1024){setStatus('Elige una imagen de hasta 12 MB.',true);return}
  setStatus('Preparando y guardando imagen…');
  try{
    const url=await compressImage(file,kind);profile[kind==='avatar'?'avatarURL':'bannerURL']=url;
    await setDoc(doc(db,'publicProfiles',user.uid,'media','images'),{[kind==='avatar'?'avatarData':'bannerData']:url,updatedAt:serverTimestamp()},{merge:true});
    cacheImage(kind,url);
    if(kind==='avatar'){$('avatar-preview').src=url;$('avatar-preview').hidden=false;$('avatar-initial').hidden=true;const header=$('header-avatar');if(header){header.src=url;header.hidden=false;$('profile-initial').hidden=true}}
    else $('profile-cover').style.backgroundImage=`linear-gradient(90deg,#102b40aa,#102b4044),url("${url}")`;
    queueProfileSave();
  }catch(error){setStatus(error.message==='image-too-large'?'La imagen no se pudo reducir lo suficiente. Prueba con otra de menor resolución.':`No se pudo guardar la imagen. Código: ${error.code||error.message||'error'}`,true)}
}
$('avatar-file').addEventListener('change',()=>uploadImage('avatar-file','avatar'));
$('banner-file').addEventListener('change',()=>uploadImage('banner-file','banner'));
async function saveSettings(){
  settings.theme=$('theme-setting').value;settings.font=$('font-setting').value;
  settings.notifications=$('notifications-setting').checked;settings.linkCheck=$('link-check-setting').checked;
  applySettings();
  try{await setDoc(doc(db,'users',user.uid),{uid:user.uid,settings,updatedAt:serverTimestamp()},{merge:true});$('account-action-status').textContent='Preferencias guardadas.';document.dispatchEvent(new CustomEvent('pea-notifications-updated',{detail:{settings}}))}
  catch(error){$('account-action-status').textContent=`No se guardó la configuración. Código: ${error.code||'error'}`}
}
for(const id of ['theme-setting','font-setting','notifications-setting','link-check-setting'])$(id).addEventListener('change',async()=>{
  if(id==='notifications-setting'&&$('notifications-setting').checked){try{await enableBrowserNotifications()}catch(error){$('account-action-status').textContent=error.message}}
  if(id==='notifications-setting'&&!$('notifications-setting').checked)await disablePushSubscription();
  await saveSettings();
});
async function enableBrowserNotifications(){
  if(!('Notification'in window)||!('serviceWorker'in navigator)){settings.browserPush=false;$('account-action-status').textContent='Los avisos internos quedarán activados; este navegador no admite notificaciones push.';return}
  const permission=await Notification.requestPermission();if(permission!=='granted'){settings.browserPush=false;$('account-action-status').textContent='Los avisos internos quedan activados. No se concedió permiso para notificaciones del navegador.';return}
  if(!fcmVapidKey){settings.browserPush=false;$('account-action-status').textContent='Avisos internos activados. Para recibir push, falta agregar la clave Web Push de Firebase en firebase-config.js.';return}
  if(!await isSupported())throw new Error('Este navegador no admite Firebase Messaging. Los avisos internos seguirán activos.');
  const registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js');const token=await getToken(getMessaging(app),{vapidKey:fcmVapidKey,serviceWorkerRegistration:registration});
  if(!token)throw new Error('Firebase no entregó un token de notificaciones.');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const id=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  await setDoc(doc(db,'users',user.uid,'pushTokens',id),{token,updatedAt:serverTimestamp()});pushToken=token;$('copy-push-token').hidden=false;$('push-status').textContent='Token de prueba registrado en esta cuenta.';localStorage.setItem(`pea-push-token-${user.uid}`,id);settings.browserPush=true;$('account-action-status').textContent='Avisos del sitio y notificaciones del navegador activados.';
}
async function disablePushSubscription(){
  const id=localStorage.getItem(`pea-push-token-${user.uid}`);if(id)try{await deleteDoc(doc(db,'users',user.uid,'pushTokens',id))}catch{}
  try{if(await isSupported())await deleteToken(getMessaging(app))}catch{}
  localStorage.removeItem(`pea-push-token-${user.uid}`);pushToken='';$('copy-push-token').hidden=true;$('push-status').textContent='La suscripción push se quitó.';settings.browserPush=false;
}
$('copy-push-token').addEventListener('click',async()=>{if(!pushToken)return;try{await navigator.clipboard.writeText(pushToken);$('push-status').textContent='Token de prueba copiado. Úsalo solo en Firebase Console.'}catch{$('push-status').textContent=`Copia este token privado para la prueba: ${pushToken}`}});
$('effects-open').addEventListener('click',()=>{$('effects-dialog').hidden=false});
document.querySelectorAll('[name="visual-mode"]').forEach(r=>r.addEventListener('change',async()=>{settings.visualMode=r.value;applySettings();try{await setDoc(doc(db,'users',user.uid),{uid:user.uid,settings,updatedAt:serverTimestamp()},{merge:true});$('account-action-status').textContent='Efectos guardados.'}catch(error){$('account-action-status').textContent=`No se guardaron los efectos. Código: ${error.code||'error'}`}}));
$('colorblind-toggle').addEventListener('click',async()=>{settings.colorblind=!settings.colorblind;$('colorblind-toggle').setAttribute('aria-pressed',String(settings.colorblind));await saveSettings()});
$('vision-toggle').addEventListener('click',async()=>{settings.vision=!settings.vision;$('vision-toggle').setAttribute('aria-pressed',String(settings.vision));$('vision-help').hidden=!settings.vision;$('speak-page').hidden=!settings.vision;await saveSettings()});
$('speak-page').addEventListener('click',()=>{if(!('speechSynthesis'in window)){setStatus('Este navegador no ofrece lectura de voz.',true);return}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(document.querySelector('main').innerText))});
$('language-select').addEventListener('change',async event=>{settings.language=event.target.value;localStorage.setItem('pea-language',settings.language);document.dispatchEvent(new CustomEvent('pea-language-change',{detail:{language:settings.language}}));await saveSettings()});
async function reauthenticate(){const provider=user.providerData[0]?.providerId;if(provider==='google.com')return reauthenticateWithPopup(user,new GoogleAuthProvider());const password=prompt('Confirma tu contraseña actual para continuar:');if(password===null)throw new Error('cancelled');return reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password))}
$('change-email').addEventListener('click',async()=>{const next=prompt('Ingresa el nuevo correo electrónico:');if(!next)return;try{await reauthenticate();await updateEmail(user,next);await setDoc(doc(db,'users',user.uid),{uid:user.uid,email:next,updatedAt:serverTimestamp()},{merge:true});$('account-action-status').textContent='Correo actualizado.'}catch(error){$('account-action-status').textContent=`No se pudo cambiar el correo. Código: ${error.code||error.message}`}});
$('change-password').addEventListener('click',async()=>{const next=prompt('Nueva contraseña (6 a 25 caracteres, un número y una mayúscula):');if(!next)return;if(next.length<6||next.length>25||!/[0-9]/.test(next)||!/[A-ZÁÉÍÓÚÜÑ]/.test(next)){$('account-action-status').textContent='La contraseña no cumple los requisitos.';return}try{await reauthenticate();await updatePassword(user,next);$('account-action-status').textContent='Contraseña actualizada.'}catch(error){$('account-action-status').textContent=`No se pudo cambiar la contraseña. Código: ${error.code||error.message}`}});
$('download-data').addEventListener('click',async()=>{try{const [privateSnap,publicSnap,mediaSnap]=await Promise.all([getDoc(doc(db,'users',user.uid)),getDoc(doc(db,'publicProfiles',user.uid)),getDoc(doc(db,'publicProfiles',user.uid,'media','images'))]);const blob=new Blob([JSON.stringify({privateData:privateSnap.data()||{},publicProfile:publicSnap.data()||{},profileImages:mediaSnap.data()||{}},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='mis-datos-pea.json';link.click();URL.revokeObjectURL(link.href)}catch(error){$('account-action-status').textContent=`No se pudieron solicitar los datos. Código: ${error.code||'error'}`}});
$('delete-account').addEventListener('click',async()=>{if(!confirm('¿Seguro que quieres eliminar tu cuenta y perfil? Esta acción no se puede deshacer.'))return;try{await reauthenticate();const [asStudent,asParent,pushTokens]=await Promise.all([getDocs(query(collection(db,'parentLinks'),where('studentUid','==',user.uid))),getDocs(query(collection(db,'parentLinks'),where('parentUid','==',user.uid))),getDocs(collection(db,'users',user.uid,'pushTokens'))]);await Promise.all([...asStudent.docs,...asParent.docs,...pushTokens.docs].map(item=>deleteDoc(item.ref)));await deleteDoc(doc(db,'publicProfiles',user.uid,'media','images'));await deleteDoc(doc(db,'publicProfiles',user.uid));await deleteDoc(doc(db,'users',user.uid));localStorage.removeItem(`pea-avatar-${user.uid}`);localStorage.removeItem(`pea-banner-${user.uid}`);localStorage.removeItem(`pea-push-token-${user.uid}`);await deleteUser(user);location.href='index.html'}catch(error){$('account-action-status').textContent=`No se pudo eliminar la cuenta. Código: ${error.code||error.message}`}});
$('profile-signout').addEventListener('click',async()=>{await signOut(auth);location.href='login.html'});
onAuthStateChanged(auth,authenticatedUser=>{if(!authenticatedUser){location.href='login.html?return=perfil.html';return}user=authenticatedUser;load()});

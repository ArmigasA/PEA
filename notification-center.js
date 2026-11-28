import {auth,db} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import {getMessaging,isSupported,onMessage} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging.js';
const VERSION='1.27.11-alpha',TITLE='Nueva actualización: 1.27.11 Alpha',BODY='El Portal Educativo Amiguense ya está abierto al público. Consulta las novedades en Actualización.';
let user=null,settings={},stopForeground=null;const $=id=>document.getElementById(id);
function mount(){
  const nav=document.querySelector('.nav');if(!nav||!user||!settings.notifications)return;
  let wrapper=$('notification-center');if(wrapper)return;
  wrapper=document.createElement('div');wrapper.className='notification-center';wrapper.id='notification-center';
  const button=document.createElement('button');button.type='button';button.className='notification-trigger';button.setAttribute('aria-label','Abrir notificaciones');button.setAttribute('aria-expanded','false');button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i class="notification-dot" aria-hidden="true"></i>';
  const panel=document.createElement('section');panel.className='notification-panel';panel.hidden=true;panel.setAttribute('aria-label','Notificaciones');
  const heading=document.createElement('h2');heading.textContent='Notificaciones';const item=document.createElement('article');item.className='notification-item';const title=document.createElement('strong');title.textContent=TITLE;const text=document.createElement('p');text.textContent=BODY;const link=document.createElement('a');link.href='actualizacion/';link.textContent='Ver actualización';const read=document.createElement('button');read.type='button';read.className='notification-read';read.textContent='Marcar como leída';item.append(title,text,link);panel.append(heading,item,read);wrapper.append(button,panel);const account=nav.querySelector('#account-menu');nav.insertBefore(wrapper,account||null);
  const unread=settings.notificationsSeen!==VERSION;wrapper.classList.toggle('has-unread',unread);read.hidden=!unread;
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden))});
  document.addEventListener('click',event=>{if(!wrapper.contains(event.target)){panel.hidden=true;button.setAttribute('aria-expanded','false')}});
  read.addEventListener('click',async()=>{settings.notificationsSeen=VERSION;wrapper.classList.remove('has-unread');read.hidden=true;try{await setDoc(doc(db,'users',user.uid),{uid:user.uid,settings,updatedAt:serverTimestamp()},{merge:true})}catch{}});
  if(unread&&'Notification'in window&&Notification.permission==='granted'&&localStorage.getItem(`pea-notified-${user.uid}`)!==VERSION){try{new Notification(TITLE,{body:BODY,icon:'libro.png',tag:VERSION});localStorage.setItem(`pea-notified-${user.uid}`,VERSION)}catch{}}
}
async function receiveForegroundMessages(){try{if(stopForeground){stopForeground();stopForeground=null}if(!await isSupported())return;const messaging=getMessaging();stopForeground=onMessage(messaging,payload=>{const title=payload.notification?.title||payload.data?.title||'Notificación del PEA';const body=payload.notification?.body||payload.data?.body||'Tienes una nueva comunicación.';if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body,icon:'libro.png'});const panel=$('notification-center')?.querySelector('.notification-panel');if(panel){panel.hidden=false;const item=panel.querySelector('.notification-item');item.querySelector('strong').textContent=title;item.querySelector('p').textContent=body}})}catch{}}
onAuthStateChanged(auth,async authenticated=>{if(!authenticated||authenticated.isAnonymous){$('notification-center')?.remove();return}user=authenticated;try{const snap=await getDoc(doc(db,'users',user.uid));settings=snap.exists()?snap.data().settings||{}:{};if(settings.notifications){mount();await receiveForegroundMessages()}else $('notification-center')?.remove()}catch{}});
document.addEventListener('pea-notifications-updated',async event=>{settings=event.detail?.settings||settings;if(settings.notifications){mount();await receiveForegroundMessages()}else{$('notification-center')?.remove();if(stopForeground){stopForeground();stopForeground=null}}});



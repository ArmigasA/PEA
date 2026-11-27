import {auth,db} from './firebase-config.js';
import {onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const loginLink=document.querySelector('.login-link');
const menu=document.getElementById('account-menu');
const trigger=document.getElementById('profile-trigger');
const dropdown=document.getElementById('profile-dropdown');
if(trigger&&dropdown){
  trigger.addEventListener('click',()=>{dropdown.hidden=!dropdown.hidden;trigger.setAttribute('aria-expanded',String(!dropdown.hidden))});
  document.addEventListener('click',event=>{if(menu&&!menu.contains(event.target)){dropdown.hidden=true;trigger.setAttribute('aria-expanded','false')}});
  document.getElementById('header-signout')?.addEventListener('click',async()=>{await signOut(auth);location.href='login.html'});
}
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');const prefs=JSON.parse(localStorage.getItem('pea-site-settings')||'{}');
  if(link&&prefs.linkCheck){try{const url=new URL(link.href,location.href);if(url.origin!==location.origin&&!confirm('Este enlace te llevará fuera del Portal Educativo Armiguense. ¿Deseas continuar?'))event.preventDefault()}catch{}}
},{capture:true});

onAuthStateChanged(auth,async user=>{
  if(user){
    sessionStorage.setItem('pea-authenticated','true');document.body.classList.add('authenticated');if(loginLink)loginLink.hidden=true;if(menu)menu.hidden=false;
    let name=user.displayName||(user.email?user.email.split('@')[0]:'Usuario');
    const initials=document.getElementById('profile-initial'),avatar=document.getElementById('header-avatar');
    if(initials)initials.textContent=(name[0]||'U').toLocaleUpperCase('es');
    const cachedAvatar=localStorage.getItem(`pea-avatar-${user.uid}`);
    if(avatar&&cachedAvatar){avatar.src=cachedAvatar;avatar.hidden=false;if(initials)initials.hidden=true}
    try{
      const snap=await getDoc(doc(db,'publicProfiles',user.uid));
      if(snap.exists()){const data=snap.data();name=data.visibleName||name;if(initials)initials.textContent=(name[0]||'U').toLocaleUpperCase('es')}
    }catch{}
    if(avatar&&!cachedAvatar){try{const media=await getDoc(doc(db,'publicProfiles',user.uid,'media','images'));const image=media.exists()?media.data().avatarData:null;if(image){avatar.src=image;avatar.hidden=false;if(initials)initials.hidden=true;try{localStorage.setItem(`pea-avatar-${user.uid}`,image)}catch{}}}catch{}}
    let settings=JSON.parse(localStorage.getItem('pea-site-settings')||'{}');
    try{const privateSnap=await getDoc(doc(db,'users',user.uid));if(privateSnap.exists())settings={...settings,...(privateSnap.data().settings||{})}}catch{}
    localStorage.setItem('pea-site-settings',JSON.stringify(settings));applySettings(settings);
    if(settings.language){localStorage.setItem('pea-language',settings.language);document.dispatchEvent(new CustomEvent('pea-language-change',{detail:{language:settings.language}}))}
  }else{
    sessionStorage.removeItem('pea-authenticated');document.body.classList.remove('authenticated','ancient','console','theme-dark','font-serif','font-dyslexic','vision-assist','colorblind');
    if(loginLink)loginLink.hidden=false;if(menu)menu.hidden=true;
  }
  document.documentElement.dataset.authReady='true';document.dispatchEvent(new CustomEvent('pea-auth-state',{detail:{user}}));
});
function applySettings(settings){
  document.body.classList.remove('ancient','console');
  if(settings.visualMode&&settings.visualMode!=='standard')document.body.classList.add(settings.visualMode);
  document.body.classList.toggle('theme-dark',settings.theme==='dark'||(settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));
  document.body.classList.toggle('font-serif',settings.font==='serif');document.body.classList.toggle('font-dyslexic',settings.font==='dyslexic');
  document.body.classList.toggle('vision-assist',settings.vision===true);document.body.classList.toggle('colorblind',settings.colorblind===true);
}

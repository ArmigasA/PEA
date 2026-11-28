import {auth,db} from './firebase-config.js';
import {signInAnonymously} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const key='pea-update-vote-1-27-11';let selected=localStorage.getItem(key);
function render(){document.querySelectorAll('[data-vote]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.vote===selected)));const status=document.querySelector('.vote-status');if(status)status.textContent=selected?'Gracias. Tu voto quedó guardado de forma privada y puedes cambiarlo cuando quieras.':''}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-vote]');if(!button)return;const status=document.querySelector('.vote-status');try{const voter=auth.currentUser||(await signInAnonymously(auth)).user;selected=button.dataset.vote;await setDoc(doc(db,'votes','update-1-27-11','ballots',voter.uid),{uid:voter.uid,choice:selected,updatedAt:serverTimestamp()});localStorage.setItem(key,selected);render()}catch(error){if(status)status.textContent=error.code==='auth/operation-not-allowed'?'Las votaciones necesitan que se habilite el proveedor Anónimo en Firebase Authentication.':`No se pudo guardar tu voto. Código: ${error.code||'error'}`}});
render();

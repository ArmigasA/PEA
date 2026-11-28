import {auth,db} from './firebase-config.js';
import {signInAnonymously} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const key='pea-news-vote-project-pea';let current=localStorage.getItem(key);
function render(){document.querySelectorAll('[data-news-vote]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.newsVote===current)));const status=document.querySelector('.news-vote-status');if(status)status.textContent=current?'Gracias por tu Comentario. Esto nos Ayuda a saber sobre la Opinión Publica y Relevancia!':''}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-news-vote]');if(!button)return;const status=document.querySelector('.news-vote-status'),choice=button.dataset.newsVote;try{const voter=auth.currentUser||(await signInAnonymously(auth)).user;await setDoc(doc(db,'votes','news-project-pea','ballots',voter.uid),{uid:voter.uid,choice,updatedAt:serverTimestamp()});current=choice;localStorage.setItem(key,choice);render()}catch(error){if(status)status.textContent=error.code==='auth/operation-not-allowed'?'Las votaciones no están habilitadas todavía. Activa el proveedor Anónimo en Firebase Authentication.':`No se pudo guardar tu voto. Código: ${error.code||'error'}`}});
render();

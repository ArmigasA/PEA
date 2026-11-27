import {auth,db} from './firebase-config.js';
import {onAuthStateChanged,sendEmailVerification,reload,getIdToken} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,where,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const $=id=>document.getElementById(id);let user=null,rank='';
const message=(text,error=false)=>{$('parental-status').textContent=text;$('parental-status').classList.toggle('is-error',error)};
function card(title,description,actionText,action,extraText,extraAction){const el=document.createElement('article');el.className='profile-info parental-link-card';const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=description;el.append(h,p);if(action){const b=document.createElement('button');b.type='button';b.textContent=actionText;b.addEventListener('click',action);el.append(b)}if(extraAction){const b=document.createElement('button');b.type='button';b.textContent=extraText;b.addEventListener('click',extraAction);el.append(b)}return el}
function randomCode(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')}
async function refresh(){
  try{
    const snap=await getDoc(doc(db,'publicProfiles',user.uid));if(!snap.exists()){message('Primero completa y guarda tu perfil con el rango correspondiente.',true);return}
    rank=snap.data().rank||'';$('parental-content').hidden=false;
    if(rank==='Adulto'){
      $('adult-panel').hidden=false;$('send-verification').hidden=user.emailVerified;$('check-verification').hidden=user.emailVerified;
      if(!user.emailVerified){message('Verifica el correo de esta cuenta para poder vincular un estudiante.');return}
      message('Correo verificado. Puedes vincular una invitación de un estudiante.');await loadAdultLinks();
    }else if(rank==='Estudiante'){
      $('student-panel').hidden=false;message('Genera una invitación para tu adulto responsable.');await loadStudentLinks();
    }else message('Este panel requiere el rango Adulto o Estudiante.',true);
  }catch(error){message(`No se pudo cargar el panel. Código: ${error.code||'error'}`,true)}
}
async function loadAdultLinks(){
  const target=$('adult-links');target.replaceChildren();
  const result=await getDocs(query(collection(db,'parentLinks'),where('parentUid','==',user.uid)));
  for(const item of result.docs){const link=item.data(),student=await getDoc(doc(db,'publicProfiles',link.studentUid)),data=student.exists()?student.data():{};target.append(card(data.visibleName||'Estudiante vinculado',`Rango: ${data.rank||'—'} · ${data.bio||'Sin biografía pública.'}`,'DESVINCULAR',async()=>{if(confirm('¿Desvincular esta cuenta?')){await deleteDoc(item.ref);await loadAdultLinks()}}))}
  if(!result.size)target.append(card('Todavía no hay cuentas vinculadas','Cuando un estudiante comparta su código, podrás ingresarlo arriba.'));
}
async function loadStudentLinks(){
  const target=$('student-links');target.replaceChildren();
  const result=await getDocs(query(collection(db,'parentLinks'),where('studentUid','==',user.uid)));
  for(const item of result.docs){const link=item.data();const active=link.status==='active';const desc=active?'Vinculación activa con tu adulto responsable.':`Invitación pendiente para ${link.parentEmail}. Código: ${item.id}`;const remove=async()=>{if(confirm('¿Cancelar o quitar esta vinculación?')){await deleteDoc(item.ref);await loadStudentLinks()}};const copy=async()=>{try{await navigator.clipboard.writeText(item.id);message('Código copiado. Envíalo de forma privada a tu adulto responsable.')}catch{message(`Copia este código de forma privada: ${item.id}`)}};target.append(card(active?'Adulto responsable vinculado':'Invitación pendiente',desc,active?'DESVINCULAR':'COPIAR CÓDIGO',active?remove:copy,active?'': 'CANCELAR INVITACIÓN',active?null:remove))}
  if(!result.size)target.append(card('Sin vinculación','Todavía no hay una cuenta adulta vinculada.'));
}
$('create-invite').addEventListener('click',async()=>{
  const email=$('parent-email').value.trim().toLocaleLowerCase('es');if(!email||!email.includes('@')){message('Escribe un correo válido para tu adulto responsable.',true);return}if(email===user.email?.toLocaleLowerCase('es')){message('La cuenta Estudiante y la cuenta Adulto deben usar correos distintos.',true);return}
  try{const existing=await getDocs(query(collection(db,'parentLinks'),where('studentUid','==',user.uid)));if(existing.docs.some(item=>item.data().status==='active')){message('Ya tienes una cuenta adulta vinculada.',true);return}if(existing.docs.some(item=>item.data().status==='pending')){message('Cancela la invitación pendiente antes de generar otra.',true);return}
    const code=randomCode();await setDoc(doc(db,'parentLinks',code),{studentUid:user.uid,studentEmail:user.email,parentEmail:email,parentUid:null,status:'pending',createdAt:serverTimestamp(),acceptedAt:null});$('invite-code-output').textContent=`Comparte este código con tu adulto responsable: ${code}`;$('invite-code-output').hidden=false;$('copy-invite-code').hidden=false;message('Invitación creada. Comparte el código de forma privada.');await loadStudentLinks();
  }catch(error){message(`No se pudo crear la invitación. Código: ${error.code||'error'}`,true)}
});
$('claim-link').addEventListener('click',async()=>{
  if(!user.emailVerified){message('Primero verifica el correo de esta cuenta.',true);return}const code=$('claim-code').value.trim().toLowerCase();if(!/^[a-f0-9]{48}$/.test(code)){message('El código debe tener 48 caracteres hexadecimales.',true);return}
  try{const ref=doc(db,'parentLinks',code),invite=await getDoc(ref);if(!invite.exists()){message('No existe una invitación con ese código.',true);return}const data=invite.data();if(data.status!=='pending'){message('Esta invitación ya fue utilizada o cancelada.',true);return}if(data.parentEmail!==user.email.toLocaleLowerCase('es')){message('Inicia sesión con el correo al que se dirigió la invitación.',true);return}if(data.studentUid===user.uid){message('No puedes vincular tu cuenta contigo mismo.',true);return}
    await updateDoc(ref,{parentUid:user.uid,status:'active',acceptedAt:serverTimestamp()});$('claim-code').value='';message('Cuenta Estudiante vinculada correctamente.');await loadAdultLinks();
  }catch(error){message(`No se pudo vincular. Comprueba tu rango Adulto, correo verificado y que ambos correos sean distintos. Código: ${error.code||'error'}`,true)}
});
$('send-verification').addEventListener('click',async()=>{try{await sendEmailVerification(user,{url:location.href});message('Enviamos el enlace de verificación. Revisa tu correo y la carpeta de spam.')}catch(error){message(`No se pudo enviar el correo. Código: ${error.code||'error'}`,true)}});
$('check-verification').addEventListener('click',async()=>{try{await reload(user);user=auth.currentUser;await getIdToken(user,true);await refresh()}catch(error){message(`No se pudo revisar la verificación. Código: ${error.code||'error'}`,true)}});
$('copy-invite-code').addEventListener('click',async()=>{const code=$('invite-code-output').textContent.match(/[a-f0-9]{48}/)?.[0];if(!code)return;try{await navigator.clipboard.writeText(code);message('Código copiado. Envíalo de forma privada a tu adulto responsable.')}catch{message(`No se pudo copiar automáticamente. Código: ${code}`)}});
onAuthStateChanged(auth,authenticated=>{if(!authenticated){location.href=new URL('login/?return=parental/',document.baseURI).href;return}user=authenticated;refresh()});



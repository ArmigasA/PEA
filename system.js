import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const DEV_UID = 'Jj7pIHpuqBNzaRT5i9FSoqRWTnD3';
const $ = id => document.getElementById(id);
const panels = [...document.querySelectorAll('[data-system-panel]')];
const workspace = $('system-workspace');
const guard = $('system-guard');
let actor = null;
let authorized = false;
let codeMode = false;
let currentPage = null;
let latestVotes = [];
let latestAudit = [];
let draftTimer;

function announce(id, message, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-error', error);
}

function showPanel(name) {
  panels.forEach(button => button.setAttribute('aria-selected', String(button.dataset.systemPanel === name)));
  ['votes', 'users', 'editor', 'audit'].forEach(id => { $(`system-${id}`).hidden = id !== name; });
}

function lock(message) {
  authorized = false;
  workspace.hidden = true;
  guard.hidden = false;
  announce('system-status', message, true);
}

onAuthStateChanged(auth, async current => {
  actor = current;
  if (!current || current.isAnonymous) {
    sessionStorage.removeItem('pea-system-unlocked');
    lock('Acceso reservado al Equipo de Desarrollo. Inicia sesión con tu cuenta autorizada.');
    return;
  }
  if (sessionStorage.getItem('pea-system-unlocked') !== 'true') {
    lock('Abre SYSTEM desde la insignia de tu perfil para iniciar la verificación de acceso.');
    return;
  }
  try {
    const profile = await getDoc(doc(db, 'publicProfiles', current.uid));
    const data = profile.data();
    if (current.uid !== DEV_UID || !profile.exists() || data.rank !== 'Equipo de Desarrollo' || data.developerBadge !== true) {
      lock('Esta cuenta no está autorizada para utilizar SYSTEM.');
      return;
    }
    authorized = true;
    guard.hidden = true;
    workspace.hidden = false;
    $('system-user-name').textContent = data.visibleName || current.displayName || 'Equipo de Desarrollo';
    showPanel('votes');
  } catch (error) {
    lock(`No se pudieron verificar los permisos (${error.code || 'error'}).`);
  }
});

panels.forEach(button => button.addEventListener('click', () => {
  if (authorized) showPanel(button.dataset.systemPanel);
}));

function csvDownload(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function makeAudit(action, fields = {}) {
  return { actorUid: actor.uid, action, ...fields, createdAt: serverTimestamp() };
}

$('load-votes').addEventListener('click', async () => {
  if (!authorized) return;
  const survey = $('vote-survey').value;
  $('vote-results').replaceChildren(Object.assign(document.createElement('p'), { className: 'system-empty', textContent: 'Consultando votos…' }));
  try {
    const snap = await getDocs(collection(db, 'votes', survey, 'ballots'));
    const tally = { like: 0, neutral: 0, dislike: 0 };
    latestVotes = [];
    snap.forEach(item => {
      const ballot = item.data();
      if (Object.hasOwn(tally, ballot.choice)) tally[ballot.choice]++;
      latestVotes.push([item.id, ballot.choice, ballot.updatedAt?.toDate?.().toISOString() || '']);
    });
    const labels = [['like', 'Me gusta'], ['neutral', 'Neutral'], ['dislike', 'No me gusta']];
    const box = $('vote-results');
    box.replaceChildren();
    const cards = document.createElement('div'); cards.className = 'vote-summary';
    labels.filter(([key]) => survey === 'news-project-pea' || key !== 'neutral').forEach(([key, label]) => {
      const card = document.createElement('article');
      const count = document.createElement('strong'); count.textContent = tally[key];
      const name = document.createElement('span'); name.textContent = label;
      const progress = document.createElement('progress'); progress.max = Math.max(snap.size, 1); progress.value = tally[key]; progress.setAttribute('aria-label', `${label}: ${tally[key]} votos`);
      card.append(count, name, progress); cards.append(card);
    });
    const total = document.createElement('p'); total.textContent = `Total de votos vigentes: ${snap.size}. Los votos se muestran agregados, sin correos ni nombres.`;
    cards.append(total); box.append(cards);
    $('export-votes').disabled = latestVotes.length === 0;
    const batch = writeBatch(db);
    const audit = doc(collection(db, 'systemAudit'));
    batch.set(audit, makeAudit('read_votes', { contentId: survey }));
    await batch.commit();
  } catch (error) {
    announce('vote-results', `No se pudieron consultar los votos (${error.code || 'revisa Firestore Rules'}).`, true);
  }
});

$('export-votes').addEventListener('click', () => {
  if (!authorized || !latestVotes.length) return;
  csvDownload(`pea-votos-${$('vote-survey').value}.csv`, [['ID anónimo', 'Opción', 'Fecha'], ...latestVotes]);
});

$('user-lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!authorized) return;
  const uid = $('target-uid').value.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return announce('user-status', 'El UID no tiene un formato válido.', true);
  if (uid === actor.uid) return announce('user-status', 'No puedes modificar tu propio rango desde este panel.', true);
  announce('user-status', 'Buscando perfil…');
  try {
    const [profile, role] = await Promise.all([getDoc(doc(db, 'publicProfiles', uid)), getDoc(doc(db, 'adminRoles', uid))]);
    if (!profile.exists()) { $('user-result').hidden = true; return announce('user-status', 'No existe un perfil público para ese UID.', true); }
    const data = profile.data();
    $('target-name').textContent = data.displayName || 'Sin nombre visible';
    $('target-rank').textContent = `Rango: ${data.rank || 'Usuario'}`;
    $('target-bio').textContent = data.bio || 'Sin biografía';
    $('target-uid-display').textContent = uid;
    $('user-result').hidden = false;
    const activeGob = role.exists() && role.data().active === true;
    $('grant-gob').disabled = activeGob || data.rank === 'Equipo de Desarrollo' || data.rank === 'GOB';
    $('revoke-gob').disabled = !activeGob;
    announce('user-status', activeGob ? 'Cuenta con rango GOB asignado. Puedes restaurar su rango anterior.' : 'Perfil cargado. Solo se muestran datos del perfil público, nunca correo ni credenciales.');
  } catch (error) { announce('user-status', `No se pudo consultar el perfil (${error.code || 'error'}).`, true); }
});

async function changeGob(grant) {
  if (!authorized) return;
  const uid = $('target-uid').value.trim();
  const profileRef = doc(db, 'publicProfiles', uid);
  const roleRef = doc(db, 'adminRoles', uid);
  const auditRef = doc(collection(db, 'systemAudit'));
  try {
    const [profile, role] = await Promise.all([getDoc(profileRef), getDoc(roleRef)]);
    if (!profile.exists()) throw new Error('No existe el perfil.');
    const batch = writeBatch(db);
    if (grant) {
      const currentRank = profile.data().rank || 'Usuario';
      if (!['Usuario', 'Estudiante', 'Profesor', 'Adulto'].includes(currentRank)) throw new Error('Solo se puede asignar GOB a un rango estándar.');
      if (role.exists() && role.data().active) throw new Error('La cuenta ya tiene GOB.');
      batch.set(roleRef, { uid, active: true, previousRank: currentRank, grantedBy: actor.uid, grantedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(profileRef, { rank: 'GOB', developerBadge: false, updatedAt: serverTimestamp() });
      batch.set(auditRef, makeAudit('grant_gob', { targetUid: uid }));
    } else {
      if (!role.exists() || !role.data().active || profile.data().rank !== 'GOB') throw new Error('No hay una asignación GOB activa que pueda restaurarse.');
      const previousRank = role.data().previousRank;
      batch.update(roleRef, { active: false, revokedBy: actor.uid, updatedAt: serverTimestamp() });
      batch.update(profileRef, { rank: previousRank, developerBadge: false, updatedAt: serverTimestamp() });
      batch.set(auditRef, makeAudit('revoke_gob', { targetUid: uid }));
    }
    await batch.commit();
    $('user-lookup-form').requestSubmit();
    announce('user-status', grant ? 'Rango GOB asignado. Se guardó el rango previo para poder restaurarlo.' : 'Rango anterior restaurado.');
  } catch (error) { announce('user-status', `No se pudo completar el cambio: ${error.message || error.code || 'error'}`, true); }
}
$('grant-gob').addEventListener('click', () => changeGob(true));
$('revoke-gob').addEventListener('click', () => changeGob(false));

const editor = $('visual-editor');
const editorHtml = () => codeMode ? $('code-editor').value : editor.innerHTML;
const draftKey = id => `pea-system-draft-${id}`;
const safePages = new Set([...$('page-select').options].map(option => option.value));

function sanitizeHtml(source) {
  const parsed = new DOMParser().parseFromString(`<main>${source}</main>`, 'text/html');
  const allowed = new Set('MAIN SECTION ARTICLE DIV P SPAN STRONG B EM I U H1 H2 H3 H4 UL OL LI BLOCKQUOTE HR BR A BUTTON IMG FIGURE FIGCAPTION TABLE THEAD TBODY TR TH TD'.split(' '));
  parsed.querySelectorAll('script,style,iframe,object,embed,form,input,textarea,select,svg,math,link,meta,video,audio,source').forEach(node => node.remove());
  [...parsed.body.querySelectorAll('*')].forEach(node => {
    if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || !['class','id','title','role','aria-label','aria-labelledby','href','target','rel','src','alt','type','data-action','data-target','data-href','data-vote','data-survey-id','data-news-vote','width','height','colspan','rowspan'].includes(name)) { node.removeAttribute(attribute.name); return; }
      if (name === 'href' || name === 'src') {
        try { const url = new URL(attribute.value, location.href); if (name === 'href' && !['http:','https:','mailto:','#'].some(protocol => protocol === url.protocol || attribute.value.startsWith(protocol))) node.removeAttribute(name); if (name === 'src' && !['http:','https:','data:'].includes(url.protocol)) node.removeAttribute(name); }
        catch { node.removeAttribute(name); }
      }
    });
    if (node.tagName === 'A' && node.target === '_blank') node.rel = 'noopener noreferrer';
    if (node.tagName === 'IMG' && node.getAttribute('src')?.startsWith('data:') && !/^data:image\/(png|jpeg|webp);base64,/i.test(node.getAttribute('src'))) node.remove();
  });
  return parsed.body.querySelector('main').innerHTML;
}

function sanitizeCss(source, pageId) {
  const properties = new Set('color background background-color font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration margin margin-top margin-bottom padding border border-color border-radius max-width width height display gap box-shadow'.split(' '));
  const prefix = `body[data-cms-page="${pageId}"] main`;
  const output = [];
  if (source.length > 16000) throw new Error('El CSS supera el límite de 16 KB.');
  for (const block of source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim();
    if (!selector || selector.startsWith('@') || /[<>\\]|:has\s*\(|:root|body|html|\*|\[/.test(selector)) continue;
    const declarations = [];
    for (const declaration of block[2].split(';')) {
      const colon = declaration.indexOf(':'); if (colon < 1) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!properties.has(property) || !value || value.length > 180 || /url\s*\(|var\s*\(|expression|javascript:|@import|!important|[<>\\]|\b(?:fixed|sticky)\b/i.test(value)) continue;
      declarations.push(`${property}:${value}`);
    }
    if (declarations.length) output.push(`${prefix} ${selector}{${declarations.join(';')}}`);
  }
  return output.join('\n');
}

function unscopeCss(css, pageId) {
  const escaped = pageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.replace(new RegExp(`body\\[data-cms-page=["']${escaped}["']\\]\\s+main\\s+`, 'g'), '');
}

function saveDraft() {
  if (!authorized || !currentPage) return;
  clearTimeout(draftTimer);
  $('draft-status').textContent = 'Guardando borrador local…';
  draftTimer = setTimeout(() => {
    localStorage.setItem(draftKey(currentPage), JSON.stringify({ html: editorHtml(), css: $('css-editor').value, savedAt: new Date().toISOString() }));
    $('draft-status').textContent = 'Borrador guardado en este navegador.';
  }, 450);
}

editor.addEventListener('input', saveDraft);
$('code-editor').addEventListener('input', saveDraft);
$('css-editor').addEventListener('input', saveDraft);

async function loadHistory(pageId) {
  const select = $('history-select'); select.replaceChildren(new Option('Cargando historial…', '')); select.disabled = true; $('load-version').disabled = true;
  const historyQuery = query(collection(db, 'sitePageRevisions', pageId, 'versions'), orderBy('snapshotAt', 'desc'), limit(25));
  const snapshot = await getDocs(historyQuery);
  select.replaceChildren(new Option(snapshot.empty ? 'Sin versiones anteriores' : 'Selecciona una versión…', ''));
  snapshot.forEach(item => {
    const data = item.data(); const date = data.snapshotAt?.toDate?.().toLocaleString('es-AR') || 'fecha no disponible';
    select.add(new Option(`${date} · ${item.id.slice(0, 8)}`, item.id));
  });
  select.disabled = snapshot.empty;
  $('load-version').disabled = snapshot.empty;
}

$('history-select').addEventListener('change', () => { $('load-version').disabled = !$('history-select').value; });
$('load-version').addEventListener('click', async () => {
  if (!authorized || !currentPage || !$('history-select').value) return;
  try {
    const version = await getDoc(doc(db, 'sitePageRevisions', currentPage, 'versions', $('history-select').value));
    if (!version.exists()) throw new Error('La versión ya no está disponible.');
    editor.innerHTML = sanitizeHtml(version.data().mainHtml || ''); $('code-editor').value = editor.innerHTML;
    $('css-editor').value = unscopeCss(version.data().customCss || '', currentPage);
    announce('editor-status', 'Versión cargada en el editor. Revisa el contenido antes de publicar.');
  } catch (error) { announce('editor-status', `No se pudo cargar la versión (${error.code || error.message || 'error'}).`, true); }
});

$('load-page').addEventListener('click', async () => {
  if (!authorized) return;
  const pageId = $('page-select').value; currentPage = pageId;
  announce('editor-status', 'Cargando contenido publicado e historial…');
  try {
    const [published, source] = await Promise.all([getDoc(doc(db, 'sitePages', pageId)), fetch(`${pageId}.html`, { cache: 'no-store' })]);
    let html;
    if (published.exists()) {
      const content = published.data(); html = content.mainHtml || ''; $('css-editor').value = unscopeCss(content.customCss || '', pageId); $('published-state').textContent = `PUBLICADO · ${content.updatedAt?.toDate?.().toLocaleString('es-AR') || 'fecha no disponible'}`;
    } else if (source.ok) {
      const parsed = new DOMParser().parseFromString(await source.text(), 'text/html');
      html = parsed.querySelector('main')?.innerHTML || parsed.body.innerHTML; $('css-editor').value = ''; $('published-state').textContent = 'HTML ORIGINAL';
    } else throw new Error('No se pudo leer el HTML. Usa IMPORTAR HTML como alternativa.');
    const draft = localStorage.getItem(draftKey(pageId));
    if (draft && confirm('Hay un borrador local de esta página. ¿Quieres cargarlo en lugar del contenido publicado?')) {
      const saved = JSON.parse(draft); html = saved.html; $('css-editor').value = saved.css || '';
    }
    editor.innerHTML = sanitizeHtml(html); $('code-editor').value = editor.innerHTML; codeMode = false; editor.hidden = false; $('code-editor').hidden = true;
    await loadHistory(pageId);
    announce('editor-status', published.exists() ? 'Publicación cargada. El historial conserva hasta 25 versiones.' : 'HTML original cargado. Al guardar, se publicará una copia segura en Firestore.');
  } catch (error) { announce('editor-status', `No se pudo abrir la página: ${error.message || error.code || 'error'}`, true); }
});

$('import-html').addEventListener('change', async () => {
  const file = $('import-html').files[0]; if (!file || !authorized) return;
  if (file.size > 650000) return announce('editor-status', 'El HTML supera el límite de 650 KB.', true);
  try {
    const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
    editor.innerHTML = sanitizeHtml(parsed.querySelector('main')?.innerHTML || parsed.body.innerHTML);
    $('code-editor').value = editor.innerHTML; codeMode = false; editor.hidden = false; $('code-editor').hidden = true; saveDraft();
    announce('editor-status', 'HTML importado y limpiado. Revisa los cambios y usa Vista previa.');
  } catch (error) { announce('editor-status', `No se pudo importar el archivo (${error.message}).`, true); }
  $('import-html').value = '';
});

$('editor-visual-mode').addEventListener('click', () => {
  if (!codeMode) return;
  editor.innerHTML = sanitizeHtml($('code-editor').value); codeMode = false; editor.hidden = false; $('code-editor').hidden = true;
  $('editor-visual-mode').setAttribute('aria-pressed', 'true'); $('editor-code-mode').setAttribute('aria-pressed', 'false'); saveDraft();
});
$('editor-code-mode').addEventListener('click', () => {
  if (codeMode) return;
  $('code-editor').value = editor.innerHTML; codeMode = true; editor.hidden = true; $('code-editor').hidden = false;
  $('editor-code-mode').setAttribute('aria-pressed', 'true'); $('editor-visual-mode').setAttribute('aria-pressed', 'false');
});
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => {
  if (!authorized || codeMode) return;
  editor.focus(); document.execCommand(button.dataset.command, false, button.dataset.value || null); saveDraft();
}));
$('editor-image').addEventListener('change', () => {
  const file = $('editor-image').files[0]; if (!file || !authorized) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 160000) { announce('editor-status', 'Usa una imagen PNG, JPEG o WebP de hasta 160 KB.', true); return; }
  const reader = new FileReader(); reader.onload = () => { const image = document.createElement('img'); image.src = reader.result; image.alt = 'Ilustración añadida por el equipo editorial'; image.style.maxWidth = '100%'; editor.append(image); saveDraft(); }; reader.readAsDataURL(file); $('editor-image').value = '';
});

$('preview-page').addEventListener('click', () => {
  if (!authorized || !currentPage) return announce('editor-status', 'Abre primero una página.', true);
  try {
    const html = sanitizeHtml(editorHtml()); const css = sanitizeCss($('css-editor').value, currentPage);
    const frame = $('editor-preview'); frame.hidden = false; frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${new URL('styles.css', document.baseURI).href}"><style>${css}</style></head><body data-cms-page="${currentPage}"><main>${html}</main></body></html>`;
    announce('editor-status', 'Vista previa aislada. Los scripts y estilos no permitidos fueron descartados.');
  } catch (error) { announce('editor-status', error.message, true); }
});

async function savePage(reset = false) {
  if (!authorized || !currentPage) return announce('editor-status', 'Abre primero una página.', true);
  if (!confirm(reset ? '¿Retirar la publicación de Firestore para volver al HTML original? Se guardará una copia en el historial.' : '¿Confirmas publicar los cambios de esta página? Se guardará una copia de seguridad.')) return;
  announce('editor-status', reset ? 'Restaurando HTML original…' : 'Guardando y publicando…');
  try {
    const ref = doc(db, 'sitePages', currentPage); const existing = await getDoc(ref); const batch = writeBatch(db);
    if (existing.exists()) {
      const current = existing.data();
      const revision = doc(collection(db, 'sitePageRevisions', currentPage, 'versions'));
      batch.set(revision, { mainHtml: current.mainHtml || '', customCss: current.customCss || '', snapshotBy: actor.uid, snapshotAt: serverTimestamp() });
    }
    batch.set(doc(collection(db, 'systemAudit')), makeAudit(reset ? 'reset_page' : 'publish_page', { pageId: currentPage }));
    if (reset) batch.delete(ref);
    else {
      const html = sanitizeHtml(editorHtml()); const css = sanitizeCss($('css-editor').value, currentPage);
      if (html.length > 650000) throw new Error('El HTML supera el límite de 650 KB.');
      batch.set(ref, { mainHtml: html, customCss: css, updatedBy: actor.uid, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    localStorage.removeItem(draftKey(currentPage)); $('draft-status').textContent = 'Borrador local eliminado tras publicar.';
    if (reset) { $('published-state').textContent = 'HTML ORIGINAL'; announce('editor-status', 'Publicación retirada; se muestra nuevamente el HTML original.'); }
    else { $('published-state').textContent = `PUBLICADO · ${new Date().toLocaleString('es-AR')}`; announce('editor-status', 'Publicación guardada. La versión anterior quedó en el historial.'); }
    await loadHistory(currentPage);
  } catch (error) { announce('editor-status', `No se pudo guardar (${error.code || error.message || 'revisa Firestore Rules'}).`, true); }
}
$('save-page').addEventListener('click', () => savePage(false));
$('reset-page').addEventListener('click', () => savePage(true));

$('load-audit').addEventListener('click', async () => {
  if (!authorized) return;
  const box = $('audit-results'); box.textContent = 'Cargando actividad…';
  try {
    const auditQuery = query(collection(db, 'systemAudit'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(auditQuery); latestAudit = [];
    const table = document.createElement('table'); table.className = 'system-audit-table';
    const head = table.createTHead().insertRow(); ['Fecha', 'Acción', 'Destino', 'Cuenta de origen'].forEach(label => { const th = document.createElement('th'); th.textContent = label; head.append(th); });
    const body = table.createTBody();
    snap.forEach(item => {
      const data = item.data(); const date = data.createdAt?.toDate?.().toLocaleString('es-AR') || 'Pendiente';
      const target = data.pageId || data.contentId || (data.targetUid ? `${data.targetUid.slice(0, 6)}…` : '—');
      const row = [date, data.action || '—', target, data.actorUid || '—']; latestAudit.push(row);
      const tr = body.insertRow(); row.forEach(value => { const td = tr.insertCell(); td.textContent = value; });
    });
    box.replaceChildren(table); $('export-audit').disabled = latestAudit.length === 0;
  } catch (error) { box.textContent = `No se pudo cargar la actividad (${error.code || 'error'}).`; }
});
$('export-audit').addEventListener('click', () => { if (authorized && latestAudit.length) csvDownload('pea-registro-system.csv', [['Fecha', 'Acción', 'Destino', 'UID de origen'], ...latestAudit]); });

$('system-signout').addEventListener('click', async () => {
  sessionStorage.removeItem('pea-system-unlocked');
  try { const { signOut } = await import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'); await signOut(auth); location.href = 'perfil/'; }
  catch (error) { announce('system-status', `No se pudo cerrar la sesión (${error.code || 'error'}).`, true); }
});

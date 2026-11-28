(()=>{
 const config=()=>{try{return JSON.parse(localStorage.getItem('pea-site-settings')||'{}')}catch{return {}}};
 const modes=['christmas','console','infantil','kawaii'];let effects=[],snowTimer;
 const reduce=()=>{const p=config();return p.epilepsy===true||p.animations===false||matchMedia('(prefers-reduced-motion: reduce)').matches};
 function clean(){effects.forEach(node=>node.remove());effects=[];clearInterval(snowTimer)}
 function makeSnow(count){const layer=document.createElement('div');layer.className='pea-snow-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);effects.push(layer);for(let i=0;i<count;i++){const flake=document.createElement('i');flake.textContent=['❄','✣','•'][Math.floor(Math.random()*3)];flake.style.left=`${Math.random()*100}%`;flake.style.fontSize=`${9+Math.random()*18}px`;flake.style.animationDuration=`${8+Math.random()*14}s`;flake.style.animationDelay=`${-Math.random()*18}s`;layer.append(flake)}}
 function render(){clean();const p=config(),mode=document.body.classList.contains('authenticated')?(p.visualMode||'standard'):'standard';if(!modes.includes(mode)||reduce()){if(mode==='kawaii'&&!reduce()){}return}
  if(mode==='christmas'){makeSnow(Math.max(1,Math.min(200,Number(p.snowCount)||70)))}
  if(mode==='kawaii'){const img=document.createElement('img');img.src=new URL('kawai.gif',document.baseURI).href;img.alt='';img.className='kawaii-companion';img.setAttribute('aria-hidden','true');document.body.append(img);effects.push(img)}
 }
 document.addEventListener('pea-effects-updated',render);document.addEventListener('pea-auth-state',render);window.addEventListener('storage',event=>{if(event.key==='pea-site-settings')render()});render();
 document.addEventListener('click',event=>{if(!document.body.classList.contains('authenticated')||reduce()||!document.body.classList.contains('console'))return;const target=event.target.closest('button,a,.feature-card,.resource-card,.profile-info');if(!target)return;for(let i=0;i<10;i++){const bit=document.createElement('span');bit.className='binary-fall';bit.textContent=Math.random()<.5?'0':'1';bit.style.left=`${Math.min(98,Math.max(2,event.clientX+(Math.random()-.5)*260))}px`;bit.style.top=`${Math.max(0,event.clientY-40)}px`;bit.style.animationDuration=`${1.4+Math.random()*2.3}s`;document.body.append(bit);setTimeout(()=>bit.remove(),4000)}});
})();

(()=>{
const STORE='family-home-lists';
let timer=null,drag=null,ghost=null,target=null,startX=0,startY=0,lastX=0,lastY=0,suppressClick=false,scrollRaf=0,scrollDir=0;
const css=`
.categoryGroups .item,.categoryGroups .item *{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.categoryGroup.fhDropTarget>.categoryHeader{background:#dce9ff!important;box-shadow:inset 0 0 0 2px #5b8ee6;transform:scale(1.01);transition:.12s ease}
.fhDragGhost{position:fixed;z-index:99998;height:50px;display:flex;align-items:center;padding:0 18px;border-radius:13px;background:#fff;box-shadow:0 12px 35px #0003;font:17px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10232d;pointer-events:none;opacity:.98;will-change:transform;box-sizing:border-box}
.fhDraggingSource{opacity:.22!important}.fhDragHint{position:fixed;z-index:99997;left:50%;bottom:max(92px,calc(env(safe-area-inset-bottom) + 76px));transform:translateX(-50%);padding:8px 13px;border-radius:999px;background:#171717;color:#fff;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;white-space:nowrap}
body.fhDragging,body.fhDragging *{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important}
`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const norm=s=>String(s||'').trim();
function market(){try{const lists=JSON.parse(localStorage.getItem(STORE)||'[]');return{lists,list:lists.find(l=>l.id==='market'||String(l.name||'').toUpperCase().includes('MERCADO'))}}catch{return{lists:[],list:null}}}
function infoFor(row){const group=row.closest('.categoryGroup'),name=norm(row.querySelector('.itemName')?.textContent);if(!group||!name)return null;const header=norm(group.querySelector('.categoryHeader strong')?.textContent),{list}=market();const cat=(list?.categories||[]).find(c=>norm(c.name)===header);const item=list?.items?.find(i=>norm(i.name)===name&&(i.category||'other')===(cat?.id||'other'));return item&&cat?{item,cat}:null}
function clearTarget(){target?.classList.remove('fhDropTarget');target=null}
function stopScroll(){scrollDir=0;if(scrollRaf)cancelAnimationFrame(scrollRaf);scrollRaf=0}
function autoScroll(){if(!drag||!scrollDir){scrollRaf=0;return}window.scrollBy(0,scrollDir*8);updateTarget(lastX,lastY);scrollRaf=requestAnimationFrame(autoScroll)}
function setScroll(y){const next=y<105?-1:y>innerHeight-115?1:0;if(next===scrollDir)return;stopScroll();scrollDir=next;if(next)scrollRaf=requestAnimationFrame(autoScroll)}
function cancel(){clearTimeout(timer);timer=null;stopScroll();if(!drag)return;drag.row.classList.remove('fhDraggingSource');ghost?.remove();document.querySelector('.fhDragHint')?.remove();document.body.classList.remove('fhDragging');clearTarget();drag=null;ghost=null}
function activate(row,x,y){const info=infoFor(row);if(!info)return;const r=row.getBoundingClientRect();drag={row,...info,width:r.width,offsetX:Math.max(24,Math.min(r.width-24,x-r.left))};suppressClick=true;row.classList.add('fhDraggingSource');document.body.classList.add('fhDragging');ghost=document.createElement('div');ghost.className='fhDragGhost';ghost.textContent=info.item.name;ghost.style.width=`${r.width}px`;ghost.style.left=`${r.left}px`;ghost.style.top='0';document.body.append(ghost);const hint=document.createElement('div');hint.className='fhDragHint';hint.textContent='Solte sobre outra categoria';document.body.append(hint);moveGhost(x,y);updateTarget(x,y);navigator.vibrate?.(18)}
function moveGhost(x,y){if(!ghost||!drag)return;const half=25;const top=Math.max(8,Math.min(innerHeight-58,y-half));ghost.style.transform=`translate3d(0,${top}px,0)`}
function categoryAt(x,y){const hit=document.elementFromPoint(x,y);return hit?.closest?.('.categoryGroup')||null}
function updateTarget(x,y){const g=categoryAt(x,y);if(g===target)return;clearTarget();target=g;if(target)target.classList.add('fhDropTarget')}
function moveActive(x,y){lastX=x;lastY=y;moveGhost(x,y);updateTarget(x,y);setScroll(y)}
function saveDrop(){if(!drag||!target)return false;const targetName=norm(target.querySelector('.categoryHeader strong')?.textContent),{lists,list}=market();if(!list)return false;const cat=(list.categories||[]).find(c=>norm(c.name)===targetName);if(!cat||cat.id===drag.cat.id)return false;const item=list.items.find(i=>i.id===drag.item.id);if(!item)return false;item.category=cat.id;localStorage.setItem(STORE,JSON.stringify(lists));localStorage.setItem('family-home-last-category',cat.id);return true}
function begin(row,x,y){startX=lastX=x;startY=lastY=y;clearTimeout(timer);timer=setTimeout(()=>activate(row,lastX,lastY),300)}
function preMove(x,y){lastX=x;lastY=y;if(Math.hypot(x-startX,y-startY)>10){clearTimeout(timer);timer=null}}
function finish(){clearTimeout(timer);timer=null;if(!drag)return;const changed=saveDrop();cancel();if(changed)setTimeout(()=>location.reload(),40)}
// Touch is handled separately because iOS Safari may cancel Pointer Events when a vertical gesture begins.
document.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const row=e.target.closest?.('.categoryGroups .item');if(!row||e.target.closest('.itemCheck'))return;const t=e.touches[0];begin(row,t.clientX,t.clientY)},{capture:true,passive:true});
document.addEventListener('touchmove',e=>{if(e.touches.length!==1)return;const t=e.touches[0];if(!drag){preMove(t.clientX,t.clientY);return}e.preventDefault();moveActive(t.clientX,t.clientY)},{capture:true,passive:false});
document.addEventListener('touchend',finish,true);
document.addEventListener('touchcancel',cancel,true);
// Mouse/trackpad support for desktop and Android devices that expose a mouse pointer.
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||(e.pointerType==='mouse'&&e.button!==0))return;const row=e.target.closest?.('.categoryGroups .item');if(!row||e.target.closest('.itemCheck'))return;begin(row,e.clientX,e.clientY)},true);
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;if(!drag){preMove(e.clientX,e.clientY);return}e.preventDefault();moveActive(e.clientX,e.clientY)},{capture:true,passive:false});
document.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')finish()},true);
document.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')cancel()},true);
document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.categoryGroups .item'))e.preventDefault()},true);
document.addEventListener('selectstart',e=>{if(e.target.closest?.('.categoryGroups .item'))e.preventDefault()},true);
document.addEventListener('click',e=>{if(!suppressClick)return;suppressClick=false;e.preventDefault();e.stopImmediatePropagation()},true);
})();
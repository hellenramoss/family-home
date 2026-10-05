(()=>{
const STORE='family-home-lists';
let timer=null,drag=null,ghost=null,target=null,startX=0,startY=0,lastY=0,suppressClick=false;
const css=`
.categoryGroup.fhDropTarget>.categoryHeader{background:#dce9ff!important;box-shadow:inset 0 0 0 2px #5b8ee6;transform:scale(1.01)}
.fhDragGhost{position:fixed;z-index:99998;left:16px;right:16px;height:50px;display:flex;align-items:center;padding:0 18px;border-radius:13px;background:#fff;box-shadow:0 12px 35px #0003;font:17px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10232d;pointer-events:none;transform:translateY(-25px);opacity:.97}
.fhDraggingSource{opacity:.28}.fhDragHint{position:fixed;z-index:99997;left:50%;bottom:max(92px,calc(env(safe-area-inset-bottom) + 76px));transform:translateX(-50%);padding:8px 13px;border-radius:999px;background:#171717;color:#fff;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;white-space:nowrap}
body.fhDragging{user-select:none;-webkit-user-select:none;overflow:hidden}
`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const norm=s=>String(s||'').trim();
function market(){try{const lists=JSON.parse(localStorage.getItem(STORE)||'[]');return{lists,list:lists.find(l=>l.id==='market'||String(l.name||'').toUpperCase().includes('MERCADO'))}}catch{return{lists:[],list:null}}}
function infoFor(row){const group=row.closest('.categoryGroup'),name=norm(row.querySelector('.itemName')?.textContent);if(!group||!name)return null;const header=norm(group.querySelector('.categoryHeader strong')?.textContent),{list}=market();const cat=(list?.categories||[]).find(c=>norm(c.name)===header);const item=list?.items?.find(i=>norm(i.name)===name&&(i.category||'other')===(cat?.id||'other'));return item&&cat?{item,cat}:null}
function clearTarget(){target?.classList.remove('fhDropTarget');target=null}
function cancel(){clearTimeout(timer);timer=null;if(!drag)return;drag.row.classList.remove('fhDraggingSource');ghost?.remove();document.querySelector('.fhDragHint')?.remove();document.body.classList.remove('fhDragging');clearTarget();drag=null;ghost=null}
function activate(row,x,y){const info=infoFor(row);if(!info)return;drag={row,...info};suppressClick=true;row.classList.add('fhDraggingSource');document.body.classList.add('fhDragging');ghost=document.createElement('div');ghost.className='fhDragGhost';ghost.textContent=info.item.name;document.body.append(ghost);const hint=document.createElement('div');hint.className='fhDragHint';hint.textContent='Solte sobre outra categoria';document.body.append(hint);moveGhost(y);navigator.vibrate?.(18)}
function moveGhost(y){if(ghost)ghost.style.top=`${Math.max(30,Math.min(innerHeight-70,y))}px`}
function categoryAt(x,y){const hit=document.elementFromPoint(x,y);return hit?.closest?.('.categoryGroup')||null}
function move(e){lastY=e.clientY;if(!drag){if(Math.hypot(e.clientX-startX,e.clientY-startY)>9){clearTimeout(timer);timer=null}return}e.preventDefault();moveGhost(e.clientY);const g=categoryAt(e.clientX,e.clientY);if(g!==target){clearTarget();target=g;if(target)target.classList.add('fhDropTarget')}if(e.clientY<95)scrollBy(0,-10);else if(e.clientY>innerHeight-100)scrollBy(0,10)}
function saveDrop(){if(!drag||!target)return false;const targetName=norm(target.querySelector('.categoryHeader strong')?.textContent),{lists,list}=market();if(!list)return false;const cat=(list.categories||[]).find(c=>norm(c.name)===targetName);if(!cat||cat.id===drag.cat.id)return false;const item=list.items.find(i=>i.id===drag.item.id);if(!item)return false;item.category=cat.id;localStorage.setItem(STORE,JSON.stringify(lists));localStorage.setItem('family-home-last-category',cat.id);return true}
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const row=e.target.closest?.('.categoryGroups .item');if(!row||e.target.closest('.itemCheck'))return;startX=e.clientX;startY=e.clientY;lastY=e.clientY;clearTimeout(timer);timer=setTimeout(()=>activate(row,startX,lastY),360)},true);
document.addEventListener('pointermove',move,{capture:true,passive:false});
document.addEventListener('pointerup',()=>{clearTimeout(timer);timer=null;if(!drag)return;const changed=saveDrop();cancel();if(changed)setTimeout(()=>location.reload(),90)},true);
document.addEventListener('pointercancel',cancel,true);
document.addEventListener('click',e=>{if(!suppressClick)return;suppressClick=false;e.preventDefault();e.stopImmediatePropagation()},true);
})();
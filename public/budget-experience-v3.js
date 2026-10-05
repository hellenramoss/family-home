(()=>{
const BK='fh-budget-v1',LK='family-home-lists',VIEW='fh-budget-view-v1';
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const parseMoney=v=>Number(String(v||'0').replace(/\./g,'').replace(',','.'))||0;
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const monthKey=(offset=0)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
const monthLabel=key=>new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
function data(){let b=get(BK,null);if(!b)b={categories:[{id:'fuel',name:'Gasolina',emoji:'⛽',limit:600},{id:'pets',name:'Pets',emoji:'🐶',limit:500},{id:'market',name:'Mercado',emoji:'🛒',limit:1200}],transactions:[]};b.categories=Array.isArray(b.categories)?b.categories:[];b.transactions=Array.isArray(b.transactions)?b.transactions:[];return b}
function finalizedGroups(){
 const lists=get(LK,[]),m=lists.find(l=>l.id==='market'||String(l.name||'').toUpperCase().includes('MERCADO'));if(!m)return[];
 const activeTimes=new Set((m.items||[]).map(i=>i.recordedPurchaseAt).filter(Boolean)),groups=new Map();
 (m.purchaseHistory||[]).forEach(p=>{
   const ts=String(p.purchasedAt||'');if(!ts)return;
   const manual=/T12:00:00(?:\.000)?Z$/.test(ts)&&!activeTimes.has(ts);if(manual)return;
   if(!groups.has(ts))groups.set(ts,[]);groups.get(ts).push(p)
 });
 return[...groups.entries()].map(([ts,items])=>({ts,items,total:items.reduce((s,p)=>s+parseMoney(p.price),0)})).filter(g=>g.total>0)
}
function sync(){
 const b=data();let cat=b.categories.find(c=>c.id==='market')||b.categories.find(c=>String(c.name||'').toLowerCase()==='mercado');
 if(!cat){cat={id:'market',name:'Mercado',emoji:'🛒',limit:0};b.categories.push(cat)}
 const groups=finalizedGroups();
 b.transactions=b.transactions.filter(t=>!(t.source==='market'||t.source==='market-group'||t.source==='market-shadow'));
 groups.forEach(g=>{
   const ids=g.items.map(x=>x.id);
   b.transactions.push({id:`market-group-${g.ts}`,categoryId:cat.id,amount:g.total,description:`Compra de mercado · ${g.items.length} ${g.items.length===1?'item':'itens'}`,date:g.ts.slice(0,10),source:'market-group',sourcePurchaseIds:ids,sourcePurchaseAt:g.ts});
   ids.forEach(id=>b.transactions.push({id:`market-shadow-${id}`,categoryId:cat.id,amount:0,description:'',date:g.ts.slice(0,10),source:'market-shadow',sourcePurchaseId:id,hidden:true}))
 });
 put(BK,b)
}
function modal(title,html,onSave){
 document.querySelector('.fhBudgetEditModal')?.remove();
 const o=document.createElement('div');o.className='fhModal fhBudgetEditModal';
 o.innerHTML=`<section><header><button type="button" data-close>×</button><h2>${esc(title)}</h2><button type="button" data-save>Salvar</button></header><form>${html}</form></section>`;
 o.querySelector('[data-close]').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};o.querySelector('[data-save]').onclick=()=>onSave(o.querySelector('form'),o);document.body.append(o);return o
}
function editTx(id){
 const b=data(),t=b.transactions.find(x=>x.id===id);if(!t||t.hidden)return;
 const c=b.categories.find(x=>x.id===t.categoryId),auto=t.source==='market-group';
 const o=modal(auto?'Compra do Mercado':'Editar gasto',`${auto?'<div class="fhAutoNote">🛒 Este gasto veio de uma compra finalizada no Mercado. O valor acompanha o histórico da compra.</div>':`<label>Categoria<select name="category">${b.categories.map(x=>`<option value="${x.id}" ${x.id===t.categoryId?'selected':''}>${esc(x.emoji)} ${esc(x.name)}</option>`).join('')}</select></label><label>Valor<input name="amount" inputmode="decimal" value="${String(t.amount).replace('.',',')}"></label>`}<label>Descrição<input name="description" value="${esc(t.description||c?.name||'')}"></label><label>Data<input name="date" type="date" value="${esc(t.date||'')}"></label>${auto?'':'<button type="button" class="fhDeleteTx">Excluir gasto</button>'}`,(f,m)=>{
   t.description=f.description.value.trim();t.date=f.date.value;
   if(!auto){t.categoryId=f.category.value;t.amount=parseMoney(f.amount.value)}
   put(BK,b);m.remove();render()
 });
 o.querySelector('.fhDeleteTx')?.addEventListener('click',()=>{b.transactions=b.transactions.filter(x=>x.id!==id);put(BK,b);o.remove();render()})
}
function render(){
 const root=document.querySelector('.fhBudgetHero'),cats=document.querySelector('.fhBudgetCats'),txBox=document.querySelector('.fhTransactions');if(!root||!cats||!txBox)return;
 sync();const b=data(),offset=Number(get(VIEW,0))||0,key=monthKey(offset),sig=JSON.stringify({offset,c:b.categories,t:b.transactions.filter(x=>!x.hidden)});if(root.dataset.budgetV3===sig)return;root.dataset.budgetV3=sig;const tx=b.transactions.filter(x=>!x.hidden&&String(x.date||'').slice(0,7)===key);
 let nav=root.parentElement.querySelector('.fhBudgetMonthNav');
 if(!nav){nav=document.createElement('div');nav.className='fhBudgetMonthNav';root.before(nav)}
 nav.innerHTML=`<button type="button" data-prev aria-label="Mês anterior">‹</button><strong>${esc(monthLabel(key))}</strong><button type="button" data-next aria-label="Próximo mês">›</button>`;
 nav.querySelector('[data-prev]').onclick=()=>{put(VIEW,offset-1);render()};nav.querySelector('[data-next]').onclick=()=>{put(VIEW,offset+1);render()};
 const total=b.categories.reduce((s,x)=>s+Number(x.limit||0),0),spent=tx.reduce((s,x)=>s+Number(x.amount||0),0),available=total-spent;
 root.querySelector('small').textContent=offset===0?'Disponível neste mês':'Disponível no mês';
 root.querySelector('strong').textContent=money(available);
 root.querySelector('span').textContent=`${money(spent)} gastos de ${money(total)} reservados`;
 const bar=root.querySelector('div i');if(bar)bar.style.width=`${total?Math.min(100,spent/total*100):0}%`;
 cats.querySelectorAll('article').forEach((a,i)=>{const c=b.categories[i];if(!c)return;const cs=tx.filter(x=>x.categoryId===c.id).reduce((s,x)=>s+Number(x.amount||0),0),top=a.querySelector('.fhBudgetCatTop');if(top?.querySelector('small'))top.querySelector('small').textContent=`${money(cs)} de ${money(c.limit)}`;if(top?.querySelector('em'))top.querySelector('em').textContent=money(Number(c.limit||0)-cs);const p=a.querySelector('.fhProgress i');if(p)p.style.width=`${c.limit?Math.min(100,cs/c.limit*100):0}%`});
 txBox.innerHTML=`<h2>Gastos de ${esc(monthLabel(key))}</h2>${tx.length?[...tx].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(t=>{const c=b.categories.find(x=>x.id===t.categoryId);return`<button type="button" class="fhTxRow" data-tx="${esc(t.id)}"><span>${esc(c?.emoji||'💸')}</span><p><strong>${esc(t.description||c?.name||'Gasto')}</strong><small>${new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')}${t.source==='market-group'?' · Mercado':''}</small></p><b>-${money(t.amount)}</b></button>`}).join(''):'<div class="fhEmpty">Nenhum gasto registrado neste mês.</div>'}`;
 txBox.querySelectorAll('[data-tx]').forEach(x=>x.onclick=()=>editTx(x.dataset.tx))
}
let queued=false;const obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(document.querySelector('.fhBudgetHero'))render()})});obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('storage',()=>{sync();render()});setInterval(sync,2500);setTimeout(()=>{sync();render()},0)
})();
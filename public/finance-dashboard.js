(()=>{
const one=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>(Math.ceil(Number(n)*100-0.00000001)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
let month=new Date().toLocaleDateString('sv-SE').slice(0,7),scope='family',tab='categories',seq=0,rows=[],cats=[],familyId=null,role='user',viewer=null;
const names=['Mercado','Combustível','Pets','Casa e contas','Cartões','Saúde','FIV','Educação / Antonio','Lazer','Serviços domésticos','Transporte','Outras despesas'];
const palette=['#4381e8','#19b76b','#e8c04c','#ea8956','#816dba','#7b94a6'];
function hideOld(){[one('.fhBudgetHero'),one('.fhBudgetMonthNav'),one('.fhBudgetActions'),one('.fhBudgetCats'),one('.fhTransactions'),one('[data-ledger]'),one('[data-finance-users]')].filter(Boolean).forEach(x=>x.classList.add('fdOldHidden'))}
function mount(){const hero=one('.fhBudgetHero');if(!hero)return;hideOld();if(one('.financeDashboard'))return;
const panel=document.createElement('section');panel.className='financeDashboard';
panel.innerHTML='<h2>Nossa vida financeira</h2><div class="fdFilters"><input type="month" class="fdMonth" aria-label="Mês"><select class="fdScope" aria-label="Finanças de"></select></div><div class="fdBody">Carregando finanças…</div>';
hero.before(panel);panel.querySelector('.fdMonth').value=month;panel.querySelector('.fdMonth').onchange=e=>{month=e.target.value;load()};panel.querySelector('.fdScope').onchange=e=>{scope=e.target.value;load()};load();
}
async function load(){const panel=one('.financeDashboard'),sb=window.familyHomeSupabase,token=++seq;if(!panel||!sb)return;
try{
const auth=await sb.auth.getUser();viewer=auth.data.user;if(!viewer)throw Error('Entre no Family Home para ver as finanças.');
const p=await sb.from('finance_users').select('family_id,role').eq('user_id',viewer.id).maybeSingle();if(p.error||!p.data)throw Error('Perfil financeiro indisponível.');
familyId=p.data.family_id;role=p.data.role;
const people=await sb.from('finance_users').select('user_id,name').eq('family_id',familyId);if(people.error)throw people.error;
const options=[...(role==='admin'?[{id:'family',name:'Família'}]:[]),...(people.data||[]).filter(x=>role==='admin'||x.user_id===viewer.id).map(x=>({id:x.user_id,name:x.name}))];if(!options.some(x=>x.id===scope))scope=viewer.id;
const picker=panel.querySelector('.fdScope');picker.innerHTML=options.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');picker.value=scope;
const next=new Date(month+'-01T12:00:00');next.setMonth(next.getMonth()+1);
let q=sb.from('finance_transactions').select('id,title,amount,direction,status,category,competence').eq('family_id',familyId).gte('competence',month+'-01').lt('competence',next.toLocaleDateString('sv-SE'));q=scope==='family'?q.is('owner_id',null):q.eq('owner_id',scope);
const [tx,cc]=await Promise.all([q,sb.from('finance_categories').select('id,name,monthly_limit').eq('family_id',familyId).order('name')]);
if(tx.error)throw tx.error;if(cc.error&&scope==='family')throw cc.error;if(token!==seq||!panel.isConnected)return;
rows=tx.data||[];cats=cc.data||[];render();
}catch(e){if(token===seq)panel.querySelector('.fdBody').textContent=e.message||'Erro ao carregar'}
}
function render(){
const panel=one('.financeDashboard');if(!panel)return;
const body=panel.querySelector('.fdBody'),active=rows.filter(x=>x.status!=='cancelled'),sum=(type,list=active)=>list.filter(x=>x.direction===type).reduce((n,x)=>n+Number(x.amount),0);
const income=sum('income'),out=sum('expense'),done=active.filter(x=>x.status==='posted');
const groups=new Map();active.filter(x=>x.direction==='expense').forEach(x=>groups.set(x.category||'Outras despesas',(groups.get(x.category||'Outras despesas')||0)+Number(x.amount)));
const entries=[...groups].sort((a,b)=>b[1]-a[1]);let pct=0;const gradient=entries.map((x,i)=>{const start=pct;pct+=out?x[1]/out*100:0;return palette[i%palette.length]+' '+start+'% '+pct+'%'}).join(',');
body.innerHTML='<div class="fdHero"><small>Saldo previsto · '+esc(month)+'</small><strong>'+money(income-out)+'</strong><span>Entradas menos despesas do mês</span></div><div class="fdCards"><button data-summary="income"><small>↙ Entradas</small><strong>'+money(income)+'</strong></button><button data-summary="expense"><small>↗ Despesas</small><strong>'+money(out)+'</strong></button></div><div class="fdActual">Saldo realizado <strong>'+money(sum('income',done)-sum('expense',done))+'</strong></div><h3>Distribuição das despesas</h3>'+(entries.length?'<div class="fdDonut" style="background:conic-gradient('+gradient+')"><i></i></div><div class="fdLegend">'+entries.map(([name,value],i)=>'<button data-jump="'+esc(name)+'"><i style="background:'+palette[i%palette.length]+'"></i><span>'+esc(name)+'<small>'+money(value)+'</small></span></button>').join('')+'</div>':'<p class="fdEmpty">Nenhuma despesa registrada no período.</p>')+'<div class="fdTabs" role="tablist"><button role="tab" data-tab="categories">Por categorias</button><button role="tab" data-tab="transactions">Lançamentos</button></div><div class="fdTabContent"></div>';
body.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;drawTab()});
body.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{tab='transactions';drawTab(b.dataset.jump)});
body.querySelectorAll('[data-summary]').forEach(b=>b.onclick=()=>{tab='transactions';drawTab(null,b.dataset.summary)});
drawTab();
}
function drawTab(category=null,direction=null){
const panel=one('.financeDashboard');if(!panel)return;
panel.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('fdTabActive',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});
const target=panel.querySelector('.fdTabContent');if(!target)return;
if(tab==='transactions'){
const shown=rows.filter(x=>x.status!=='cancelled'&&(!category||x.category===category)&&(!direction||x.direction===direction)).sort((a,b)=>String(b.competence).localeCompare(String(a.competence)));
target.innerHTML='<h3>'+esc(category||'Lançamentos do mês')+'</h3>'+(shown.length?shown.map(x=>'<div class="fdLine"><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.competence)+' · '+esc(x.category||(x.direction==='income'?'Entrada':'Outras despesas'))+' · '+(x.status==='posted'?'Realizado':'Previsto')+'</small></span><b>'+(x.direction==='expense'?'-':'+')+money(x.amount)+'</b></div>').join(''):'<p class="fdEmpty">Nenhum lançamento nesta seleção.</p>');
return;
}
const map=new Map(cats.map(c=>[c.name,c]));
const used=new Set([...map.keys(),...rows.filter(x=>x.direction==='expense').map(x=>x.category||'Outras despesas')]);
const cards=[...used].sort((a,b)=>names.indexOf(a)-names.indexOf(b));
target.innerHTML='<div class="fdCategoryHead"><h3>Por categorias</h3><button type="button" data-addcat>+ Categoria</button></div>'+cards.map(name=>{const cat=map.get(name),spent=rows.filter(x=>x.direction==='expense'&&x.status!=='cancelled'&&(x.category||'Outras despesas')===name).reduce((n,x)=>n+Number(x.amount),0),budget=Number(cat?.monthly_limit||0),left=budget-spent,progress=budget?Math.max(0,Math.min(100,spent/budget*100)):0;return '<button class="fdCategoryCard" data-category="'+esc(name)+'"><span><strong>'+esc(name)+'</strong><small>'+money(spent)+' de '+(budget?money(budget):'sem limite definido')+'</small></span><b>'+money(left)+'</b><i class="fdProgress"><i style="width:'+progress+'%"></i></i></button>'}).join('')+'<p class="fdHint">Categorias sem limite mostram o saldo a definir. Toque numa categoria para ver seus lançamentos.</p>';
target.querySelector('[data-addcat]').onclick=addCategory;
target.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{tab='transactions';drawTab(b.dataset.category)});
}
async function addCategory(){
const name=prompt('Nome da categoria');if(name===null)return;const trimmed=name.trim();if(!trimmed)return;
const value=prompt('Limite mensal em R$ (0 para não definir)','0');if(value===null)return;const parsed=Number(value.replace(/\./g,'').replace(',','.'));if(!Number.isFinite(parsed)||parsed<0){alert('Informe um limite válido.');return}
const sb=window.familyHomeSupabase,res=await sb.from('finance_categories').insert({family_id:familyId,name:trimmed,monthly_limit:parsed});
if(res.error){alert(res.error.message);return}await load();
}
window.addEventListener('finance-data-changed',load);
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount();hideOld()})}).observe(document.documentElement,{childList:true,subtree:true});mount();
})();
(()=>{
const $=s=>document.querySelector(s),money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let month=new Date().toLocaleDateString('sv-SE').slice(0,7),scope='family',counter=0,showOld=false;
function attach(){
const hero=$('.fhBudgetHero');if(!hero||$('.financeDashboard'))return;
const panel=document.createElement('section');panel.className='financeDashboard';
panel.innerHTML='<h2>Nossa vida financeira</h2><p>Acompanhe a família e as contas individuais.</p><div class="fdFilters"><input type="month" class="fdMonth"><select class="fdScope"></select></div><div class="fdBody">Carregando…</div><button type="button" class="fdOld">Ver planejamento anterior</button>';
hero.before(panel);panel.querySelector('.fdMonth').value=month;
panel.querySelector('.fdMonth').onchange=e=>{month=e.target.value;load(panel)};
panel.querySelector('.fdScope').onchange=e=>{scope=e.target.value;load(panel)};
panel.querySelector('.fdOld').onclick=()=>{showOld=!showOld;visibility();panel.querySelector('.fdOld').textContent=showOld?'Ocultar planejamento anterior':'Ver planejamento anterior'};
visibility();load(panel);
}
function visibility(){
const hero=$('.fhBudgetHero');if(!hero)return;
[hero,$('.fhBudgetMonthNav'),$('.fhBudgetActions'),$('.fhBudgetCats'),$('.fhTransactions')].filter(Boolean).forEach(el=>el.classList.toggle('fdOldHidden',!showOld));
}
async function load(panel){
const token=++counter,body=panel.querySelector('.fdBody'),sb=window.familyHomeSupabase;
if(!sb){body.textContent='Entre na sua conta para ver as finanças.';return}
try{
const user=(await sb.auth.getUser()).data.user;if(!user)throw Error('Entre na sua conta.');
const profile=await sb.from('finance_users').select('family_id,role').eq('user_id',user.id).maybeSingle();
if(profile.error||!profile.data)throw Error('Perfil financeiro indisponível.');
const family=profile.data.family_id,people=await sb.from('finance_users').select('user_id,name').eq('family_id',family);
if(people.error)throw people.error;
if(!panel.isConnected||token!==counter)return;
const options=[...(profile.data.role==='admin'?[{id:'family',name:'Família'}]:[]),...(people.data||[]).map(x=>({id:x.user_id,name:x.name}))];
if(!options.some(x=>x.id===scope))scope=user.id;
const picker=panel.querySelector('.fdScope');picker.innerHTML=options.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');picker.value=scope;
const next=new Date(month+'-01T12:00:00');next.setMonth(next.getMonth()+1);
let query=sb.from('finance_transactions').select('title,amount,direction,status,category').eq('family_id',family).gte('competence',month+'-01').lt('competence',next.toLocaleDateString('sv-SE'));
query=scope==='family'?query.is('owner_id',null):query.eq('owner_id',scope);
const result=await query;if(result.error)throw result.error;if(token!==counter||!panel.isConnected)return;
render(panel,result.data||[]);
}catch(e){if(token===counter)body.textContent=e.message||'Erro ao carregar as finanças.'}
}
function render(panel,rows){
const body=panel.querySelector('.fdBody'),active=rows.filter(x=>x.status!=='cancelled'),sum=(direction,items=active)=>items.filter(x=>x.direction===direction).reduce((s,x)=>s+Number(x.amount),0),income=sum('income'),out=sum('expense'),done=active.filter(x=>x.status==='posted');
const groups=new Map();active.filter(x=>x.direction==='expense').forEach(x=>groups.set(x.category||'Outras despesas',(groups.get(x.category||'Outras despesas')||0)+Number(x.amount)));
const categories=[...groups].sort((a,b)=>b[1]-a[1]),colors=['#3984ed','#10b56a','#ffd245','#f47f3d','#8b6bc4','#8294a8'];let used=0;
const stops=categories.map(([name,value],i)=>{const start=used;used+=out?value/out*100:0;return colors[i%colors.length]+' '+start+'% '+used+'%'}).join(',');
body.innerHTML='<div class="fdHero"><small>Saldo previsto · '+esc(month)+'</small><strong>'+money(income-out)+'</strong><span>Entradas menos despesas do mês</span></div><div class="fdCards"><button data-kind="income"><small>↙ Entradas</small><strong>'+money(income)+'</strong></button><button data-kind="expense"><small>↗ Despesas</small><strong>'+money(out)+'</strong></button></div><div class="fdActual">Saldo realizado: <strong>'+money(sum('income',done)-sum('expense',done))+'</strong></div><h3>Distribuição das despesas</h3>'+(categories.length?'<div class="fdDonut" style="background:conic-gradient('+stops+')"><i></i></div><div class="fdLegend">'+categories.map(([name,value],i)=>'<button data-cat="'+esc(name)+'"><i style="background:'+colors[i%colors.length]+'"></i><span>'+esc(name)+'<small>'+money(value)+'</small></span></button>').join('')+'</div>':'<p class="fdEmpty">Ainda não há lançamentos neste mês. O histórico do Excel será migrado após a conferência.</p>')+'<div class="fdDetails"></div><div class="fdLinks"><button data-open="ledger">Contas e lançamentos</button><button data-open="users">Usuários financeiros</button></div>';
function details(kind,cat){const list=active.filter(x=>x.direction===kind&&(!cat||x.category===cat)),target=body.querySelector('.fdDetails');target.innerHTML='<h3>'+esc(cat|| (kind==='income'?'Entradas':'Despesas'))+'</h3>'+list.map(x=>'<div class="fdLine"><span>'+esc(x.title)+'<small>'+esc(x.status==='posted'?'Realizado':'Previsto')+'</small></span><b>'+money(x.amount)+'</b></div>').join('');target.scrollIntoView({behavior:'smooth',block:'nearest'})}
body.querySelectorAll('[data-kind]').forEach(x=>x.onclick=()=>details(x.dataset.kind));body.querySelectorAll('[data-cat]').forEach(x=>x.onclick=()=>details('expense',x.dataset.cat));
body.querySelector('[data-open="ledger"]').onclick=()=>document.querySelector('[data-ledger]')?.click();body.querySelector('[data-open="users"]').onclick=()=>document.querySelector('[data-finance-users]')?.click();
}
window.addEventListener('finance-data-changed',()=>{const panel=document.querySelector('.financeDashboard');if(panel)load(panel)});
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;attach()})}).observe(document.documentElement,{childList:true,subtree:true});attach();
})();
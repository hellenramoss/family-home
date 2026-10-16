(()=>{
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const styles='.nuMask{position:fixed;inset:0;background:#142034aa;z-index:100600;display:flex;align-items:flex-end;justify-content:center}.nuPanel{background:#fff;border-radius:22px 22px 0 0;width:min(600px,100%);max-height:92dvh;overflow:auto;padding:20px;box-sizing:border-box;color:#24344b;font:14px system-ui}.nuPanel header{display:flex;justify-content:space-between;align-items:center}.nuPanel button{border:0;padding:10px;border-radius:10px;background:#e9eff9;color:#2e578f}.nuPanel input,.nuPanel select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font:16px system-ui}.nuPanel label{display:grid;gap:5px;margin:12px 0}.nuLine{display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;padding:11px 0}.nuLine span{flex:1}.nuLine small{display:block;color:#888}.nuTabs{display:flex;gap:5px;margin:16px 0}.nuTabs button{flex:1}.nuTabs .on{background:#28466b;color:#fff}';
document.head.append(Object.assign(document.createElement('style'),{textContent:styles+'.nuSwipe{position:relative;overflow:hidden}.nuDelete{position:absolute;right:0;top:0;bottom:0;background:#c83b42!important;color:white!important;width:88px}.nuTap{position:relative;background:#fff;cursor:pointer;touch-action:pan-y;transition:transform .14s ease}.nuSwipe.revealed .nuTap{transform:translateX(-88px)!important}.nuTap:focus-visible{outline:2px solid #3865a7}'}));
function mount(){const home=$('.fhHomePage .fhGrid');if(home&&!home.querySelector('[data-home-nubank]')){const card=document.createElement('button');card.type='button';card.dataset.homeNubank='1';card.innerHTML='<div><strong>Cartão de crédito</strong><small>Nubank · Compras e fatura</small></div><b>💳</b>';card.onclick=()=>open();home.append(card)}const legend=document.querySelector('.financeDashboard .fdLegend [data-jump="Cartões"]');if(legend&&!legend.dataset.nubankLinked){legend.dataset.nubankLinked='1';legend.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true)}const bar=$('.financeDashboard .fdTabs');if(!bar||$('[data-open-nubank]'))return;const btn=document.createElement('button');btn.textContent='Cartões e faturas';btn.dataset.openNubank='1';btn.style.cssText='display:block;width:100%;padding:13px;margin:10px 0;border:0;border-radius:12px;background:#e7eefb;color:#315c9d;font-weight:700';btn.onclick=open;bar.before(btn)}
async function open(){
const sb=window.familyHomeSupabase,mask=document.createElement('div'),panel=document.createElement('section');mask.className='nuMask';panel.className='nuPanel';mask.append(panel);document.body.append(mask);
const header=()=>{panel.replaceChildren();const h=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.textContent='Nubank · Fatura única';close.textContent='Fechar';close.onclick=()=>mask.remove();h.append(title,close);panel.append(h)};
const element=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
const button=(label,action)=>{const b=element('button',label);b.type='button';b.onclick=action;return b};
header();
try{
const user=(await sb.auth.getUser()).data.user;if(!user)throw Error('Entre na sua conta.');
const profile=await sb.from('finance_users').select('family_id,role').eq('user_id',user.id).maybeSingle();
if(profile.error||profile.data?.role!=='admin')throw Error('A fatura compartilhada está disponível para administradoras.');
const month=$('.financeDashboard .fdMonth')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
const q=await sb.from('finance_transactions').select('id,amount').eq('family_id',profile.data.family_id).eq('competence',month+'-01').eq('title','Cartão Nubank').is('owner_id',null).maybeSingle();
if(q.error)throw q.error;if(!q.data)throw Error('Nenhuma fatura Nubank neste mês.');
const statement=q.data;let lines=[],personals=[],filter='family';
async function refresh(){
const res=await sb.from('finance_card_lines').select('id,title,amount,installment_label,allocation,category,source_row').eq('statement_transaction_id',statement.id).order('source_row');
if(res.error)throw res.error;lines=res.data||[];header();
const summary=element('p','Total da fatura: '+fmt(statement.amount));panel.append(summary);
const personalResult=await sb.from('finance_nubank_personal_import').select('id,person,description,amount,installment,note,month').eq('family_id',profile.data.family_id).eq('month',month+'-01');if(personalResult.error)throw personalResult.error;personals=personalResult.data||[];
const tabs=document.createElement('div');tabs.className='nuTabs';[['all','Todos'],['family','Família'],['hellen','Hellen'],['karina','Karina']].forEach(([key,label])=>{const b=button(label,()=>{filter=key;refresh()});if(key===filter)b.className='on';tabs.append(b)});panel.append(tabs);
const rows=filter==='all'?[...lines.map(x=>({kind:'family',...x})),...personals.map(x=>({kind:'personal',...x}))]:filter==='family'?lines.filter(x=>!x.allocation||x.allocation==='family').map(x=>({kind:'family',...x})):personals.filter(x=>x.person===filter).map(x=>({kind:'personal',...x}));
const subtotal=rows.reduce((sum,x)=>sum+Number(x.amount||0),0);panel.append(element('p',rows.length+' compras · '+fmt(subtotal)));
if(filter==='family'||filter==='all')panel.append(button('+ Novo lançamento',()=>edit(null)));
for(const line of rows){
 const wrap=document.createElement('div');wrap.className='nuSwipe';
 const action=button('Excluir',()=>removeItem(line));action.className='nuDelete';wrap.append(action);
 const row=document.createElement('div');row.className='nuLine nuTap';row.setAttribute('role','button');row.tabIndex=0;
 const info=document.createElement('span');info.append(element('b',line.kind==='family'?line.title:line.description),element('small',[line.kind==='personal'?(line.person==='hellen'?'Hellen':'Karina'):line.allocation==='family'?'Família':'Fatura',line.kind==='family'?line.installment_label:line.installment].filter(Boolean).join(' · ')));
 row.append(info,element('strong',fmt(line.amount||0)));wrap.append(row);panel.append(wrap);
 let x=0,y=0,swiping=false,suppress=false;
 row.addEventListener('touchstart',e=>{x=e.touches[0].clientX;y=e.touches[0].clientY;swiping=false},{passive:true});
 row.addEventListener('touchmove',e=>{const dx=e.touches[0].clientX-x,dy=e.touches[0].clientY-y;if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)){swiping=true;row.style.transform='translateX('+Math.max(-88,Math.min(0,dx))+'px)'}},{passive:true});
 row.addEventListener('touchend',e=>{if(swiping){const dx=e.changedTouches[0].clientX-x;wrap.classList.toggle('revealed',dx< -40);row.style.transform='';suppress=true;setTimeout(()=>suppress=false,350)}});
 row.onclick=()=>{if(!suppress)edit(line)};
 row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();edit(line)}};
}

}

async function removeItem(item){if(!confirm('Excluir '+(item.kind==='personal'?item.description:item.title)+'?'))return;const result=item.kind==='personal'?await sb.from('finance_nubank_personal_import').delete().eq('id',item.id).eq('family_id',profile.data.family_id):await sb.rpc('finance_delete_card_line',{line_id:item.id,statement_id:statement.id});if(result.error){alert(result.error.message);return}if(item.kind!=='personal'){const latest=await sb.from('finance_transactions').select('amount').eq('id',statement.id).single();if(!latest.error)statement.amount=latest.data.amount}window.dispatchEvent(new Event('finance-data-changed'));await refresh()}

function edit(item){header();panel.append(element('h3',item?'Editar lançamento':'Novo lançamento'));const form=document.createElement('form');
const input=(label,value)=>{const wrap=document.createElement('label');wrap.textContent=label;const control=document.createElement('input');control.value=value||'';control.required=label==='Descrição'||label==='Valor';wrap.append(control);form.append(wrap);return control};
const title=input('Descrição',item?.kind==='personal'?item.description:item?.title),amount=input('Valor',item?.amount==null?'':String(item.amount).replace('.',','));
const wrap=document.createElement('label');wrap.textContent='Responsável';const owner=document.createElement('select');[['','Selecione'],['family','Família'],['hellen','Hellen'],['karina','Karina']].forEach(([v,t])=>owner.append(new Option(t,v)));owner.value=item?.kind==='personal'?item.person:item?.allocation||'';wrap.append(owner);form.append(wrap);
const category=input('Categoria',item?.category),installment=input('Parcela',item?.kind==='personal'?item.installment:item?.installment_label);
const message=element('p','');const save=button('Salvar',()=>{});save.type='submit';form.append(save,button('Cancelar',()=>refresh()),message);panel.append(form);
form.onsubmit=async e=>{e.preventDefault();const raw=amount.value.trim().replace(/\./g,'').replace(',','.');if(!/^\d+(?:\.\d{1,9})?$/.test(raw)||!owner.value){message.textContent='Informe valor e responsável.';return}
const result=item?.kind==='personal'?await sb.from('finance_nubank_personal_import').update({description:title.value,amount:raw,person:owner.value,installment:installment.value,note:category.value}).eq('id',item.id).eq('family_id',profile.data.family_id):await sb.rpc('finance_save_card_line',{line_id:item?.id||null,statement_id:statement.id,new_title:title.value,new_amount:raw,new_allocation:owner.value,new_category:category.value,new_installment:installment.value});
if(result.error){message.textContent=result.error.message;return}
const latest=await sb.from('finance_transactions').select('amount').eq('id',statement.id).single();if(!latest.error)statement.amount=latest.data.amount;window.dispatchEvent(new Event('finance-data-changed'));await refresh()};
}
await refresh();
}catch(e){panel.append(element('p',e.message||'Falha ao carregar.'))}
}
window.openFamilyNubank=()=>{const entry=document.querySelector('[data-open-nubank]');if(entry)entry.click();else open()};
let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;mount()})}).observe(document.documentElement,{childList:true,subtree:true});mount()
})();
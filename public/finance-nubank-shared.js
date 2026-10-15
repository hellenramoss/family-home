(()=>{
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const styles='.nuMask{position:fixed;inset:0;background:#142034aa;z-index:100600;display:flex;align-items:flex-end;justify-content:center}.nuPanel{background:#fff;border-radius:22px 22px 0 0;width:min(600px,100%);max-height:92dvh;overflow:auto;padding:20px;box-sizing:border-box;color:#24344b;font:14px system-ui}.nuPanel header{display:flex;justify-content:space-between;align-items:center}.nuPanel button{border:0;padding:10px;border-radius:10px;background:#e9eff9;color:#2e578f}.nuPanel input,.nuPanel select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font:16px system-ui}.nuPanel label{display:grid;gap:5px;margin:12px 0}.nuLine{display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;padding:11px 0}.nuLine span{flex:1}.nuLine small{display:block;color:#888}.nuTabs{display:flex;gap:5px;margin:16px 0}.nuTabs button{flex:1}.nuTabs .on{background:#28466b;color:#fff}';
document.head.append(Object.assign(document.createElement('style'),{textContent:styles}));
function mount(){const bar=$('.financeDashboard .fdTabs');if(!bar||$('[data-open-nubank]'))return;const btn=document.createElement('button');btn.textContent='Cartões e faturas';btn.dataset.openNubank='1';btn.style.cssText='display:block;width:100%;padding:13px;margin:10px 0;border:0;border-radius:12px;background:#e7eefb;color:#315c9d;font-weight:700';btn.onclick=open;bar.before(btn)}
async function open(){
const sb=window.familyHomeSupabase,mask=document.createElement('div'),panel=document.createElement('section');mask.className='nuMask';panel.className='nuPanel';mask.append(panel);document.body.append(mask);
const header=()=>{panel.replaceChildren();const h=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.textContent='Nubank · Fatura única';close.textContent='Fechar';close.onclick=()=>mask.remove();h.append(title,close);panel.append(h)};
const element=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
const button=(label,action)=>{const b=element('button',label);b.onclick=action;return b};
header();
try{
const user=(await sb.auth.getUser()).data.user;if(!user)throw Error('Entre na sua conta.');
const profile=await sb.from('finance_users').select('family_id,role').eq('user_id',user.id).maybeSingle();
if(profile.error||profile.data?.role!=='admin')throw Error('A fatura compartilhada está disponível para administradoras.');
const month=$('.financeDashboard .fdMonth')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
const q=await sb.from('finance_transactions').select('id,amount').eq('family_id',profile.data.family_id).eq('competence',month+'-01').eq('title','Cartão Nubank').is('owner_id',null).maybeSingle();
if(q.error)throw q.error;if(!q.data)throw Error('Nenhuma fatura Nubank neste mês.');
const statement=q.data;let lines=[],filter='all';
async function refresh(){
const res=await sb.from('finance_card_lines').select('id,title,amount,installment_label,allocation,category,source_row').eq('statement_transaction_id',statement.id).order('source_row');
if(res.error)throw res.error;lines=res.data||[];header();
const summary=element('p','Total da fatura: '+fmt(statement.amount));panel.append(summary);
const unidentified=lines.filter(x=>!x.allocation).reduce((n,x)=>n+Number(x.amount||0),0);
panel.append(element('p','Pendente de classificação: '+fmt(unidentified)));
const tabs=document.createElement('div');tabs.className='nuTabs';[['all','Todos'],['family','Família'],['hellen','Hellen'],['karina','Karina']].forEach(([key,label])=>{const b=button(label,()=>{filter=key;refresh()});if(key===filter)b.className='on';tabs.append(b)});panel.append(tabs);
panel.append(button('+ Novo lançamento',()=>edit(null)));
for(const line of lines.filter(x=>filter==='all'||x.allocation===filter)){
 const row=document.createElement('div');row.className='nuLine';const info=document.createElement('span');info.append(element('b',line.title),element('small',[line.allocation||'A classificar',line.category||'Sem categoria',line.installment_label||''].filter(Boolean).join(' · ')));
 row.append(info,element('strong',line.amount===null?'Sem valor':fmt(line.amount)),button('Editar',()=>edit(line)));panel.append(row)}
panel.append(element('p','Classificar uma compra não significa pagar a fatura. Os lançamentos importados permanecem preservados.'))}
function edit(item){header();panel.append(element('h3',item?'Editar lançamento':'Novo lançamento'));const form=document.createElement('form');
const input=(label,value)=>{const wrap=document.createElement('label');wrap.textContent=label;const control=document.createElement('input');control.value=value||'';control.required=label==='Descrição'||label==='Valor';wrap.append(control);form.append(wrap);return control};
const title=input('Descrição',item?.title),amount=input('Valor',item?.amount==null?'':String(item.amount).replace('.',','));
const wrap=document.createElement('label');wrap.textContent='Responsável';const owner=document.createElement('select');[['','Selecione'],['family','Família'],['hellen','Hellen'],['karina','Karina']].forEach(([v,t])=>owner.append(new Option(t,v)));owner.value=item?.allocation||'';wrap.append(owner);form.append(wrap);
const category=input('Categoria',item?.category),installment=input('Parcela',item?.installment_label);
const message=element('p','');form.append(button('Salvar',()=>{}),button('Cancelar',()=>refresh()),message);panel.append(form);
form.onsubmit=async e=>{e.preventDefault();const raw=amount.value.trim().replace(/\./g,'').replace(',','.');if(!/^\d+(?:\.\d{1,9})?$/.test(raw)||!owner.value){message.textContent='Informe valor e responsável.';return}
const result=await sb.rpc('finance_save_card_line',{line_id:item?.id||null,statement_id:statement.id,new_title:title.value,new_amount:raw,new_allocation:owner.value,new_category:category.value,new_installment:installment.value});
if(result.error){message.textContent=result.error.message;return}
const latest=await sb.from('finance_transactions').select('amount').eq('id',statement.id).single();if(!latest.error)statement.amount=latest.data.amount;window.dispatchEvent(new Event('finance-data-changed'));await refresh()};
}
await refresh();
}catch(e){panel.append(element('p',e.message||'Falha ao carregar.'))}
}
let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;mount()})}).observe(document.documentElement,{childList:true,subtree:true});mount()
})();
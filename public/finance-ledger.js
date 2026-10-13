(() => {
const sb=()=>window.familyHomeSupabase;
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d=new Date();const month=()=>new Date(d.getFullYear(),d.getMonth(),1).toLocaleDateString('en-CA');
const css='.financeLedgerButton{width:100%;border:0;background:#233448;color:#fff;padding:15px;border-radius:13px;margin:10px 0;font:700 15px system-ui}.financeLedgerOverlay{position:fixed;inset:0;background:#0009;z-index:100090;display:grid;place-items:center;padding:12px}.financeLedgerSheet{background:white;color:#17212b;border-radius:20px;width:min(580px,100%);max-height:92dvh;overflow:auto;box-sizing:border-box;padding:20px;font:14px system-ui}.financeLedgerSheet header{display:flex;justify-content:space-between;align-items:center}.financeLedgerSheet h2{margin:0;font-size:20px}.financeLedgerSheet header button{border:0;border-radius:8px;padding:8px}.financeLedgerSheet input,.financeLedgerSheet select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #ccd1da;border-radius:9px;font:16px system-ui}.financeLedgerSheet label{display:grid;gap:5px;margin:9px 0}.financeLedgerSheet .primary{background:#233448;color:white;border:0;border-radius:10px;padding:12px;margin-top:8px;font-weight:700}.financeLedgerSheet .line{padding:12px 0;border-bottom:1px solid #e5e6ea;display:flex;justify-content:space-between;gap:10px}.financeLedgerSheet .line small{display:block;color:#7b838c}.financeLedgerSheet .error{color:#bd3434}.financeLedgerSheet .summary{background:#f3f5f8;border-radius:12px;padding:14px;margin:10px 0}.financeLedgerSheet .tabs{display:flex;gap:8px;margin:12px 0}.financeLedgerSheet .tabs button{flex:1;padding:10px;border:1px solid #d7dce4;border-radius:9px;background:#fff}';
document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
async function open(){
const overlay=document.createElement('div');overlay.className='financeLedgerOverlay';const sheet=document.createElement('section');sheet.className='financeLedgerSheet';overlay.append(sheet);document.body.append(overlay);
const header=()=>{sheet.innerHTML='<header><h2>Finanças 2.0</h2><button type="button" data-close>Fechar</button></header>';sheet.querySelector('[data-close]').onclick=()=>overlay.remove()};
header();
try{
const client=sb();if(!client)throw Error('Faça login para acessar suas finanças.');
const user=(await client.auth.getUser()).data.user;if(!user)throw Error('Faça login para continuar.');
const memberships=await client.from('finance_users').select('family_id,user_id,name,role').eq('user_id',user.id).limit(1).maybeSingle();if(memberships.error||!memberships.data)throw Error('Perfil financeiro não encontrado.');
const {family_id:familyId,role}=memberships.data;
const usersResult=await client.from('finance_users').select('user_id,name,role').eq('family_id',familyId);
if(usersResult.error)throw usersResult.error;
const users=usersResult.data||[];
const scopes=[{value:'family',label:'Família'},...users.map(x=>({value:x.user_id,label:x.name}))].filter(x=>role==='admin'||x.value===user.id);
let scope=scopes[0]?.value||user.id;
const choose=()=>{
 const label=document.createElement('label');label.textContent='Visualizar finanças';
 const select=document.createElement('select');scopes.forEach(x=>select.append(new Option(x.label,x.value)));select.value=scope;select.onchange=()=>{scope=select.value;void render()};label.append(select);sheet.append(label);
};
async function render(){
 header();choose();
 const owner=scope==='family'?null:scope;
 const filter=q=>owner===null?q.is('owner_id',null):q.eq('owner_id',owner);
 const [acc,tx]=await Promise.all([filter(client.from('finance_accounts').select('*').eq('family_id',familyId)).order('name'),filter(client.from('finance_transactions').select('*').eq('family_id',familyId)).order('competence',{ascending:false}).limit(100)]);
 if(acc.error||tx.error)throw acc.error||tx.error;
 const accounts=acc.data||[],transactions=tx.data||[];
 const first=month();
 const current=transactions.filter(x=>String(x.competence).slice(0,7)===first.slice(0,7));
 const planned=current.filter(x=>x.status!=='cancelled');
 const income=planned.filter(x=>x.direction==='income').reduce((s,x)=>s+Number(x.amount),0);
 const expenses=planned.filter(x=>x.direction==='expense').reduce((s,x)=>s+Number(x.amount),0);
 const summary=document.createElement('div');summary.className='summary';summary.innerHTML='<small>Saldo previsto do mês</small><h2>'+money(income-expenses)+'</h2><small>Entradas '+money(income)+' · Despesas '+money(expenses)+'</small>';sheet.append(summary);
 const createButton=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='primary';b.textContent=text;b.onclick=fn;sheet.append(b)};
 createButton('+ Conta ou cartão',()=>accountForm());
 createButton('+ Lançamento',()=>transactionForm(accounts));
 const aTitle=document.createElement('h3');aTitle.textContent='Contas e cartões';sheet.append(aTitle);
 accounts.forEach(a=>{const row=document.createElement('div');row.className='line';row.innerHTML='<span>'+esc(a.name)+'</span><small>'+esc(a.kind==='credit_card'?'Cartão de crédito':'Conta')+'</small>';sheet.append(row)});
 const tTitle=document.createElement('h3');tTitle.textContent='Últimos lançamentos';sheet.append(tTitle);
 transactions.forEach(t=>{const row=document.createElement('div');row.className='line';row.innerHTML='<div><strong>'+esc(t.title)+'</strong><small>'+esc(t.competence)+' · '+esc(t.status==='planned'?'Previsto':t.status==='posted'?'Realizado':'Cancelado')+'</small></div><b>'+esc(t.direction==='expense'?'-':'+')+money(t.amount)+'</b>';sheet.append(row)});
 if(!transactions.length){const note=document.createElement('p');note.textContent='Nenhum lançamento cadastrado ainda. O histórico do Excel será importado após a reconciliação.';sheet.append(note)}
 }
 function form(title,fields,save){
 header();const h=document.createElement('h3');h.textContent=title;sheet.append(h);const f=document.createElement('form');f.innerHTML=fields+'<button type="submit" class="primary">Salvar</button><p class="error"></p>';sheet.append(f);f.onsubmit=async event=>{event.preventDefault();const data=new FormData(f);const error=await save(data);if(error){f.querySelector('.error').textContent=error.message||String(error);return;}await render()};
 }
 function accountForm(){
 form('Nova conta ou cartão','<label>Nome<input name="name" maxlength="120" required placeholder="Ex.: Nubank Família"></label><label>Tipo<select name="kind"><option value="bank">Conta bancária</option><option value="credit_card">Cartão de crédito</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></label>',async data=>{const response=await client.from('finance_accounts').insert({family_id:familyId,owner_id:scope==='family'?null:scope,name:String(data.get('name')).trim(),kind:data.get('kind')});return response.error});
 }
 function transactionForm(accounts){
 form('Novo lançamento','<label>Descrição<input name="title" required maxlength="240"></label><label>Valor (R$)<input name="amount" inputmode="decimal" required placeholder="0,00"></label><label>Tipo<select name="direction"><option value="expense">Despesa</option><option value="income">Entrada</option></select></label><label>Competência<input name="competence" type="month" required value="'+month().slice(0,7)+'"></label><label>Situação<select name="status"><option value="planned">Previsto</option><option value="posted">Realizado</option></select></label><label>Conta/cartão<select name="account"><option value="">Sem conta definida</option>'+accounts.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select></label>',async data=>{const amount=String(data.get('amount')).replace(/\./g,'').replace(',','.');if(!/^\d+(?:\.\d{1,6})?$/.test(amount))return Error('Informe um valor válido.');const response=await client.from('finance_transactions').insert({family_id:familyId,owner_id:scope==='family'?null:scope,account_id:data.get('account')||null,title:String(data.get('title')).trim(),amount,direction:data.get('direction'),competence:data.get('competence')+'-01',status:data.get('status')});return response.error});
 }
 await render();
}catch(error){header();const p=document.createElement('p');p.className='error';p.textContent=error.message||'Falha ao abrir finanças.';sheet.append(p)}
}
function attach(){const hero=document.querySelector('.fhBudgetHero');if(!hero||document.querySelector('[data-ledger]'))return;const b=document.createElement('button');b.className='financeLedgerButton';b.dataset.ledger='1';b.textContent='Abrir Finanças 2.0';b.onclick=open;hero.after(b)}
new MutationObserver(attach).observe(document.documentElement,{childList:true,subtree:true});attach();
})();
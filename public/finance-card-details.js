(()=>{
const money=n=>(Math.ceil((Number(n) * 100) - 0.00000001) / 100).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function open(){
const shade=document.createElement('div');shade.className='financeCardShade';
shade.innerHTML='<section class="financeCardSheet"><header><h2>Faturas e parcelas</h2><button data-close>Fechar</button></header><p>Carregando detalhes…</p></section>';
document.body.append(shade);shade.querySelector('[data-close]').onclick=()=>shade.remove();
try{
const sb=window.familyHomeSupabase,auth=await sb.auth.getUser(),user=auth.data.user;
if(!user)throw Error('Faça login para acessar suas faturas.');
const profile=await sb.from('finance_users').select('family_id,role').eq('user_id',user.id).maybeSingle();
if(profile.error||!profile.data)throw Error('Perfil financeiro não encontrado.');
const month=document.querySelector('.financeDashboard .fdMonth')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
const scope=document.querySelector('.financeDashboard .fdScope')?.value||user.id;
let query=sb.from('finance_transactions').select('id,title,amount').eq('family_id',profile.data.family_id).eq('competence',month+'-01').like('title','Cartão %');
query=scope==='family'?query.is('owner_id',null):query.eq('owner_id',scope);
const invoices=await query;if(invoices.error)throw invoices.error;
const content=shade.querySelector('.financeCardSheet');
let selected=invoices.data?.[0]?.id||'';
async function render(){
const invoice=(invoices.data||[]).find(x=>x.id===selected);
content.innerHTML='<header><h2>Faturas e parcelas</h2><button data-close>Fechar</button></header><label>Cartão<select data-statement></select></label><div class="financeCardRows"></div><p class="financeCardMessage"></p>';
content.querySelector('[data-close]').onclick=()=>shade.remove();
const select=content.querySelector('[data-statement]');
(invoices.data||[]).forEach(x=>select.append(new Option(x.title+' · '+money(x.amount),x.id)));
select.value=selected;select.onchange=()=>{selected=select.value;render()};
const area=content.querySelector('.financeCardRows');
if(!invoice){area.textContent='Nenhuma fatura encontrada neste mês.';return}
const lines=await sb.from('finance_card_lines').select('id,title,amount,installment_label,source_row').eq('statement_transaction_id',invoice.id).order('source_row');
if(lines.error){area.textContent=lines.error.message;return}
const hasValues=(lines.data||[]).some(x=>x.amount!==null);
const total=(lines.data||[]).reduce((s,x)=>s+(x.amount===null?0:Number(x.amount)),0);
area.innerHTML='<p>Total atual: <strong>'+money(invoice.amount)+'</strong> · Soma das linhas: <strong>'+money(total)+'</strong></p>'+
(lines.data||[]).map(x=>'<div class="financeCardRow"><div><b>'+escapeHtml(x.title)+'</b><small>'+escapeHtml(x.installment_label||'Sem parcela')+' · linha '+x.source_row+'</small></div><span>'+(x.amount===null?'Sem valor':money(x.amount))+'</span><button data-edit="'+escapeHtml(x.id)+'">Editar</button></div>').join('');
area.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{
const item=lines.data.find(x=>x.id===button.dataset.edit);
const editor=document.createElement('form');editor.className='financeCardEdit';
editor.innerHTML='<h3>Editar compra</h3><label>Descrição<input name="title" required></label><label>Valor (R$), deixe vazio quando não houver valor<input name="amount" inputmode="decimal"></label><label>Parcela<input name="installment"></label><button type="submit">Salvar e recalcular</button><button type="button" data-cancel>Cancelar</button><p></p>';
editor.elements.title.value=item.title;editor.elements.amount.value=item.amount===null?'':String(item.amount).replace('.',',');editor.elements.installment.value=item.installment_label||'';
area.prepend(editor);editor.querySelector('[data-cancel]').onclick=()=>editor.remove();
editor.onsubmit=async e=>{e.preventDefault();
const raw=editor.elements.amount.value.trim().replace(/\./g,'').replace(',','.');
if(raw&&!/^\d+(?:\.\d{1,9})?$/.test(raw)){editor.querySelector('p').textContent='Valor inválido.';return}
const update=await sb.rpc('finance_edit_card_line',{line_id:item.id,new_title:editor.elements.title.value,new_amount:raw?Number(raw):null,new_installment:editor.elements.installment.value});
if(update.error){editor.querySelector('p').textContent=update.error.message;return}
const refreshed=await sb.from('finance_transactions').select('amount').eq('id',invoice.id).single();
if(!refreshed.error)invoice.amount=refreshed.data.amount;
await render();window.dispatchEvent(new Event('finance-data-changed'));
};
});
}
await render();
}catch(err){shade.querySelector('.financeCardSheet').append(document.createTextNode(err.message||'Não foi possível abrir as faturas.'))}
}
function attach(){const el=document.querySelector('.financeDashboard .fdLinks');if(!el||el.querySelector('[data-invoices]'))return;
const button=document.createElement('button');button.textContent='Faturas e parcelas';button.dataset.invoices='1';button.onclick=open;el.prepend(button)}
new MutationObserver(attach).observe(document.documentElement,{childList:true,subtree:true});attach();
})();
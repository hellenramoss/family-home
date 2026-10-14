(()=>{
const css='.fhCalendarConnections{padding:12px 0}.fhCalendarConnections button{border:0;border-radius:11px;padding:12px;background:#e9f0fc;color:#27518b;font-weight:700}.fhCalOverlay{position:fixed;inset:0;background:#0009;z-index:100350;display:grid;place-items:center;padding:14px}.fhCalSheet{width:min(480px,100%);max-height:90dvh;overflow:auto;background:#fff;color:#243247;border-radius:18px;padding:20px;font:14px system-ui}.fhCalProvider{border-bottom:1px solid #e5e8ed;padding:14px 0}.fhCalProvider b{display:block}.fhCalProvider small{display:block;color:#768494;margin-top:4px}.fhCalSheet button{padding:11px;border-radius:9px;margin:6px 5px 5px 0;border:0;background:#e9f0fc;color:#25518e}.fhCalSheet .close{background:#293950;color:white}';document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
function mount(){const week=document.querySelector('.fhWeek');if(!week||document.querySelector('.fhCalendarConnections'))return;const div=document.createElement('div');div.className='fhCalendarConnections';const button=document.createElement('button');button.textContent='Gerenciar calendários e sincronização';button.onclick=open;div.append(button);week.before(div)}
async function open(){
const shade=document.createElement('div');shade.className='fhCalOverlay';const sheet=document.createElement('section');sheet.className='fhCalSheet';shade.append(sheet);document.body.append(shade);
const heading=document.createElement('h2');heading.textContent='Calendários conectados';sheet.append(heading);
const description=document.createElement('p');description.textContent='Escolha as agendas que deseja conectar. O envio automático será ativado somente depois da autorização segura de cada serviço.';sheet.append(description);
try{
const sb=window.familyHomeSupabase,auth=await sb.auth.getUser(),user=auth.data.user;if(!user)throw Error('Faça login para configurar suas agendas.');
const profile=await sb.from('finance_users').select('family_id').eq('user_id',user.id).maybeSingle();if(profile.error||!profile.data)throw Error('Grupo familiar não encontrado.');
const result=await sb.from('family_calendar_connections').select('provider,status,sync_enabled').eq('family_id',profile.data.family_id).eq('user_id',user.id);
if(result.error)throw result.error;
const status=new Map((result.data||[]).map(x=>[x.provider,x]));
for(const [id,name,description] of [['google','Google Calendar','Integração OAuth e API Google Calendar'],['outlook','Outlook','Integração OAuth Microsoft Graph'],['icloud','iCloud / Apple Calendar','Assinatura ICS; envio direto exige CalDAV']]){
const box=document.createElement('div');box.className='fhCalProvider';const title=document.createElement('b');title.textContent=name;const detail=document.createElement('small');detail.textContent=description;const state=document.createElement('p');state.textContent=status.get(id)?.status==='connected'?'Conectado':'Ainda não conectado';const button=document.createElement('button');button.textContent='Preparar conexão';button.onclick=async()=>{
const current=await sb.from('family_calendar_connections').upsert({family_id:profile.data.family_id,user_id:user.id,provider:id,status:'not_connected',sync_enabled:false},{onConflict:'family_id,user_id,provider'});
state.textContent=current.error?current.error.message:'Preferência registrada. Autorização da conta ainda não disponível nesta versão.';};
box.append(title,detail,state,button);sheet.append(box);
}
}catch(error){const p=document.createElement('p');p.textContent=error.message||'Não foi possível carregar as configurações.';sheet.append(p)}
const close=document.createElement('button');close.className='close';close.textContent='Fechar';close.onclick=()=>shade.remove();sheet.append(close);
}
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()})}).observe(document.documentElement,{subtree:true,childList:true});mount();
})();
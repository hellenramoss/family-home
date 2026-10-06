(()=>{
const style=document.createElement('style');
style.textContent=`.fhSyncPill{display:none!important}.fhSyncSettingsCard{margin:18px 0 6px;padding:14px;border:1px solid #e6e6e6;border-radius:16px;background:#f8f8f8}.fhSyncSettingsCard small{display:block;color:#777;margin-bottom:7px}.fhSyncSettingsCard button{width:100%;border:0;border-radius:12px;background:#171717;color:#fff;padding:13px 14px;font:700 14px system-ui;cursor:pointer}`;
document.head.append(style);
function enhance(){
 const modal=document.querySelector('.fhExperienceModal form');
 if(!modal||modal.querySelector('.fhSyncSettingsCard'))return;
 const card=document.createElement('div');card.className='fhSyncSettingsCard';
 card.innerHTML='<small>Família, conta, código de convite e notificações</small><button type="button">☁ Família e sincronização</button>';
 card.querySelector('button').onclick=()=>{document.querySelector('.fhExperienceModal')?.remove();document.querySelector('.fhSyncPill')?.click()};
 modal.append(card);
}
new MutationObserver(()=>requestAnimationFrame(enhance)).observe(document.body,{childList:true,subtree:true});
setTimeout(enhance,0);
})();
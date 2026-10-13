(() => {
  const money = value => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const escapeHtml = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sequence=0;
  async function update(panel){
    const target=panel.querySelector('.fdBody'); if(!target)return;
    let section=target.querySelector('.fdSplit');
    if(!section){section=document.createElement('section');section.className='fdSplit';target.append(section)}
    const token=++sequence,sb=window.familyHomeSupabase;
    if(!sb)return;
    const selected=panel.querySelector('.fdScope')?.selectedOptions?.[0]?.textContent;
    if(selected!=='Família'){section.remove();return}
    const ym=panel.querySelector('.fdMonth')?.value;
    if(!/^\d{4}-\d{2}$/.test(ym||''))return;
    try{
      const user=(await sb.auth.getUser()).data.user;if(!user)return;
      const result=await sb.from('finance_users').select('family_id,role').eq('user_id',user.id).limit(1).maybeSingle();
      if(!result.data||result.data.role!=='admin'){section.remove();return}
      const rows=await sb.rpc('finance_monthly_split',{fid:result.data.family_id,ym:ym+'-01'});
      if(token!==sequence||!section.isConnected)return;
      if(rows.error)throw rows.error;
      if(!rows.data?.length){section.innerHTML='';return}
      section.innerHTML='<h3>Contribuição equitativa</h3><p>Divisão proporcional às entradas, conforme a fórmula do Excel.</p>'+rows.data.map(x=>'<div class="fdSplitRow"><strong>'+escapeHtml(x.person_name)+'</strong><span>Contribuição <b>'+money(x.contribution)+'</b><small>Saldo após contribuição: '+money(x.remaining)+'</small></span></div>').join('');
    }catch(error){if(token===sequence&&section.isConnected)section.innerHTML='<p>Rateio indisponível: '+escapeHtml(error.message)+'</p>'}
  }
  let pending=false;
  const observer=new MutationObserver(()=>{
    if(pending)return;pending=true;
    requestAnimationFrame(()=>{pending=false;const panel=document.querySelector('.financeDashboard');if(panel&&panel.querySelector('.fdBody .fdHero'))void update(panel)});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
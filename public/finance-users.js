(() => {
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
  const css = `.financeUserButton{display:block;width:100%;padding:13px;border:1px solid #d2d7e0;background:#fff;color:#233246;border-radius:12px;font:600 14px system-ui;margin:12px 0}.financeUserOverlay{position:fixed;inset:0;background:#0008;z-index:100100;display:grid;place-items:center;padding:16px}.financeUserSheet{width:min(480px,100%);max-height:90dvh;overflow:auto;background:#fff;color:#17212b;border-radius:18px;padding:20px;font:14px system-ui}.financeUserHead{display:flex;justify-content:space-between;align-items:center}.financeUserHead h2{font-size:19px;margin:0}.financeUserHead button{border:0;background:#eee;border-radius:9px;padding:8px 12px}.financeUserSheet label{display:grid;gap:5px;margin-top:10px;font-weight:600}.financeUserSheet input,.financeUserSheet select{box-sizing:border-box;width:100%;padding:11px;font:16px system-ui;border:1px solid #d2d7e0;border-radius:10px}.financeUserEntry{border-bottom:1px solid #eee;padding:12px 0}.financeUserEntry small{color:#777}.financeUserAction{padding:11px;border-radius:10px;border:0;background:#253345;color:#fff;font-weight:700;margin-top:10px}.financeUserError{color:#9e2c2c;white-space:pre-wrap}`;
  document.head.append(el('style',{textContent:css}));
  const client = () => window.familyHomeSupabase;
  const member = async () => {
    const sb=client();
    if(!sb) throw Error('Entre no Family Home para gerenciar os usuários.');
    const session=await sb.auth.getUser();
    if(!session.data.user)throw Error('Entre no Family Home.');
    const response=await sb.from('family_members').select('family_id').eq('user_id',session.data.user.id).limit(1).maybeSingle();
    if(response.error||!response.data)throw Error('Grupo familiar não encontrado.');
    return {sb,familyId:response.data.family_id,userId:session.data.user.id};
  };
  async function show(){
    document.querySelector('.financeUserOverlay')?.remove();
    const overlay=el('div',{className:'financeUserOverlay'});
    const sheet=el('section',{className:'financeUserSheet'});
    overlay.append(sheet);document.body.append(overlay);
    const heading=()=>{sheet.innerHTML='<div class="financeUserHead"><h2>Usuários financeiros</h2><button type="button">Fechar</button></div><p>Admins podem ver as finanças da família e dos demais usuários. Usuários comuns têm acesso apenas aos seus próprios dados financeiros.</p>';sheet.querySelector('.financeUserHead button').onclick=()=>overlay.remove()};
    heading();
    try{
      const {sb,familyId,userId}=await member();
      const {data,error}=await sb.from('finance_users').select('user_id,name,email,role').eq('family_id',familyId).order('name');
      if(error)throw error;
      const me=data.find(x=>x.user_id===userId),admin=me?.role==='admin';
      const rows=el('div');sheet.append(rows);
      for(const user of data){
        const row=el('div',{className:'financeUserEntry'}),name=el('strong',{textContent:user.name}),email=el('small',{textContent:user.email});
        row.append(name,el('div'));row.lastChild.append(email);
        if(admin){
          const editName=el('input',{value:user.name,ariaLabel:'Nome'});
          const role=el('select');[['user','Usuário'],['admin','Admin']].forEach(([value,label])=>role.append(el('option',{value,textContent:label})));role.value=user.role;
          const save=el('button',{className:'financeUserAction',textContent:'Salvar alterações'});
          const status=el('div',{className:'financeUserError'});
          save.onclick=async()=>{
            const response=await sb.rpc('finance_update_user',{target_family:familyId,target_user:user.user_id,new_name:editName.value,new_role:role.value});
            if(response.error){status.textContent=response.error.message;return;}
            await show();
          };
          row.append(editName,role,save,status);
        } else row.append(el('p',{textContent:user.role==='admin'?'Admin':'Usuário'}));
        rows.append(row);
      }
      if(admin){
        const add=el('form');add.innerHTML='<h3>Adicionar usuário</h3><p>É necessário que a pessoa já faça parte do grupo familiar.</p><label>Nome<input name="personName" required></label><label>E-mail<input name="personEmail" type="email" required></label><label>Tipo<select name="personRole"><option value="user">Usuário</option><option value="admin">Admin</option></select></label><button class="financeUserAction" type="submit">Cadastrar</button><div class="financeUserError"></div>';
        add.onsubmit=async e=>{e.preventDefault();const fields=new FormData(add);const response=await sb.rpc('finance_register_member',{target_family:familyId,member_email:String(fields.get('personEmail')),member_name:String(fields.get('personName')),member_role:String(fields.get('personRole'))});if(response.error){add.querySelector('.financeUserError').textContent=response.error.message;return;}await show()};
        sheet.append(add);
      }
    }catch(error){sheet.append(el('p',{className:'financeUserError',textContent:error.message||'Não foi possível carregar os usuários.'}))}
  }
  function enhance(){
    const page=document.querySelector('.fhBudgetHero');
    if(!page||document.querySelector('[data-finance-users]'))return;
    const button=el('button',{className:'financeUserButton',textContent:'Gerenciar usuários financeiros'});
    button.dataset.financeUsers='1';button.onclick=show;page.after(button);
  }
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();
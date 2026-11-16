(()=>{
const c=window.FAMILY_HOME_SYNC_CONFIG||{};if(!c.url||!c.publishableKey||!window.supabase||!window.familyHomeListSync)return;
const sb=window.familyHomeSupabase||window.supabase.createClient(c.url,c.publishableKey);window.familyHomeSupabase=sb;
const VAPID='BFyYfcW72ztTEzNiFGzvXkzARJByYZJEajb5fQ63dGmkK7T0tPRHLJyL21zhpvdR_mNloGiXk8L74-iYneg-i2k';
const css=`.fhSyncModal{position:fixed;inset:0;z-index:99999;background:#0007;display:grid;place-items:center;padding:22px}.fhSyncBox{width:min(390px,100%);background:#fff;border-radius:24px;padding:22px;box-shadow:0 24px 70px #0003;font-family:system-ui;color:#171717}.fhSyncBox h2{margin:0 0 8px}.fhSyncBox p{color:#666;line-height:1.4}.fhSyncBox input{box-sizing:border-box;width:100%;padding:13px 14px;margin:6px 0;border:1px solid #ddd;border-radius:12px;font-size:16px}.fhSyncBox button{width:100%;padding:13px;margin-top:8px;border:0;border-radius:12px;background:#171717;color:#fff;font-weight:700;font-size:15px}.fhSyncBox button.secondary{background:#eee;color:#222}.fhSyncMsg{margin-top:10px;font-size:13px;color:#555;line-height:1.35}.fhSyncPill{position:fixed;right:14px;top:max(12px,env(safe-area-inset-top));z-index:9000;border:0;border-radius:999px;padding:8px 11px;background:#171717;color:white;font-size:12px;font-weight:700;box-shadow:0 4px 16px #0002}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const E=(t,p={})=>Object.assign(document.createElement(t),p);let currentMembership=null,currentUser=null,channels=[];
function modal(title){document.querySelector('.fhSyncModal')?.remove();const o=E('div',{className:'fhSyncModal'}),b=E('div',{className:'fhSyncBox'});b.append(E('h2',{textContent:title}));o.append(b);document.body.append(o);return[o,b]}
function input(ph,type='text'){return E('input',{placeholder:ph,type})}function button(text,fn,secondary=false){const x=E('button',{textContent:text,className:secondary?'secondary':''});x.onclick=fn;return x}function message(b,text){let m=b.querySelector('.fhSyncMsg');if(!m){m=E('div',{className:'fhSyncMsg'});b.append(m)}m.textContent=text}
function b64(s){const p='='.repeat((4-s.length%4)%4),v=(s+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(v),a=new Uint8Array(r.length);for(let i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a}
function sameKey(sub){const k=sub?.options?.applicationServerKey;if(!k)return false;const a=new Uint8Array(k),b=b64(VAPID);if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
async function subscription(){if(!('serviceWorker'in navigator))return null;const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription()}
async function isPushActive(){const sub=await subscription();if(!sub||!sameKey(sub)||!currentUser)return false;const {data}=await sb.from('push_subscriptions').select('id').eq('user_id',currentUser.id).eq('endpoint',sub.endpoint).maybeSingle();return!!data}
async function enableNotifications(box){try{message(box,'Ativando notificações…');if(!window.isSecureContext){message(box,'As notificações precisam de uma conexão segura (HTTPS).');return false}if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){message(box,'Este navegador não oferece Web Push. No Android, abra o Family Home no Chrome atualizado.');return false}if(!window.matchMedia('(display-mode: standalone)').matches&&/iPhone|iPad|iPod/i.test(navigator.userAgent)){message(box,'No iPhone, primeiro adicione o Family Home à Home Screen e abra pelo ícone.');return false}let permission=Notification.permission;if(permission==='denied'){message(box,'As notificações estão bloqueadas para o Family Home. Libere a permissão nas configurações do site/app do Chrome e tente novamente.');return false}if(permission!=='granted')permission=await Notification.requestPermission();if(permission!=='granted'){message(box,'A permissão de notificações não foi concedida. Se o Android não mostrou a pergunta, verifique a permissão de notificações do Chrome/Family Home.');return false}if(!currentMembership||!currentUser){message(box,'Entre na sua família antes de ativar as notificações.');return false}message(box,'Permissão concedida. Registrando este celular…');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(sub&&!sameKey(sub)){await sb.from('push_subscriptions').delete().eq('user_id',currentUser.id).eq('endpoint',sub.endpoint);await sub.unsubscribe();sub=null}if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(VAPID)});const j=sub.toJSON(),keys=j.keys||{};if(!j.endpoint||!keys.p256dh||!keys.auth){message(box,'O Android concedeu a permissão, mas não retornou uma inscrição Push válida. Atualize o Chrome e tente novamente.');return false}const {error}=await sb.from('push_subscriptions').upsert({family_id:currentMembership.family_id,user_id:currentUser.id,endpoint:j.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'user_id,endpoint'});if(error){console.error(error);message(box,'A permissão funcionou, mas não consegui registrar este celular no Family Home.');return false}try{await reg.showNotification('Family Home 🏠',{body:'Notificações ativadas neste celular.',tag:'family-home-ready',data:{url:'/family-home/'}})}catch(e){console.warn('Family Home local notification:',e)}localStorage.setItem('fh-notification-permission','granted');message(box,'Pronto! Este celular está registrado para receber notificações.');return true}catch(e){console.error('Family Home push activation:',e);const name=e?.name||'';if(name==='NotAllowedError')message(box,'O Android bloqueou a permissão de notificações. Libere notificações para o Chrome/Family Home e tente novamente.');else if(name==='AbortError')message(box,'O serviço de Push do Android não conseguiu concluir o registro. Verifique a internet e atualize o Chrome antes de tentar novamente.');else message(box,'Não consegui ativar o Push neste Android. Erro: '+(name||'registro não concluído'));return false}}
async function disableNotifications(box){const sub=await subscription();if(sub&&currentUser)await sb.from('push_subscriptions').delete().eq('user_id',currentUser.id).eq('endpoint',sub.endpoint);if(sub)await sub.unsubscribe();localStorage.removeItem('fh-notification-permission');message(box,'Notificações desativadas neste celular.');return true}

const repository = window.familyHomeListSync.createRepository(sb);
const {mergeLists, equal, Conflict} = window.familyHomeListSync;
const LOCAL_LISTS = 'family-home-lists';
let connection = null, syncTimer, syncState = 'waiting', signInGeneration = 0;

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function status(state) {
  syncState = state;
  window.dispatchEvent(new CustomEvent('family-home-sync-status', {detail: state}));
}

function emitCloud(payload) {
  window.dispatchEvent(new CustomEvent('family-home-cloud-data', {detail: {payload}}));
}

function persist(context) {
  context.durable = writeLocal(context.key, {snapshot: context.snapshot, pending: context.pending});
}

function publish(context) {
  if (connection !== context) return;
  context.visible = context.pending.reduce(
    (lists, change) => mergeLists(change.before, change.after, lists, true),
    context.snapshot
  );
  writeLocal(LOCAL_LISTS, context.visible);
  emitCloud(context.visible);
}

function editLists(before, after) {
  const context = connection;
  if (!context) return false;
  if (equal(before, after)) return true;
  const tail = context.pending.at(-1);
  if (tail && !tail.attempted) {
    tail.after = after;
    if (equal(tail.before, after)) context.pending.pop();
  } else {
    context.pending.push({before, after, attempted: false});
  }
  persist(context);
  publish(context);
  status(context.durable ? 'pending' : 'storage');
  queueSync(150);
  return true;
}

async function loadLists() {
  if (!connection) return null;
  return (await repository.read(connection.familyId)).lists;
}

async function saveLists(before, after) {
  const context = connection;
  if (!context) throw new Error('Family Home membership unavailable');
  return repository.save(context.familyId, context.userId, before, after, () => {
    if (connection !== context) throw new Error('Family Home session changed');
  });
}

function stopRealtime() {
  channels.forEach(channel => { void sb.removeChannel(channel); });
  channels = [];
  clearTimeout(syncTimer);
}

function queueSync(delay = 250) {
  if (!connection) return;
  if (connection.running) {
    connection.refresh = true;
    return;
  }
  if (syncTimer !== undefined) return;
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    void synchronize();
  }, delay);
}

async function synchronize() {
  const context = connection;
  if (!context || context.running) return;
  if (navigator.onLine === false) {
    status(context.pending.length && !context.durable ? 'storage' : 'offline');
    return;
  }

  context.running = true;
  const hadPending = context.pending.length > 0;
  if (hadPending) status('syncing');
  try {
    while (connection === context && context.pending.length) {
      const change = context.pending[0];
      change.attempted = true;
      persist(context);
      const saved = await api.saveLists(change.before, change.after);
      if (connection !== context) return;
      context.snapshot = saved;
      context.pending.shift();
      persist(context);
      publish(context);
    }

    if (!hadPending) {
      const {lists} = await repository.read(context.familyId);
      if (connection !== context) return;
      if (!equal(context.snapshot, lists)) {
        context.snapshot = lists;
        persist(context);
        publish(context);
      }
    }
    if (context.seed && !context.pending.length) {
      context.seed = false;
      if (context.snapshot.length === 0) window.dispatchEvent(new Event('family-home-seed-lists'));
    }
    if (!context.pending.length) status('synced');
  } catch (error) {
    if (connection !== context) return;
    status(error instanceof Conflict ? 'conflict' : context.pending.length && !context.durable ? 'storage' : 'error');
    if (!(error instanceof Conflict)) console.warn('Family Home: sincronização indisponível.');
  } finally {
    context.running = false;
    if (connection === context && context.refresh) {
      context.refresh = false;
      if (!['error', 'storage', 'conflict'].includes(syncState)) queueSync();
    }
  }
}

function startRealtime() {
  const familyId = connection.familyId;
  for (const table of ['family_lists', 'list_categories', 'list_items', 'family_documents']) {
    const options = {event: '*', schema: 'public', table};
    if (table === 'family_lists' || table === 'family_documents') options.filter = `family_id=eq.${familyId}`;
    const channel = sb.channel(`family-home-${table}-${familyId}`)
      .on('postgres_changes', options, () => queueSync())
      .subscribe(state => { if (state === 'SUBSCRIBED') queueSync(); });
    channels.push(channel);
  }
}

function activate(user, member, seed = false) {
  const key = `fh-list-sync-v2:${user.id}:${member.family_id}`;
  currentUser = user;
  currentMembership = member;
  if (connection?.key === key) {
    connection.seed ||= seed;
    queueSync(0);
    return;
  }

  stopRealtime();
  syncTimer = undefined;
  const previous = readLocal('fh-list-sync-owner-v2', null);
  if (previous == null) {
    const legacy = readLocal(LOCAL_LISTS, null);
    if (Array.isArray(legacy) && legacy.length && readLocal('fh-list-recovery-v1', null) == null) {
      if (!writeLocal('fh-list-recovery-v1', legacy)) {
        status('storage');
        return;
      }
    }
  }
  writeLocal('fh-list-sync-owner-v2', key);
  const saved = readLocal(key, {});
  connection = {key, userId: user.id, familyId: member.family_id,
    snapshot: saved.snapshot || [], pending: saved.pending || [], seed, durable: true};
  status(connection.pending.length ? 'pending' : 'waiting');
  publish(connection);
  startRealtime();
  queueSync(0);
  window.dispatchEvent(new CustomEvent('family-home-family-ready', {detail: member}));
}

function clearSession() {
  currentMembership = null;
  currentUser = null;
  connection = null;
  stopRealtime();
  syncTimer = undefined;
  for (const key of [LOCAL_LISTS, 'fh-active-list-id', 'fh-shell-route', 'fh-item-draft-v1']) {
    try { localStorage.removeItem(key); } catch {}
  }
  document.querySelector('.fhSyncPill')?.remove();
  emitCloud([]);
  status('waiting');
}

const api = {
  get currentMembership() { return currentMembership; },
  get visibleLists() { return connection?.visible; },
  get syncState() { return syncState; },
  get draftScope() { return connection?.key; },
  loadLists, saveLists, editLists, isPushActive, enableNotifications, disableNotifications,
  retry() { if (connection) queueSync(0); else void establishSession(); },
  async refresh() { await showHome(); return currentMembership; },
  discardConflict() {
    const context = connection;
    if (!context || context.running || syncState !== 'conflict' || !context.pending.length) return;
    // Keep previously submitted changes and the local values visible until the user chooses
    // to continue with the shared version. The fresh read reconciles any partial writes.
    if (!confirm('Descartar as alterações de lista ainda pendentes neste aparelho e carregar a versão da família?')) return;
    const recoveryKey = `${context.key}:recovery`;
    if (!writeLocal(recoveryKey, context.pending)) { status('storage'); return; }
    context.pending = [];
    persist(context);
    publish(context);
    status('waiting');
    queueSync(0);
  }
};
window.familyHomeCloud = api;

const recoverSync = () => {
  if (document.visibilityState !== 'hidden') {
    if (connection) queueSync(0);
    else void establishSession();
  }
};
for (const event of ['online', 'focus', 'pageshow']) window.addEventListener(event, recoverSync);
document.addEventListener('visibilitychange', recoverSync);
setInterval(() => {
  if (connection && document.visibilityState !== 'hidden') queueSync(0);
}, 15000);

function showAccount(member) {
  if (document.querySelector('.fhSyncPill')) return;
  const pill = E('button',{className:'fhSyncPill',textContent:'☁ Família e sincronização'});
  pill.onclick = async () => {
    const {data: family} = await sb.from('families').select('name,invite_code').eq('id',member.family_id).single();
    if (currentMembership?.family_id !== member.family_id) return;
    const [overlay, box] = modal(family?.name || 'Família');
    let active = await isPushActive();
    if (!overlay.isConnected) return;
    const notifications = button(active ? '🔕 Desativar notificações' : '🔔 Ativar notificações', async () => {
      notifications.disabled = true;
      const ok = active ? await disableNotifications(box) : await enableNotifications(box);
      notifications.disabled = false;
      if (ok) {
        active = !active;
        notifications.textContent = active ? '🔕 Desativar notificações' : '🔔 Ativar notificações';
      }
    });
    box.append(
      E('p',{textContent:'Conectado como ' + member.display_name}),
      E('p',{textContent:'Código de convite: ' + (family?.invite_code || '')}),
      notifications, button('Fechar', () => overlay.remove()),
      button('Sair', async () => {
        const {error} = await sb.auth.signOut();
        if (error) message(box, 'Não foi possível sair. Tente novamente.');
      }, true)
    );
  };
  document.body.append(pill);
}

async function showHome(seed = false, preferredFamily) {
  const generation = ++signInGeneration;
  try {
    const {data, error} = await sb.auth.getUser();
    if (generation !== signInGeneration) return;
    if (error) throw error;
    const user = data.user;
    if (!user) return;
    let query = sb.from('family_members').select('family_id,display_name,role').eq('user_id', user.id);
    if (preferredFamily) query = query.eq('family_id', preferredFamily);
    const {data: member, error: memberError} = await query.order('joined_at').limit(1).maybeSingle();
    if (generation !== signInGeneration) return;
    if (memberError) throw memberError;
    if (!member) {
      if (connection) clearSession();
      showFamilySetup();
      return;
    }
    writeLocal(`fh-list-membership-v2:${user.id}`, member);
    activate(user, member, seed);
    document.querySelector('.fhSyncModal')?.remove();
    showAccount(member);
  } catch {
    if (generation === signInGeneration && !connection) status('error');
  }
}

async function establishSession() {
  const generation = signInGeneration;
  try {
    const {data, error} = await sb.auth.getSession();
    if (generation !== signInGeneration) return;
    if (error) throw error;
    const user = data.session?.user;
    if (!user) {
      if (!document.querySelector('.fhSyncModal')) showAuth();
      return;
    }
    const member = readLocal(`fh-list-membership-v2:${user.id}`, null);
    if (member) {
      activate(user, member);
      showAccount(member);
    }
    if (navigator.onLine !== false) await showHome();
  } catch {
    if (generation === signInGeneration && !connection) status('error');
  }
}
function showFamilySetup(){const[o,b]=modal('Configurar família');b.append(E('p',{textContent:'Crie sua casa neste celular ou entre em uma família existente.'}));const name=input('Seu nome');name.value='Hellen';const family=input('Nome da família');family.value='Ramos';const code=input('Código de convite');b.append(name,family,button('Criar família',async()=>{const {data,error}=await sb.rpc('create_family',{p_name:family.value.trim()||'Ramos',p_display_name:name.value.trim()||'Hellen'});if(error)return message(b,error.message);message(b,'Família criada. Código: '+data?.[0]?.invite_code);void showHome(true,data?.[0]?.family_id)}),code,button('Entrar com código',async()=>{const {data,error}=await sb.rpc('join_family',{p_invite_code:code.value.trim(),p_display_name:name.value.trim()||'Membro'});if(error)return message(b,error.message);void showHome(false,data)},true))}
function showAuth(){const[o,b]=modal('Family Home');b.append(E('p',{textContent:'Entre para sincronizar a casa entre os celulares.'}));const email=input('E-mail','email'),pass=input('Senha','password');b.append(email,pass,button('Entrar',async()=>{const {error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:pass.value});if(error)return message(b,error.message);o.remove();void showHome()}),button('Criar conta',async()=>{const {error}=await sb.auth.signUp({email:email.value.trim(),password:pass.value});if(error)return message(b,error.message);message(b,'Conta criada. Se receber um e-mail de confirmação, confirme e depois entre.')},true))}
void establishSession();
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && currentUser?.id !== session.user.id) {
    setTimeout(() => { void establishSession(); }, 0);
  }
  if (event === 'SIGNED_OUT') {
    signInGeneration++;
    clearSession();
    showAuth();
  }
});
})();

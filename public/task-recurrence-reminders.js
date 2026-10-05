(()=>{
const META='fh-house-meta-v1',LISTS='family-home-lists';
const dayIndex={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const localDate=(d=new Date())=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const parseDate=s=>new Date(`${s}T12:00:00`);
const addDays=(s,n)=>{const d=parseDate(s);d.setDate(d.getDate()+n);return localDate(d)};
const house=lists=>lists.find(l=>l.id==='house'||norm(l.name).includes('tarefas da casa'));
const isRecurring=m=>m&&m.repeat&&m.repeat!=='none';
function nextAfter(date,m){
 if(m.repeat==='daily')return addDays(date,1);
 if(m.repeat==='custom'){
  const wanted=new Set((m.repeatDays||[]).map(x=>dayIndex[x]));
  for(let i=1;i<=7;i++){const d=parseDate(date);d.setDate(d.getDate()+i);if(wanted.has(d.getDay()))return localDate(d)}
 }
 if(m.repeat==='weekly')return addDays(date,7);
 if(m.repeat==='monthly'){
  const base=parseDate(date),anchor=m.dueDate?Number(m.dueDate.slice(8,10)):base.getDate();
  const y=base.getFullYear(),mo=base.getMonth()+1,last=new Date(y,mo+1,0).getDate();
  return localDate(new Date(y,mo,Math.min(anchor,last),12));
 }
 if(m.repeat==='yearly'){
  const base=parseDate(date),anchor=m.dueDate?parseDate(m.dueDate):base;
  const y=base.getFullYear()+1,mo=anchor.getMonth(),day=anchor.getDate(),last=new Date(y,mo+1,0).getDate();
  return localDate(new Date(y,mo,Math.min(day,last),12));
 }
 return'';
}
function reconcile(initial=false){
 const lists=get(LISTS,[]),h=house(lists);if(!h)return false;
 const meta=get(META,{}),today=localDate();let changed=false;
 h.items.forEach(item=>{const m=meta[norm(item.name)]||{};if(!item.done||!isRecurring(m))return;let next=m.nextDueDate;if(!next&&m.lastCompletedOn)next=nextAfter(m.lastCompletedOn,m);if(next&&next<=today){item.done=false;m.nextDueDate=next;m.reopenedOn=today;meta[norm(item.name)]=m;changed=true}});
 if(changed){put(META,meta);put(LISTS,lists);if(!initial&&document.readyState!=='loading')setTimeout(()=>location.reload(),40)}
 return changed;
}
reconcile(true);
function markCompletion(task,done){
 const meta=get(META,{}),k=norm(task),m=meta[k]||{};
 if(!isRecurring(m))return;
 if(done){const completed=localDate();m.lastCompletedOn=completed;m.nextDueDate=nextAfter(completed,m);m.reopenedOn=undefined}
 else{m.lastCompletedOn=undefined;m.nextDueDate=undefined;m.reopenedOn=undefined}
 meta[k]=m;put(META,meta);
}
function processItemClick(button){
 const row=button.closest('.item'),task=row?.querySelector('.itemName')?.textContent?.trim();if(!task)return;
 const wasDone=row.classList.contains('done');
 setTimeout(()=>markCompletion(task,!wasDone),120);
}
function processBulk(action){
 setTimeout(()=>{const lists=get(LISTS,[]),h=house(lists);if(!h)return;const meta=get(META,{});h.items.forEach(item=>{const m=meta[norm(item.name)]||{};if(!isRecurring(m))return;if(action==='complete'&&item.done){const completed=localDate();m.lastCompletedOn=completed;m.nextDueDate=nextAfter(completed,m)}if(action==='reset'){m.lastCompletedOn=undefined;m.nextDueDate=undefined;m.reopenedOn=undefined}meta[norm(item.name)]=m});put(META,meta)},160)
}
function reminderLabel(m){if(!m.dueDate)return'';const d=parseDate(m.dueDate).toLocaleDateString('pt-BR');const t=m.dueTime?` às ${m.dueTime}`:'';const r=m.reminderEnabled?` · lembrete ${reminderText(Number(m.reminderMinutes||0))}`:'';return`${d}${t}${r}`}
function reminderText(v){return v===0?'no horário':v===5?'5 min antes':v===15?'15 min antes':v===30?'30 min antes':v===60?'1 h antes':v===120?'2 h antes':v===1440?'1 dia antes':`${v} min antes`}
function currentTaskFromEditor(){const sheet=[...document.querySelectorAll('.nativeSheet')].find(s=>norm(s.querySelector('.nativeSheetHead h2')?.textContent)==='editar');return sheet?.querySelector('.nativeRow input')?.value?.trim()||''}
function openReminder(task){
 document.querySelector('.fhBox')?.remove();const meta=get(META,{}),k=norm(task),m=meta[k]||{};
 const o=document.createElement('div');o.className='fhBox fhReminderBox';
 o.innerHTML=`<section><header><button type="button" data-x>×</button><b>Data e lembrete</b><button type="button" data-s>Salvar</button></header><div class="fhBody"><label>Data<input id="fhDueDate" type="date" value="${esc(m.dueDate||'')}"></label><label>Horário<input id="fhDueTime" type="time" value="${esc(m.dueTime||'')}"></label><label class="fhReminderToggle"><span><input id="fhReminderEnabled" type="checkbox" ${m.reminderEnabled?'checked':''}> Ativar lembrete</span></label><label id="fhReminderOffsetLabel">Avisar<select id="fhReminderMinutes"><option value="0">No horário</option><option value="5">5 minutos antes</option><option value="15">15 minutos antes</option><option value="30">30 minutos antes</option><option value="60">1 hora antes</option><option value="120">2 horas antes</option><option value="1440">1 dia antes</option></select></label><small class="fhReminderNote">O app avisa enquanto estiver aberto. Notificações com o app fechado serão ativadas quando a sincronização online estiver pronta.</small></div></section>`;
 o.querySelector('#fhReminderMinutes').value=String(m.reminderMinutes??15);
 const sync=()=>o.querySelector('#fhReminderOffsetLabel').style.display=o.querySelector('#fhReminderEnabled').checked?'grid':'none';sync();o.querySelector('#fhReminderEnabled').onchange=sync;
 o.querySelector('[data-x]').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};
 o.querySelector('[data-s]').onclick=async()=>{const dueDate=o.querySelector('#fhDueDate').value,dueTime=o.querySelector('#fhDueTime').value,enabled=o.querySelector('#fhReminderEnabled').checked,mins=Number(o.querySelector('#fhReminderMinutes').value);m.dueDate=dueDate||undefined;m.dueTime=dueTime||undefined;m.reminderEnabled=!!(enabled&&dueDate&&dueTime);m.reminderMinutes=mins;m.lastNotifiedOccurrence=undefined;meta[k]=m;put(META,meta);if(m.reminderEnabled&&'Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission()}catch{}}o.remove();enhanceRows();checkReminders()};
 document.body.append(o)
}
function occurrenceForToday(m,today){
 const d=parseDate(today),dow=d.getDay();if(m.dueDate&&today<m.dueDate)return false;
 if(!m.repeat||m.repeat==='none')return m.dueDate===today;
 if(m.repeat==='daily')return true;
 if(m.repeat==='custom')return(m.repeatDays||[]).some(x=>dayIndex[x]===dow);
 if(m.repeat==='weekly'&&m.dueDate)return parseDate(m.dueDate).getDay()===dow;
 if(m.repeat==='monthly'&&m.dueDate)return Number(m.dueDate.slice(8,10))===d.getDate();
 if(m.repeat==='yearly'&&m.dueDate)return m.dueDate.slice(5)===today.slice(5);
 return false
}
function toast(text){document.querySelector('.fhReminderToast')?.remove();const t=document.createElement('div');t.className='fhReminderToast';t.textContent=text;document.body.append(t);setTimeout(()=>t.remove(),6500)}
async function notify(title,body){toast(`🔔 ${title}${body?` · ${body}`:''}`);if(!('Notification'in window)||Notification.permission!=='granted')return;try{const reg=await navigator.serviceWorker?.ready;if(reg?.showNotification)await reg.showNotification(title,{body,tag:`fh-${norm(title)}`});else new Notification(title,{body})}catch{}}
function checkReminders(){
 const lists=get(LISTS,[]),h=house(lists);if(!h)return;const meta=get(META,{}),today=localDate(),now=Date.now();let changed=false;
 h.items.filter(i=>!i.done).forEach(item=>{const k=norm(item.name),m=meta[k]||{};if(!m.reminderEnabled||!m.dueTime||!occurrenceForToday(m,today))return;const when=new Date(`${today}T${m.dueTime}:00`).getTime(),trigger=when-Number(m.reminderMinutes||0)*60000,occ=`${today}T${m.dueTime}`;if(now>=trigger&&now<=when+12*3600000&&m.lastNotifiedOccurrence!==occ){m.lastNotifiedOccurrence=occ;meta[k]=m;changed=true;notify(item.name,m.assignee?`Responsável: ${m.assignee}`:'Tarefa da casa')}});if(changed)put(META,meta)
}
function enhanceRows(){document.querySelectorAll('.nativeSheet').forEach(s=>{if(norm(s.querySelector('.nativeSheetHead h2')?.textContent)!=='editar')return;const task=s.querySelector('.nativeRow input')?.value?.trim();if(!task)return;const m=get(META,{})[norm(task)]||{};[...s.querySelectorAll('.nativeRow')].forEach(r=>{if(!norm(r.textContent).includes('definir data e lembrete'))return;const val=r.querySelector('.fhVal');if(val)val.textContent=reminderLabel(m)})})}
document.addEventListener('click',e=>{
 const check=e.target.closest?.('.itemCheck');if(check&&norm(document.querySelector('.listHeader h1')?.textContent).includes('tarefas da casa'))processItemClick(check);
 const row=e.target.closest?.('.nativeRow');if(row&&norm(row.textContent).includes('definir data e lembrete')&&norm(document.querySelector('.listHeader h1')?.textContent).includes('tarefas da casa')){const task=currentTaskFromEditor();if(task){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openReminder(task);return}}
 const b=e.target.closest?.('.menu button');if(b){const t=norm(b.textContent);if(t.includes('concluir todos'))processBulk('complete');if(t.includes('desmarcar todos'))processBulk('reset')}
},true);
let pending=false;const obs=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhanceRows()})});obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('focus',()=>{if(!reconcile(false))checkReminders()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!reconcile(false))checkReminders()}});setInterval(()=>{if(!reconcile(false))checkReminders()},30000);setTimeout(()=>{enhanceRows();checkReminders()},500);
})();
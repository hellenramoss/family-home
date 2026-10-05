(()=>{
const K={cal:'fh-calendar-v1',special:'fh-special-v1',meals:'fh-meals-v1',time:'fh-timetable-v1'},LISTS='family-home-lists',META='fh-house-meta-v1';
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localDate=(d=new Date())=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const short=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],long=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const dayIndex={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
let offset=0;
function start(){const d=new Date();const diff=(d.getDay()+6)%7;d.setDate(d.getDate()-diff+offset*7);d.setHours(12,0,0,0);return d}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function houseTasks(){const lists=get(LISTS,[]),house=lists.find(l=>l.id==='house'||norm(l.name).includes('tarefas da casa')),meta=get(META,{});return(house?.items||[]).filter(i=>!i.done).map(i=>({item:i,m:meta[norm(i.name)]||{}})).filter(x=>x.m.dueDate||x.m.repeat&&x.m.repeat!=='none')}
function taskMatch(m,d){const key=localDate(d),dow=d.getDay();if(m.repeat==='daily')return true;if(m.repeat==='custom')return(m.repeatDays||[]).some(x=>dayIndex[x]===dow);if(m.repeat==='weekly'&&m.dueDate)return new Date(m.dueDate+'T12:00:00').getDay()===dow;if(m.repeat==='monthly'&&m.dueDate)return Number(m.dueDate.slice(8,10))===d.getDate();if(m.repeat==='yearly'&&m.dueDate)return m.dueDate.slice(5)===key.slice(5);return m.dueDate===key}
function modal(date){
 document.querySelector('.fhCalendarModal')?.remove();const o=document.createElement('div');o.className='fhModal fhCalendarModal';
 o.innerHTML=`<section><header><button type="button" data-close>×</button><h2>Novo evento</h2><button type="button" data-save>Salvar</button></header><form><label>Título<input name="title" required placeholder="Ex.: Consulta"></label><div class="fhFormGrid"><label>Data<input name="date" type="date" value="${date}"></label><label>Horário<input name="time" type="time"></label></div></form></section>`;
 o.querySelector('[data-close]').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};o.querySelector('[data-save]').onclick=()=>{const f=o.querySelector('form'),title=f.title.value.trim();if(!title)return f.title.focus();const a=get(K.cal,[]);a.push({id:uid(),title,date:f.date.value,time:f.time.value});put(K.cal,a);o.remove();render(true)};document.body.append(o)
}
function removeEvent(id){if(!confirm('Excluir este evento do calendário?'))return;put(K.cal,get(K.cal,[]).filter(x=>x.id!==id));render(true)}
function render(force=false){
 const week=document.querySelector('.fhWeek'),agenda=document.querySelector('.fhAgenda');if(!week||!agenda)return;
 const s=start(),events=get(K.cal,[]),meals=get(K.meals,[]),times=get(K.time,[]),special=get(K.special,[]),tasks=houseTasks();
 const sig=JSON.stringify({offset,events,meals,times,special,tasks:tasks.map(x=>[x.item.id,x.item.name,x.m])});if(!force&&agenda.dataset.calV2===sig)return;agenda.dataset.calV2=sig;
 let nav=week.parentElement.querySelector('.fhCalendarNav');if(!nav){nav=document.createElement('div');nav.className='fhCalendarNav';week.before(nav)}
 const end=new Date(s);end.setDate(s.getDate()+6);
 nav.innerHTML=`<button type="button" data-prev>‹</button><div><strong>${s.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} a ${end.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</strong><button type="button" data-today>Hoje</button></div><button type="button" data-next>›</button>`;
 nav.querySelector('[data-prev]').onclick=()=>{offset--;render(true)};nav.querySelector('[data-next]').onclick=()=>{offset++;render(true)};nav.querySelector('[data-today]').onclick=()=>{offset=0;render(true)};
 week.innerHTML='';agenda.innerHTML='';
 for(let i=0;i<7;i++){const d=new Date(s);d.setDate(s.getDate()+i);const key=localDate(d),b=document.createElement('button');b.type='button';b.className=key===localDate()?'today':'';b.innerHTML=`<small>${short[d.getDay()]}</small><b>${d.getDate()}</b>`;b.onclick=()=>{week.querySelectorAll('button').forEach(x=>x.classList.remove('fhSelectedDay'));b.classList.add('fhSelectedDay');agenda.children[i]?.scrollIntoView({behavior:'smooth',block:'start'})};week.append(b)}
 const today=[...week.children].find((_,i)=>{const d=new Date(s);d.setDate(s.getDate()+i);return localDate(d)===localDate()});today?.classList.add('fhSelectedDay');
 for(let i=0;i<7;i++){const d=new Date(s);d.setDate(s.getDate()+i);const key=localDate(d),dow=d.getDay(),items=[];
   events.filter(x=>x.date===key).forEach(x=>items.push({time:x.time||'',icon:'📌',title:x.title,kind:'Evento',id:x.id}));
   meals.filter(x=>x.date===key).forEach(x=>items.push({time:'',icon:'🍽️',title:x.title,kind:x.type}));
   times.filter(x=>(x.days||[]).includes(dow)).forEach(x=>items.push({time:x.time||'',icon:'🗓️',title:x.title,kind:x.person||'Rotina'}));
   special.forEach(x=>{const sd=new Date(x.date+'T12:00:00');if((x.annual&&sd.getMonth()===d.getMonth()&&sd.getDate()===d.getDate())||(!x.annual&&x.date===key))items.push({time:'',icon:x.emoji||'🎉',title:x.title,kind:'Dia especial'})});
   tasks.filter(x=>taskMatch(x.m,d)).forEach(x=>items.push({time:x.m.dueTime||'',icon:'🏠',title:x.item.name,kind:[x.m.assignee,'Tarefa da casa'].filter(Boolean).join(' · ')}));
   items.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
   const day=document.createElement('div');day.className='fhDay';day.dataset.houseSynced='1';
   day.innerHTML=`<div class="fhDayTitle"><strong>${long[dow]} ${d.getDate()}/${d.getMonth()+1}</strong><button type="button" data-add="${key}">+</button></div>${items.length?items.map(x=>`<div class="fhAgendaItem"><time>${esc(x.time)}</time><span>${x.icon}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.kind)}</small></div>${x.id?`<button type="button" class="fhCalDelete" data-del="${esc(x.id)}">×</button>`:''}</div>`).join(''):'<div class="fhEmpty">Nada planejado</div>'}`;
   day.querySelector('[data-add]').onclick=()=>modal(key);day.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeEvent(b.dataset.del));agenda.append(day)
 }
}
let queued=false;const obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})});obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',()=>render(true));setTimeout(render,0)
})();
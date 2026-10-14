(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const school=[
['2026-10-14','Visita CEMADEN · 3º ano','Revisar data: documento também apresenta atividade em 26/10'],
['2026-10-26','Visita CEMADEN · 3º ano','Revisar data: documento também apresenta atividade em 14/10'],
['2026-10-19','Queimada Pokémon Jr · 1º a 3º anos','Atividade de 19 a 22/10'],
['2026-10-20','Queimada Pokémon Jr · 1º a 3º anos',''],
['2026-10-21','Queimada Pokémon Jr · 1º a 3º anos',''],
['2026-10-22','Queimada Pokémon Jr · 1º a 3º anos',''],
['2026-10-23','Premiação Queimada Pokémon Jr',''],
['2026-11-04','VA Ciências',''],
['2026-11-05','VA História e Geografia · 2º e 3º anos',''],
['2026-11-09','VA Português',''],
['2026-11-10','VA Inglês',''],
['2026-11-11','VA Matemática',''],
['2026-11-12','SUB Geografia e Inglês',''],
['2026-11-13','SUB História e Ciências',''],
['2026-11-16','SUB Português',''],
['2026-11-17','SUB Matemática',''],
['2026-11-18','VG 3º trimestre',''],
['2026-11-23','SUB VG',''],
['2026-11-30','Listas',''],
['2026-12-01','Listas',''],
['2026-12-02','Listas',''],
['2026-12-03','Listas',''],
['2026-12-04','Listas / MAC',''],
['2026-12-07','REAV Ciências e História · 3º trimestre',''],
['2026-12-08','REAV Inglês e Geografia · 3º trimestre',''],
['2026-12-09','REAV Português · 3º trimestre',''],
['2026-12-10','REAV Matemática · 3º trimestre',''],
['2026-12-11','Último dia letivo','']
];
let events=school.map((e,i)=>({date:e[0],title:e[1],notes:e[2],key:'alpha-lumen-2026-2-'+i,selected:true}));
const css='.fhSchoolBtn{border:0;border-radius:12px;background:#e9effb;color:#274e8c;padding:13px;margin:10px 0;width:100%;font-weight:700}.fhSchoolBackdrop{position:fixed;inset:0;z-index:100300;background:#0009;display:grid;place-items:center;padding:13px}.fhSchoolModal{background:white;color:#172437;width:min(650px,100%);max-height:90dvh;overflow:auto;padding:20px;border-radius:20px;font:14px system-ui}.fhSchoolModal header{display:flex;justify-content:space-between;align-items:center}.fhSchoolModal label{display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #eee}.fhSchoolModal label>span{flex:1}.fhSchoolModal label small{display:block;color:#657282}.fhSchoolModal input[type=checkbox]{width:20px;height:20px}.fhSchoolModal button{padding:11px;border:0;border-radius:9px;background:#263e5c;color:white;margin:5px}.fhSchoolModal .schoolWarn{color:#945c10}';
document.head.append(Object.assign(document.createElement('style'),{textContent:css+'.fhSchoolBtn{margin:8px 16px;width:calc(100% - 32px);background:#fff;border:1px solid #e1e7f0;text-align:left;color:#263b59;border-radius:15px}.fhSchoolBackdrop{align-items:end;display:flex;padding:0}.fhSchoolModal{box-sizing:border-box;width:min(550px,100%);max-height:88dvh;border-radius:24px 24px 0 0;background:#fafbfe;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}.fhSchoolModal header{gap:12px}.fhSchoolModal header h2{font-size:21px}.fhSchoolModal label{background:#fff;padding:13px 10px;border-radius:12px;margin:7px 0;border:1px solid #edf0f5}.fhSchoolModal .fhSchoolMonth{text-transform:capitalize;margin:24px 0 10px;color:#556781}.fhSchoolModal footer{position:sticky;bottom:0;background:#fafbfe;display:flex;flex-wrap:wrap;padding:12px 0;gap:5px}.fhSchoolModal footer button{margin:0}.fhSchoolModal footer [data-save]{background:#2c4263}.fhSchoolModal .schoolWarn{background:#fff5e7;padding:12px;border-radius:12px}'}));
function attach(){const page=$('.fhWeek');if(!page||$('.fhSchoolBtn'))return;const b=document.createElement('button');b.className='fhSchoolBtn';b.textContent='▤  Calendário escolar  ›';b.onclick=open;page.before(b)}
function icsText(items){
const field=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const data=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Family Home//Calendario Escolar//PT-BR','CALSCALE:GREGORIAN'];
items.forEach(x=>{const start=x.date.replace(/-/g,'');const next=new Date(x.date+'T12:00:00');next.setDate(next.getDate()+1);const end=next.toLocaleDateString('sv-SE').replace(/-/g,'');data.push('BEGIN:VEVENT','UID:'+x.key+'@family-home.local','DTSTAMP:20261014T000000Z','DTSTART;VALUE=DATE:'+start,'DTEND;VALUE=DATE:'+end,'SUMMARY:'+field(x.title),'DESCRIPTION:'+field(x.notes),'END:VEVENT')});
return data.concat('END:VCALENDAR').join('\r\n');
}
function download(items){const blob=new Blob([icsText(items)],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='alpha-lumen-3ano-2026.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function save(items,status){
const sb=window.familyHomeSupabase;if(!sb){status.textContent='Faça login para importar.';return}
const user=(await sb.auth.getUser()).data.user;if(!user){status.textContent='Faça login para importar.';return}
const profile=await sb.from('finance_users').select('family_id').eq('user_id',user.id).maybeSingle();if(profile.error||!profile.data){status.textContent='Grupo familiar não encontrado.';return}
const values=items.map(x=>({family_id:profile.data.family_id,title:x.title,event_date:x.date,all_day:true,calendar_name:'Escola do Antônio',notes:x.notes||null,source_document:'Calendário Alpha Lumen 2º semestre 2026, 13 OUT',source_key:x.key,created_by:user.id}));
const response=await sb.from('family_calendar_events').upsert(values,{onConflict:'family_id,source_key',ignoreDuplicates:true}).select('title,event_date');if(response.error){status.textContent=response.error.message;return}
const existing=JSON.parse(localStorage.getItem('fh-calendar-v1')||'[]');const keys=new Set(existing.map(x=>x.sourceKey));
items.forEach(x=>{if(!keys.has(x.key))existing.push({id:crypto.randomUUID(),title:x.title,date:x.date,time:'',sourceKey:x.key,kind:'Escola do Antônio'})});
localStorage.setItem('fh-calendar-v1',JSON.stringify(existing));
status.textContent='Eventos salvos no Family Home. Não foram enviados às agendas externas porque ainda não há contas conectadas.';
}
function open(){const backdrop=document.createElement('div');backdrop.className='fhSchoolBackdrop';const modal=document.createElement('section');modal.className='fhSchoolModal';backdrop.append(modal);document.body.append(backdrop);
modal.innerHTML='<header><h2>Calendário escolar</h2><button data-close>Fechar</button></header><p>Alpha Lumen · 3º ano · 2º semestre de 2026</p><p class="schoolWarn">Confira as datas do CEMADEN antes de importar.</p><div class="fhSchoolList"></div><footer><button data-all>Selecionar tudo</button><button data-none>Limpar</button><button data-save>Importar selecionados</button><button data-ics>Exportar .ics</button></footer><p class="fhSchoolStatus"></p>';modal.querySelector('[data-close]').onclick=()=>backdrop.remove();
const list=modal.querySelector('.fhSchoolList');
let lastMonth='';
events.forEach(item=>{const ym=item.date.slice(0,7);if(ym!==lastMonth){lastMonth=ym;const h=document.createElement('h3');h.className='fhSchoolMonth';h.textContent=new Date(ym+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});list.append(h)}
const row=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=item.selected;check.onchange=()=>item.selected=check.checked;const info=document.createElement('span');info.innerHTML='<strong>'+esc(item.title)+'</strong><small>'+esc(new Date(item.date+'T12:00:00').toLocaleDateString('pt-BR'))+(item.notes?' · '+esc(item.notes):'')+'</small>';row.append(check,info);list.append(row)});
modal.querySelector('[data-all]').onclick=()=>{events.forEach(x=>x.selected=true);list.querySelectorAll('input').forEach(x=>x.checked=true)};
modal.querySelector('[data-none]').onclick=()=>{events.forEach(x=>x.selected=false);list.querySelectorAll('input').forEach(x=>x.checked=false)};
modal.querySelector('[data-save]').onclick=()=>save(events.filter(x=>x.selected),modal.querySelector('.fhSchoolStatus'));
modal.querySelector('[data-ics]').onclick=()=>download(events.filter(x=>x.selected));
}
let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;attach()})}).observe(document.documentElement,{childList:true,subtree:true});attach();
})();
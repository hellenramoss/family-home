(()=>{
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const setNativeValue=(el,value)=>{const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};
function categoryFor(name){const meta=get('fh-house-meta-v1',{}),cats=get('fh-house-cats-v1',[]),id=meta[norm(name)]?.categoryId;return cats.find(c=>c.id===id)||null}
function fitNote(ta){ta.style.height='0px';ta.style.height=`${Math.max(58,ta.scrollHeight+2)}px`}
function enhance(sheet){
 if(sheet.dataset.taskDetailsReady==='1')return;
 const head=sheet.querySelector('.nativeSheetHead'),title=head?.querySelector('h2'),card=sheet.querySelector('.nativeCard'),del=card?.querySelector('.deleteItemRow');
 if(!head||!title||!card||!del||title.textContent?.trim()!=='Editar')return;
 sheet.dataset.taskDetailsReady='1';sheet.classList.add('taskDetailSheet');sheet.closest('.nativeOverlay')?.classList.add('taskDetailOverlay');title.textContent='Detalhes da tarefa';
 const close=head.querySelector('button:first-child'),save=head.querySelector('button.confirm');
 if(close&&save){close.innerHTML='<span class="taskBack">←</span>';close.setAttribute('aria-label','Salvar e voltar');close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();save.click()},{capture:true});save.classList.add('taskSaveSource');const trash=document.createElement('button');trash.type='button';trash.className='taskDeleteTop';trash.setAttribute('aria-label','Excluir tarefa');trash.innerHTML='<span class="taskTrash">🗑</span>';trash.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();del.click()});head.insertBefore(trash,save)}
 const nameInput=card.querySelector('.nameRow input'),name=nameInput?.value||'',rows=[...card.children];
 const hasCategory=rows.some(r=>r.classList?.contains('nativeRow')&&(r.querySelector('.rowEmoji')||/categoria|category/i.test(r.textContent||'')));
 if(!hasCategory){const cat=categoryFor(name),row=document.createElement('div');row.className='nativeRow taskCategoryRow';row.innerHTML=`<span class="rowEmoji">${cat?.emoji||'🎰'}</span><span>${cat?.name||'Sem categoria'}</span>`;card.querySelector('.nameRow')?.after(row)}
 const listRow=[...card.querySelectorAll('.nativeRow')].find(r=>r.querySelector('.lineIcon')?.textContent==='🛒');if(listRow)listRow.querySelector('.lineIcon').textContent='▤';
 const noteRow=card.querySelector('.noteRow'),noteInput=noteRow?.querySelector('input');
 if(noteRow&&noteInput){noteRow.classList.add('taskNoteRow');const ta=document.createElement('textarea');ta.className='taskNoteArea';ta.placeholder='Adicionar nota';ta.value=noteInput.value;ta.rows=1;ta.addEventListener('input',()=>{setNativeValue(noteInput,ta.value);fitNote(ta)});noteInput.classList.add('taskNoteSource');noteInput.setAttribute('aria-hidden','true');noteInput.after(ta);requestAnimationFrame(()=>fitNote(ta));setTimeout(()=>fitNote(ta),80)}
 if(!card.querySelector('.taskAttachmentRow')){const attachment=document.createElement('button');attachment.type='button';attachment.className='nativeRow mutedRow taskAttachmentRow';attachment.innerHTML='<span class="lineIcon">📎</span><span>Adicionar anexo (foto, arquivo...)</span>';card.querySelector('.noteRow')?.before(attachment)}
 del.classList.add('taskDeleteOriginal');
}
function scan(){document.querySelectorAll('.nativeSheet').forEach(enhance)}
new MutationObserver(()=>requestAnimationFrame(scan)).observe(document.body,{childList:true,subtree:true});setTimeout(scan,0);
})();

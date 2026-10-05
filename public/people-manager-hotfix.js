(()=>{
const PK='fh-house-people-v1';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=()=>{try{const p=JSON.parse(localStorage.getItem(PK));if(Array.isArray(p)&&p.length)return p}catch{}const seed=['Hellen','Karina','Antônio'];localStorage.setItem(PK,JSON.stringify(seed));return seed};
const write=p=>localStorage.setItem(PK,JSON.stringify(p));
const open=()=>{
 document.querySelector('.fhBox')?.remove();
 const overlay=document.createElement('div');overlay.className='fhBox fhPeopleManager';
 const render=()=>{const list=read();overlay.innerHTML=`<section><header><button type="button" data-x>×</button><b>Pessoas</b><button type="button" data-s>Fechar</button></header><div class="fhBody"><div class="fhCats fhPeople">${list.map((x,i)=>`<div><span>${esc(x)}</span><button type="button" data-person-del="${i}">Excluir</button></div>`).join('')}</div><label>Nova pessoa<input id="fhNewPerson" placeholder="Nome"></label><button type="button" class="fhAdd fhAddPerson">+ Adicionar pessoa</button></div></section>`;
 overlay.querySelector('[data-x]').onclick=()=>overlay.remove();overlay.querySelector('[data-s]').onclick=()=>overlay.remove();
 overlay.querySelectorAll('[data-person-del]').forEach(b=>b.onclick=()=>{const a=read();a.splice(Number(b.dataset.personDel),1);write(a);render()});
 const add=()=>{const input=overlay.querySelector('#fhNewPerson'),v=input.value.trim();if(!v)return;const a=read();if(!a.some(x=>norm(x)===norm(v))){a.push(v);write(a)}render()};
 overlay.querySelector('.fhAddPerson').onclick=add;overlay.querySelector('#fhNewPerson').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
 };
 render();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};document.body.append(overlay);
};
document.addEventListener('click',e=>{const b=e.target.closest?.('.fhManagePeople');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open()},true);
})();
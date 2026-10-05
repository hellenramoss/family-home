import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, MoreHorizontal, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import './styles.css';

type Item = { id:string; name:string; done:boolean; category?:string };
type Category = { id:string; name:string; emoji:string };
type FamilyList = { id:string; name:string; emoji:string; items:Item[]; categories?:Category[] };

const marketCategories:Category[]=[
{id:'produce',name:'Frutas & Legumes',emoji:'🍎'},{id:'meat',name:'Carne & Peixe',emoji:'🍖'},{id:'bakery',name:'Pão & Confeitaria',emoji:'🍞'},{id:'dairy',name:'Laticínios',emoji:'🥛'},{id:'frozen',name:'Congelados & Conveniente',emoji:'❄️'},{id:'grains',name:'Cereais & Grãos',emoji:'🌾'},{id:'drinks',name:'Bebidas',emoji:'🧃'},{id:'ingredients',name:'Ingredientes & Condimentos',emoji:'🧂'},{id:'snacks',name:'Lanches & Doces',emoji:'🍫'},{id:'cleaning',name:'Limpeza & Higiene',emoji:'🧼'},{id:'pets',name:'Animais',emoji:'🐶'},{id:'medicine',name:'REMÉDIOS',emoji:'💊'},{id:'other',name:'Sem categoria',emoji:'🎰'}];
const seed:FamilyList[]=[
{id:'house',name:'TAREFAS DA CASA',emoji:'🌟🏠',items:[{id:'1',name:'Varrer a casa',done:false},{id:'2',name:'Organizar cozinha',done:true}]},
{id:'finance',name:'GESTÃO FINANCEIRA',emoji:'💰',items:[{id:'3',name:'Revisar contas da semana',done:false}]},
{id:'market',name:'lista de compras MERCADO',emoji:'🛒',categories:marketCategories,items:[{id:'4',name:'Mussarela',done:false,category:'dairy'},{id:'5',name:'Banana',done:false,category:'produce'},{id:'6',name:'Ovos',done:true,category:'dairy'}]}];
const uid=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`;

function App(){
 const [lists,setLists]=useState<FamilyList[]>(()=>{try{const s=localStorage.getItem('family-home-lists');const parsed=s?JSON.parse(s):seed;return parsed.map((l:FamilyList)=>l.id==='market'||l.name.toUpperCase().includes('MERCADO')?{...l,categories:l.categories?.length?l.categories:marketCategories}:l)}catch{return seed}});
 const [activeId,setActiveId]=useState<string|null>(null),[hideDone,setHideDone]=useState(true),[menu,setMenu]=useState(false),[newList,setNewList]=useState(false),[listName,setListName]=useState(''),[listEmoji,setListEmoji]=useState('✨');
 const [addOpen,setAddOpen]=useState(false),[newItem,setNewItem]=useState(''),[itemCategory,setItemCategory]=useState('other'),[categoryPicker,setCategoryPicker]=useState(false),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 useEffect(()=>{try{localStorage.setItem('family-home-lists',JSON.stringify(lists))}catch{}},[lists]);
 const active=useMemo(()=>lists.find(l=>l.id===activeId),[lists,activeId]);
 const updateActive=(fn:(l:FamilyList)=>FamilyList)=>setLists(ls=>ls.map(l=>l.id===activeId?fn(l):l));
 const closeAdd=()=>{setAddOpen(false);setCategoryPicker(false);setNewItem('');setItemCategory('other')};
 const saveItem=()=>{const name=newItem.trim();if(!name)return;updateActive(l=>({...l,items:[...l.items,{id:uid(),name,done:false,category:itemCategory}]}));closeAdd()};
 const createList=()=>{const name=listName.trim();if(!name)return;setLists(c=>[...c,{id:uid(),name:name.toUpperCase(),emoji:listEmoji.trim()||'✨',items:[]}]);setListName('');setListEmoji('✨');setNewList(false)};

 if(active){
  const isMarket=active.id==='market'||active.name.toUpperCase().includes('MERCADO');
  const cats=isMarket?(active.categories?.length?active.categories:marketCategories):[];
  const visible=hideDone?active.items.filter(i=>!i.done):active.items;
  const pending=active.items.filter(i=>!i.done).length;
  const selected=cats.find(c=>c.id===itemCategory)??marketCategories[marketCategories.length-1];
  return <main className="app nativeApp" onClick={()=>menu&&setMenu(false)}>
   <header className="listHeader"><button type="button" className="icon" onClick={e=>{e.stopPropagation();setActiveId(null);setMenu(false)}}><ChevronLeft/></button><h1>{active.name} <span>{active.emoji}</span></h1><button type="button" className="icon" onClick={e=>{e.stopPropagation();setMenu(v=>!v)}}><MoreHorizontal/></button></header>
   {menu&&<div className="menu" onClick={e=>e.stopPropagation()}><button onClick={()=>{setHideDone(v=>!v);setMenu(false)}}>{hideDone?<Eye/>:<EyeOff/>}{hideDone?'Mostrar concluídos':'Ocultar concluídos'}</button><button onClick={()=>{updateActive(l=>({...l,items:l.items.map(i=>({...i,done:false}))}));setMenu(false)}}><RotateCcw/>Desmarcar todos</button><button onClick={()=>{updateActive(l=>({...l,items:l.items.map(i=>({...i,done:true}))}));setMenu(false)}}><Check/>Concluir todos</button><button className="danger" onClick={()=>{updateActive(l=>({...l,items:l.items.filter(i=>!i.done)}));setMenu(false)}}><Trash2/>Excluir concluídos</button></div>}
   {isMarket&&<button type="button" className="quickAdd" onClick={()=>setAddOpen(true)}><Plus/><span>Adicionar um item</span></button>}
   {isMarket?<section className="categoryGroups">{cats.map(cat=>{const items=visible.filter(i=>(i.category||'other')===cat.id);return <div className="categoryGroup" key={cat.id}><button type="button" className="categoryHeader" onClick={()=>setCollapsed(c=>({...c,[cat.id]:!c[cat.id]}))}><span><strong>{cat.name}</strong><b>{cat.emoji}</b><small>{items.length}</small></span>{collapsed[cat.id]?<ChevronDown/>:<ChevronUp/>}</button>{!collapsed[cat.id]&&items.map(item=><button type="button" className={`item ${item.done?'done':''}`} key={item.id} onClick={()=>updateActive(l=>({...l,items:l.items.map(i=>i.id===item.id?{...i,done:!i.done}:i)}))}><span className="check">{item.done&&<Check size={17}/>}</span><span>{item.name}</span></button>)}</div>})}</section>:<section className="items">{visible.map(item=><button type="button" className={`item ${item.done?'done':''}`} key={item.id} onClick={()=>updateActive(l=>({...l,items:l.items.map(i=>i.id===item.id?{...i,done:!i.done}:i)}))}><span className="check">{item.done&&<Check size={17}/>}</span><span>{item.name}</span></button>)}</section>}
   <button type="button" className="fab" onClick={()=>setAddOpen(true)}><Plus/></button>
   {addOpen&&<div className="nativeOverlay"><section className="nativeSheet">
    <div className="nativeSheetHead"><button type="button" onClick={closeAdd}><X/></button><h2>Adicionar</h2><button type="button" className="confirm" onClick={saveItem}><Check/></button></div>
    <div className="nativeCard"><label className="nativeRow nameRow"><span className="emptyCircle"/><input autoFocus value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="Nome"/></label>{isMarket&&<button type="button" className="nativeRow" onClick={()=>setCategoryPicker(true)}><span className="rowEmoji">{selected.emoji}</span><span>{selected.name}</span></button>}<button type="button" className="nativeRow"><span className="lineIcon">♙</span><span>Atribuir a</span></button><button type="button" className="nativeRow mutedRow"><span className="lineIcon">▣</span><span>Definir data e lembrete</span></button><button type="button" className="nativeRow mutedRow"><span className="lineIcon">↻</span><span>Repetir</span></button><div className="nativeRow"><span className="lineIcon">🛒</span><span>{active.name} {active.emoji}</span></div><button type="button" className="nativeRow mutedRow"><span className="lineIcon">⌕</span><span>Adicionar anexo</span></button><button type="button" className="nativeRow mutedRow"><span className="lineIcon">▤</span><span>Adicionar nota</span></button></div>
    {categoryPicker&&<div className="pickerScrim" onClick={()=>setCategoryPicker(false)}><section className="categoryPicker" onClick={e=>e.stopPropagation()}><div className="pickerHandle"/><div className="pickerTitle"><h2>Categorias</h2><button type="button"><Plus/></button></div><div className="categoryOptions">{cats.map(cat=><button type="button" className="categoryOption" key={cat.id} onClick={()=>{setItemCategory(cat.id);setCategoryPicker(false)}}><span className="categoryEmoji">{cat.emoji}</span><span>{cat.name}</span><span className={`radio ${itemCategory===cat.id?'selected':''}`}>{itemCategory===cat.id&&<i/>}</span></button>)}</div></section></div>}
   </section></div>}
  </main>
 }
 return <main className="app"><header className="homeHeader"><div/><h1>Lists</h1><button className="icon"><MoreHorizontal/></button></header><section className="lists">{lists.map(list=>{const p=list.items.filter(i=>!i.done).length;return <button className="listRow" key={list.id} onClick={()=>setActiveId(list.id)}><span className="emoji">{list.emoji}</span><span className="listText"><strong>{list.name}</strong><small>♧ Shared with family</small></span><span className={`count ${p===0?'complete':''}`}>{p===0?<Check/>:p}</span></button>})}</section><button className="fab" onClick={()=>setNewList(true)}><Plus/></button>{newList&&<div className="overlay" onClick={()=>setNewList(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="sheetTitle"><button className="icon" onClick={()=>setNewList(false)}><X/></button><h2>New list</h2><button className="save" onClick={createList}>Create</button></div><label>Emoji<input className="emojiInput" value={listEmoji} onChange={e=>setListEmoji(e.target.value)}/></label><label>Name<input autoFocus value={listName} onChange={e=>setListName(e.target.value)} placeholder="Ex.: VIAGEM"/></label></div></div>}</main>
}
createRoot(document.getElementById('root')!).render(<App/>);

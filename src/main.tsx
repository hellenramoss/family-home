import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronLeft, Eye, EyeOff, MoreHorizontal, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import './styles.css';

type Item = { id: string; name: string; done: boolean };
type FamilyList = { id: string; name: string; emoji: string; items: Item[] };

const seed: FamilyList[] = [
  { id: 'house', name: 'TAREFAS DA CASA', emoji: '🌟🏠', items: [{ id: '1', name: 'Varrer a casa', done: false }, { id: '2', name: 'Organizar cozinha', done: true }] },
  { id: 'finance', name: 'GESTÃO FINANCEIRA', emoji: '💰', items: [{ id: '3', name: 'Revisar contas da semana', done: false }] },
  { id: 'market', name: 'MERCADO', emoji: '🛒', items: [{ id: '4', name: 'Mussarela', done: false }, { id: '5', name: 'Banana', done: false }, { id: '6', name: 'Ovos', done: true }] }
];

const uid = () => crypto.randomUUID();

function App() {
  const [lists, setLists] = useState<FamilyList[]>(() => {
    const saved = localStorage.getItem('family-home-lists');
    return saved ? JSON.parse(saved) : seed;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);
  const [menu, setMenu] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newList, setNewList] = useState(false);
  const [listName, setListName] = useState('');
  const [listEmoji, setListEmoji] = useState('✨');

  useEffect(() => localStorage.setItem('family-home-lists', JSON.stringify(lists)), [lists]);
  const active = useMemo(() => lists.find(l => l.id === activeId), [lists, activeId]);

  const updateActive = (fn: (l: FamilyList) => FamilyList) => setLists(ls => ls.map(l => l.id === activeId ? fn(l) : l));

  if (active) {
    const visible = hideDone ? active.items.filter(i => !i.done) : active.items;
    const pending = active.items.filter(i => !i.done).length;
    return <main className="app">
      <header><button className="icon" onClick={() => setActiveId(null)}><ChevronLeft /></button><div><h1>{active.emoji} {active.name}</h1><p>{pending ? `${pending} pendente${pending > 1 ? 's' : ''}` : 'Tudo concluído ✓'}</p></div><button className="icon" onClick={() => setMenu(v => !v)}><MoreHorizontal /></button></header>
      {menu && <div className="menu">
        <button onClick={() => {setHideDone(v => !v); setMenu(false)}}>{hideDone ? <Eye /> : <EyeOff />}{hideDone ? 'Show completed items' : 'Hide completed items'}</button>
        <button onClick={() => {updateActive(l => ({...l, items:l.items.map(i=>({...i,done:false}))}));setMenu(false)}}><RotateCcw />Uncheck all items</button>
        <button onClick={() => {updateActive(l => ({...l, items:l.items.map(i=>({...i,done:true}))}));setMenu(false)}}><Check />Check all items</button>
        <button className="danger" onClick={() => {updateActive(l => ({...l, items:l.items.filter(i=>!i.done)}));setMenu(false)}}><Trash2 />Delete completed items</button>
      </div>}
      <section className="items">
        {visible.map(item => <button className={`item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => updateActive(l => ({...l, items:l.items.map(i=>i.id===item.id?{...i,done:!i.done}:i)}))}><span className="check">{item.done && <Check size={18}/>}</span><span>{item.name}</span></button>)}
        {!visible.length && <div className="empty">✨ Nada pendente por aqui.</div>}
      </section>
      <form className="addbar" onSubmit={e=>{e.preventDefault(); if(!newItem.trim())return; updateActive(l=>({...l,items:[...l.items,{id:uid(),name:newItem.trim(),done:false}]}));setNewItem('')}}><input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="Add item"/><button><Plus /></button></form>
    </main>
  }

  return <main className="app">
    <header className="homeHeader"><div></div><h1>Lists</h1><button className="icon"><MoreHorizontal /></button></header>
    <section className="lists">
      {lists.map(list => { const pending=list.items.filter(i=>!i.done).length; return <button className="listRow" key={list.id} onClick={()=>setActiveId(list.id)}><span className="emoji">{list.emoji}</span><span className="listText"><strong>{list.name}</strong><small>♧ Shared with family</small></span><span className={`count ${pending===0?'complete':''}`}>{pending===0?<Check/>:pending}</span></button> })}
    </section>
    <button className="fab" onClick={()=>setNewList(true)}><Plus /></button>
    {newList && <div className="overlay"><form className="sheet" onSubmit={e=>{e.preventDefault();if(!listName.trim())return;setLists(l=>[...l,{id:uid(),name:listName.trim().toUpperCase(),emoji:listEmoji||'✨',items:[]}]);setListName('');setNewList(false)}}><div className="sheetTitle"><button type="button" className="icon" onClick={()=>setNewList(false)}><X/></button><h2>New list</h2><button className="save">Create</button></div><label>Emoji<input className="emojiInput" value={listEmoji} onChange={e=>setListEmoji(e.target.value)}/></label><label>Name<input autoFocus value={listName} onChange={e=>setListName(e.target.value)} placeholder="Ex.: VIAGEM"/></label></form></div>}
  </main>
}

createRoot(document.getElementById('root')!).render(<App />);

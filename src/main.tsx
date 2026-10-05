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

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function App() {
  const [lists, setLists] = useState<FamilyList[]>(() => {
    try {
      const saved = localStorage.getItem('family-home-lists');
      return saved ? JSON.parse(saved) : seed;
    } catch { return seed; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);
  const [menu, setMenu] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newList, setNewList] = useState(false);
  const [listName, setListName] = useState('');
  const [listEmoji, setListEmoji] = useState('✨');

  useEffect(() => { try { localStorage.setItem('family-home-lists', JSON.stringify(lists)); } catch {} }, [lists]);
  const active = useMemo(() => lists.find(l => l.id === activeId), [lists, activeId]);
  const updateActive = (fn: (l: FamilyList) => FamilyList) => setLists(ls => ls.map(l => l.id === activeId ? fn(l) : l));

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    updateActive(l => ({ ...l, items: [...l.items, { id: uid(), name, done: false }] }));
    setNewItem('');
  };

  const createList = () => {
    const name = listName.trim();
    if (!name) return;
    const created: FamilyList = { id: uid(), name: name.toUpperCase(), emoji: listEmoji.trim() || '✨', items: [] };
    setLists(current => [...current, created]);
    setListName(''); setListEmoji('✨'); setNewList(false);
  };

  if (active) {
    const visible = hideDone ? active.items.filter(i => !i.done) : active.items;
    const pending = active.items.filter(i => !i.done).length;
    return <main className="app" onClick={() => menu && setMenu(false)}>
      <header>
        <button type="button" className="icon" aria-label="Back" onClick={e => { e.stopPropagation(); setActiveId(null); setMenu(false); }}><ChevronLeft /></button>
        <div><h1>{active.emoji} {active.name}</h1><p>{pending ? `${pending} pendente${pending > 1 ? 's' : ''}` : 'Tudo concluído ✓'}</p></div>
        <button type="button" className="icon" aria-label="List options" onClick={e => { e.stopPropagation(); setMenu(v => !v); }}><MoreHorizontal /></button>
      </header>
      {menu && <div className="menu" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => { setHideDone(v => !v); setMenu(false); }}>{hideDone ? <Eye /> : <EyeOff />}{hideDone ? 'Show completed items' : 'Hide completed items'}</button>
        <button type="button" onClick={() => { updateActive(l => ({ ...l, items: l.items.map(i => ({ ...i, done: false })) })); setMenu(false); }}><RotateCcw />Uncheck all items</button>
        <button type="button" onClick={() => { updateActive(l => ({ ...l, items: l.items.map(i => ({ ...i, done: true })) })); setMenu(false); }}><Check />Check all items</button>
        <button type="button" className="danger" onClick={() => { updateActive(l => ({ ...l, items: l.items.filter(i => !i.done) })); setMenu(false); }}><Trash2 />Delete completed items</button>
      </div>}
      <section className="items">
        {visible.map(item => <button type="button" className={`item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => updateActive(l => ({ ...l, items: l.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i) }))}><span className="check">{item.done && <Check size={18}/>}</span><span>{item.name}</span></button>)}
        {!visible.length && <div className="empty">✨ Nada pendente por aqui.</div>}
      </section>
      <div className="addbar">
        <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="Add item" />
        <button type="button" aria-label="Add item" onClick={addItem}><Plus /></button>
      </div>
    </main>;
  }

  return <main className="app">
    <header className="homeHeader"><div></div><h1>Lists</h1><button type="button" className="icon" aria-label="Options"><MoreHorizontal /></button></header>
    <section className="lists">
      {lists.map(list => { const pending = list.items.filter(i => !i.done).length; return <button type="button" className="listRow" key={list.id} onClick={() => setActiveId(list.id)}><span className="emoji">{list.emoji}</span><span className="listText"><strong>{list.name}</strong><small>♧ Shared with family</small></span><span className={`count ${pending === 0 ? 'complete' : ''}`}>{pending === 0 ? <Check/> : pending}</span></button>; })}
    </section>
    <button type="button" className="fab" aria-label="Create list" onClick={() => setNewList(true)}><Plus /></button>
    {newList && <div className="overlay" onClick={() => setNewList(false)}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="sheetTitle"><button type="button" className="icon" onClick={() => setNewList(false)}><X/></button><h2>New list</h2><button type="button" className="save" onClick={createList}>Create</button></div>
        <label>Emoji<input className="emojiInput" value={listEmoji} onChange={e => setListEmoji(e.target.value)}/></label>
        <label>Name<input autoFocus value={listName} onChange={e => setListName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createList(); } }} placeholder="Ex.: VIAGEM"/></label>
      </div>
    </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);

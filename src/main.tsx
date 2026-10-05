import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, MoreHorizontal, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import './styles.css';

type Item = { id: string; name: string; done: boolean; category?: string };
type FamilyList = { id: string; name: string; emoji: string; items: Item[] };
type Category = { id: string; name: string; emoji: string };

const categories: Category[] = [
  { id: 'produce', name: 'Frutas & Legumes', emoji: '🍎' },
  { id: 'meat', name: 'Carne & Peixe', emoji: '🍖' },
  { id: 'bakery', name: 'Pão & Confeitaria', emoji: '🍞' },
  { id: 'dairy', name: 'Laticínios', emoji: '🥛' },
  { id: 'frozen', name: 'Congelados & Conveniente', emoji: '❄️' },
  { id: 'grains', name: 'Cereais & Grãos', emoji: '🌾' },
  { id: 'drinks', name: 'Bebidas', emoji: '🧃' },
  { id: 'ingredients', name: 'Ingredientes & Condimentos', emoji: '🧂' },
  { id: 'snacks', name: 'Lanches & Doces', emoji: '🍫' },
  { id: 'cleaning', name: 'Limpeza & Higiene', emoji: '🧼' },
  { id: 'pets', name: 'Animais', emoji: '🐶' },
  { id: 'medicine', name: 'REMÉDIOS', emoji: '💊' },
  { id: 'other', name: 'Sem categoria', emoji: '🎰' }
];

const seed: FamilyList[] = [
  { id: 'house', name: 'TAREFAS DA CASA', emoji: '🌟🏠', items: [{ id: '1', name: 'Varrer a casa', done: false }, { id: '2', name: 'Organizar cozinha', done: true }] },
  { id: 'finance', name: 'GESTÃO FINANCEIRA', emoji: '💰', items: [{ id: '3', name: 'Revisar contas da semana', done: false }] },
  { id: 'market', name: 'MERCADO', emoji: '🛒', items: [
    { id: '4', name: 'Mussarela', done: false, category: 'dairy' },
    { id: '5', name: 'Banana', done: false, category: 'produce' },
    { id: '6', name: 'Ovos', done: true, category: 'dairy' }
  ] }
];

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function App() {
  const [lists, setLists] = useState<FamilyList[]>(() => { try { const saved = localStorage.getItem('family-home-lists'); return saved ? JSON.parse(saved) : seed; } catch { return seed; } });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);
  const [menu, setMenu] = useState(false);
  const [newList, setNewList] = useState(false);
  const [listName, setListName] = useState('');
  const [listEmoji, setListEmoji] = useState('✨');
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [itemCategory, setItemCategory] = useState('other');
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { try { localStorage.setItem('family-home-lists', JSON.stringify(lists)); } catch {} }, [lists]);
  const active = useMemo(() => lists.find(l => l.id === activeId), [lists, activeId]);
  const updateActive = (fn: (l: FamilyList) => FamilyList) => setLists(ls => ls.map(l => l.id === activeId ? fn(l) : l));

  const saveItem = () => {
    const name = newItem.trim();
    if (!name) return;
    updateActive(l => ({ ...l, items: [...l.items, { id: uid(), name, done: false, category: itemCategory }] }));
    setNewItem(''); setItemCategory('other'); setCategoryPicker(false); setAddOpen(false);
  };
  const createList = () => {
    const name = listName.trim(); if (!name) return;
    setLists(current => [...current, { id: uid(), name: name.toUpperCase(), emoji: listEmoji.trim() || '✨', items: [] }]);
    setListName(''); setListEmoji('✨'); setNewList(false);
  };

  if (active) {
    const isMarket = active.id === 'market' || active.name.toUpperCase().includes('MERCADO');
    const pending = active.items.filter(i => !i.done).length;
    const visible = hideDone ? active.items.filter(i => !i.done) : active.items;
    const selectedCategory = categories.find(c => c.id === itemCategory) ?? categories[categories.length - 1];
    const groups = isMarket ? categories.map(category => ({ category, items: visible.filter(i => (i.category || 'other') === category.id) })).filter(g => g.items.length > 0) : [];

    return <main className="app" onClick={() => menu && setMenu(false)}>
      <header>
        <button type="button" className="icon" onClick={e => { e.stopPropagation(); setActiveId(null); setMenu(false); }}><ChevronLeft /></button>
        <div><h1>{active.name} {active.emoji}</h1><p>{pending ? `${pending} pendente${pending > 1 ? 's' : ''}` : 'Tudo concluído ✓'}</p></div>
        <button type="button" className="icon" onClick={e => { e.stopPropagation(); setMenu(v => !v); }}><MoreHorizontal /></button>
      </header>
      {menu && <div className="menu" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => { setHideDone(v => !v); setMenu(false); }}>{hideDone ? <Eye /> : <EyeOff />}{hideDone ? 'Mostrar concluídos' : 'Ocultar concluídos'}</button>
        <button type="button" onClick={() => { updateActive(l => ({ ...l, items: l.items.map(i => ({ ...i, done: false })) })); setMenu(false); }}><RotateCcw />Desmarcar todos</button>
        <button type="button" onClick={() => { updateActive(l => ({ ...l, items: l.items.map(i => ({ ...i, done: true })) })); setMenu(false); }}><Check />Concluir todos</button>
        <button type="button" className="danger" onClick={() => { updateActive(l => ({ ...l, items: l.items.filter(i => !i.done) })); setMenu(false); }}><Trash2 />Excluir concluídos</button>
      </div>}

      {isMarket ? <section className="categoryGroups">
        {groups.map(({ category, items }) => <div className="categoryGroup" key={category.id}>
          <button type="button" className="categoryHeader" onClick={() => setCollapsed(c => ({ ...c, [category.id]: !c[category.id] }))}>
            <span><strong>{category.name}</strong> <span className="catEmoji">{category.emoji}</span> <small>{items.length}</small></span>
            {collapsed[category.id] ? <ChevronDown /> : <ChevronUp />}
          </button>
          {!collapsed[category.id] && items.map(item => <button type="button" className={`item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => updateActive(l => ({ ...l, items: l.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i) }))}><span className="check">{item.done && <Check size={18}/>}</span><span>{item.name}</span></button>)}
        </div>)}
        {!groups.length && <div className="empty">✨ Nada pendente por aqui.</div>}
      </section> : <section className="items">
        {visible.map(item => <button type="button" className={`item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => updateActive(l => ({ ...l, items: l.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i) }))}><span className="check">{item.done && <Check size={18}/>}</span><span>{item.name}</span></button>)}
        {!visible.length && <div className="empty">✨ Nada pendente por aqui.</div>}
      </section>}

      <button type="button" className="fab" aria-label="Adicionar item" onClick={() => { setAddOpen(true); setCategoryPicker(false); }}><Plus /></button>

      {addOpen && <div className="overlay addOverlay" onClick={() => setAddOpen(false)}><div className="sheet itemSheet" onClick={e => e.stopPropagation()}>
        <div className="sheetTitle"><button type="button" className="icon" onClick={() => setAddOpen(false)}><X/></button><h2>Adicionar</h2><button type="button" className="save bigCheck" onClick={saveItem}><Check/></button></div>
        <div className="itemFormCard">
          <label className="formRow nameRow"><span className="emptyCircle"></span><input autoFocus value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveItem(); } }} placeholder="Nome" /></label>
          {isMarket && <button type="button" className="formRow" onClick={() => setCategoryPicker(true)}><span className="rowEmoji">{selectedCategory.emoji}</span><span>{selectedCategory.name}</span><ChevronDown className="rowEnd" size={20}/></button>}
          <button type="button" className="formRow mutedRow"><span className="rowEmoji">👤</span><span>Atribuir a</span></button>
          <button type="button" className="formRow mutedRow"><span className="rowEmoji">📅</span><span>Definir data e lembrete</span></button>
          <button type="button" className="formRow mutedRow"><span className="rowEmoji">📝</span><span>Adicionar nota</span></button>
        </div>
        {categoryPicker && <div className="categoryPicker"><div className="pickerHandle"></div><div className="pickerTitle"><h2>Categorias</h2><button type="button" className="icon"><Plus/></button></div>
          <div className="categoryOptions">{categories.map(cat => <button type="button" className="categoryOption" key={cat.id} onClick={() => { setItemCategory(cat.id); setCategoryPicker(false); }}><span className="categoryEmoji">{cat.emoji}</span><span>{cat.name}</span><span className={`radio ${itemCategory === cat.id ? 'selected' : ''}`}>{itemCategory === cat.id && <span/>}</span></button>)}</div>
        </div>}
      </div></div>}
    </main>;
  }

  return <main className="app">
    <header className="homeHeader"><div></div><h1>Lists</h1><button type="button" className="icon"><MoreHorizontal /></button></header>
    <section className="lists">{lists.map(list => { const pending = list.items.filter(i => !i.done).length; return <button type="button" className="listRow" key={list.id} onClick={() => setActiveId(list.id)}><span className="emoji">{list.emoji}</span><span className="listText"><strong>{list.name}</strong><small>♧ Shared with family</small></span><span className={`count ${pending === 0 ? 'complete' : ''}`}>{pending === 0 ? <Check/> : pending}</span></button>; })}</section>
    <button type="button" className="fab" onClick={() => setNewList(true)}><Plus /></button>
    {newList && <div className="overlay" onClick={() => setNewList(false)}><div className="sheet" onClick={e => e.stopPropagation()}><div className="sheetTitle"><button type="button" className="icon" onClick={() => setNewList(false)}><X/></button><h2>New list</h2><button type="button" className="save" onClick={createList}>Create</button></div><label>Emoji<input className="emojiInput" value={listEmoji} onChange={e => setListEmoji(e.target.value)}/></label><label>Name<input autoFocus value={listName} onChange={e => setListName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createList(); } }} placeholder="Ex.: VIAGEM"/></label></div></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);

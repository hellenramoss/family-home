(() => {
  const collectionFields = new Set(['items', 'categories', 'purchaseHistory']);
  const listColumns = 'id,client_key,name,emoji,sort_order,extra,updated_at';
  const categoryColumns = 'id,list_id,client_key,name,emoji,sort_order,updated_at';
  const itemColumns = 'id,list_id,category_id,client_key,name,done,note,sort_order,data,updated_at';

  function equal(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.every(key => equal(a[key], b[key]));
  }

  class Conflict extends Error {}
  class StaleRow extends Error {}
  const byId = rows => new Map((rows || []).map(row => [row.id, row]));
  const omit = (record, fields) => Object.fromEntries(Object.entries(record).filter(([key]) => !fields.includes(key)));
  const shape = lists => lists.map(list => ({
    ...list,
    items: (list.items || []).map(item => ({...item, category: item.category || 'other'})),
    categories: (list.categories || []).filter(category => category.id !== 'other'),
    purchaseHistory: list.purchaseHistory || []
  }));

  function mergeRecord(before, after, latest, list = false, optimistic = false) {
    const result = {...latest};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (key === 'id' || equal(before[key], after[key])) continue;
      if (list && collectionFields.has(key)) {
        result[key] = mergeRows(before[key], after[key], latest[key], {
          receiptHistory: key === 'purchaseHistory',
          optimistic
        });
        continue;
      }
      if (!optimistic && !equal(latest[key], before[key]) && !equal(latest[key], after[key])) {
        throw new Conflict();
      }
      if (after[key] === undefined) delete result[key];
      else result[key] = after[key];
    }
    return result;
  }

  function mergeRows(before = [], after = [], latest = [], options = {}) {
    const original = byId(before);
    const edited = byId(after);
    const result = byId(latest);
    const receipts = options.receiptHistory ? new Set(latest.map(record => record.receiptKey).filter(Boolean)) : null;
    for (const [id, row] of original) {
      if (edited.has(id) || !result.has(id)) continue;
      if (!options.optimistic && !equal(row, result.get(id))) throw new Conflict();
      result.delete(id);
    }
    for (const [id, row] of edited) {
      const old = original.get(id), current = result.get(id);
      if (equal(old, row)) continue;
      if (!old) {
        if (!current && !(row.receiptKey && receipts?.has(row.receiptKey))) result.set(id, row);
        else if (current && !equal(current, row)) {
          if (options.lists) {
            // A retry can find the parent from a previous attempt before all its children were saved.
            result.set(id, mergeRecord({items:[],categories:[],purchaseHistory:[]}, row, current, true, options.optimistic));
          } else if (!options.optimistic) throw new Conflict();
        }
      } else if (current) {
        result.set(id, mergeRecord(old, row, current, options.lists, options.optimistic));
      } else if (options.optimistic) {
        result.set(id, row);
      } else {
        throw new Conflict();
      }
    }
    // Keep concurrent additions in place. Reorder only the entries the editor saw.
    const ranks = new Map(after.map((row, index) => [row.id, index]));
    const oldOrder = before.filter(row => edited.has(row.id)).map(row => row.id);
    const newOrder = after.filter(row => original.has(row.id)).map(row => row.id);
    const output = [...result.values()];
    if (equal(oldOrder, newOrder)) return output;
    const reordered = output.filter(row => ranks.has(row.id)).sort((a, b) => ranks.get(a.id) - ranks.get(b.id));
    let index = 0;
    return output.map(row => ranks.has(row.id) ? reordered[index++] : row);
  }

  function mergeLists(before, after, latest, optimistic = false) {
    return mergeRows(shape(before), shape(after), shape(latest), {lists: true, optimistic});
  }

  function check(response) {
    if (response.error) throw response.error;
    return response.data;
  }

  async function pages(query) {
    const rows = [];
    const size = 200;
    for (let offset = 0;; offset += size) {
      const batch = check(await query().order('sort_order').order('id').range(offset, offset + size - 1));
      rows.push(...batch);
      if (batch.length < size) return rows;
    }
  }

  function nextRevision(previous) {
    return new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
  }

  function version(query, row) {
    return row.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', row.updated_at);
  }

  function createRepository(sb) {
    const readDocument = familyId => sb.from('family_documents').select('payload,updated_at')
      .eq('family_id', familyId).eq('doc_key', 'lists').maybeSingle();

    async function read(familyId) {
      let rows;
      try {
        rows = await pages(() => sb.from('family_lists').select(listColumns).eq('family_id', familyId));
      } catch (error) {
        if (!['42P01', 'PGRST205'].includes(error.code)) throw error;
        const document = check(await readDocument(familyId));
        return {lists: shape(Array.isArray(document?.payload) ? document.payload : []), document, legacy: true};
      }

      if (rows.length === 0) {
        const response = await readDocument(familyId);
        if (response.error && !['42P01', 'PGRST205'].includes(response.error.code)) throw response.error;
        const document = response.data;
        if (Array.isArray(document?.payload) && document.payload.length) {
          return {lists: shape(document.payload), document, legacy: true};
        }
        return {lists: [], rows, categories: [], items: []};
      }

      const listIds = rows.map(row => row.id);
      const items = [], categories = [];
      for (let start = 0; start < listIds.length; start += 50) {
        const ids = listIds.slice(start, start + 50);
        const [cats, entries] = await Promise.all([
          pages(() => sb.from('list_categories').select(categoryColumns).in('list_id', ids)),
          pages(() => sb.from('list_items').select(itemColumns).in('list_id', ids))
        ]);
        categories.push(...cats);
        items.push(...entries);
      }
      const lists = rows.map(row => {
        const cats = categories.filter(cat => cat.list_id === row.id);
        const entries = items.filter(item => item.list_id === row.id);
        const keys = new Map(cats.map(cat => [cat.id, cat.client_key]));
        return {
          ...row.extra,
          id: row.client_key, name: row.name, emoji: row.emoji || undefined,
          categories: cats.map(cat => ({id: cat.client_key, name: cat.name, emoji: cat.emoji || undefined})),
          items: entries.map(item => ({
            ...item.data,
            id: item.client_key, name: item.name, done: item.done,
            note: item.note || undefined, category: keys.get(item.category_id) || 'other'
          }))
        };
      });
      return {lists: shape(lists), rows, categories, items};
    }

    async function insert(table, values) {
      const response = await sb.from(table).insert(values).select('id').single();
      if (response.error?.code === '23505') throw new StaleRow();
      return check(response);
    }

    async function update(table, row, values) {
      const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => !equal(row[key], value)));
      if (Object.keys(changes).length === 0) return row;
      const data = check(await version(
        sb.from(table).update({...changes, updated_at: nextRevision(row.updated_at)}).eq('id', row.id),
        row
      ).select('id'));
      if (!data.length) throw new StaleRow();
      return data[0];
    }

    async function remove(table, row) {
      const data = check(await version(sb.from(table).delete().eq('id', row.id), row).select('id'));
      if (!data.length) throw new StaleRow();
    }

    // Preserve existing order values on append/delete so an independent addition
    // never causes an UPDATE on every item in the list.
    function orders(rows, desired) {
      const ids = new Set(desired.map(row => row.id));
      const current = new Map(rows.map(row => [row.client_key, row.sort_order]));
      const existing = desired.filter(row => current.has(row.id));
      const positions = rows.filter(row => ids.has(row.client_key));
      const reordered = existing.some((row, index) => row.id !== positions[index]?.client_key);
      if (reordered) return new Map(desired.map((row, index) => [row.id, index]));
      let last = Math.max(-1, ...rows.map(row => row.sort_order ?? -1));
      return new Map(desired.map(row => [row.id, current.get(row.id) ?? ++last]));
    }

    async function writeRelational(familyId, state, desired, original, changed, assertActive) {
      const listOrder = orders(state.rows, desired);
      const remote = new Map(state.rows.map(row => [row.client_key, row]));
      const previous = byId(original);
      const edited = byId(changed);
      const desiredIds = new Set(desired.map(list => list.id));
      const latest = byId(state.lists);

      for (const list of desired) {
        const row = remote.get(list.id);
        const current = latest.get(list.id);
        if (equal(previous.get(list.id), edited.get(list.id)) && row?.sort_order === listOrder.get(list.id)) continue;

        const extra = equal(current?.purchaseHistory, list.purchaseHistory) && current
          ? {...omit(list, ['id', 'name', 'emoji', 'items', 'categories', 'purchaseHistory']),
             ...(row.extra?.purchaseHistory !== undefined ? {purchaseHistory: row.extra.purchaseHistory} : {})}
          : omit(list, ['id', 'name', 'emoji', 'items', 'categories']);
        const values = {name: list.name, emoji: list.emoji || null, sort_order: listOrder.get(list.id), extra};
        assertActive();
        const saved = row
          ? await update('family_lists', row, values)
          : await insert('family_lists', {family_id: familyId, client_key: list.id, ...values, updated_at: nextRevision()});
        const listId = saved.id;
        const cats = state.categories.filter(cat => cat.list_id === listId);
        const items = state.items.filter(item => item.list_id === listId);
        const categoryOrder = orders(cats, list.categories);
        const itemOrder = orders(items, list.items);
        const catRows = new Map(cats.map(cat => [cat.client_key, cat]));
        const itemRows = new Map(items.map(item => [item.client_key, item]));
        const currentItems = byId(current?.items);
        const catIds = new Map();

        for (const cat of list.categories) {
          const old = catRows.get(cat.id);
          const fields = {name: cat.name, emoji: cat.emoji || null, sort_order: categoryOrder.get(cat.id)};
          assertActive();
          const result = old
            ? await update('list_categories', old, fields)
            : await insert('list_categories', {list_id: listId, client_key: cat.id, ...fields, updated_at: nextRevision()});
          catIds.set(cat.id, result.id);
        }

        for (const item of list.items) {
          const old = itemRows.get(item.id);
          if (old && equal(currentItems.get(item.id), item) && old.sort_order === itemOrder.get(item.id)) continue;
          const data = omit(item, ['id', 'name', 'done', 'note', 'category']);
          const fields = {
            name: item.name, done: !!item.done, note: item.note || null,
            sort_order: itemOrder.get(item.id), category_id: catIds.get(item.category) || null, data
          };
          if (item.category !== 'other' && !fields.category_id) throw new Conflict();
          assertActive();
          if (old) await update('list_items', old, fields);
          else await insert('list_items', {list_id: listId, client_key: item.id, ...fields, updated_at: nextRevision()});
        }

        const itemIds = new Set(list.items.map(item => item.id));
        for (const item of items) {
          if (itemIds.has(item.client_key)) continue;
          assertActive();
          await remove('list_items', item);
        }
        for (const cat of cats) {
          if (catIds.has(cat.client_key)) continue;
          assertActive();
          await remove('list_categories', cat);
        }
      }

      for (const row of state.rows) {
        if (desiredIds.has(row.client_key)) continue;
        assertActive();
        await remove('family_lists', row);
      }
    }

    async function writeDocument(familyId, userId, document, payload) {
      const values = {payload, updated_at: nextRevision(document?.updated_at), updated_by: userId};
      const table = sb.from('family_documents');
      const response = document
        ? await version(table.update(values).eq('family_id', familyId).eq('doc_key', 'lists'), document).select('doc_key')
        : await table.insert({family_id: familyId, doc_key: 'lists', ...values}).select('doc_key');
      if (response.error?.code === '23505') throw new StaleRow();
      if (!check(response).length) throw new StaleRow();
    }

    async function save(familyId, userId, before, after, assertActive = () => {}) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const state = await read(familyId);
        const desired = mergeLists(before, after, state.lists);
        if (equal(desired, state.lists)) return state.lists;
        try {
          assertActive();
          if (state.legacy) await writeDocument(familyId, userId, state.document, desired);
          else await writeRelational(familyId, state, desired, shape(before), shape(after), assertActive);
          return (await read(familyId)).lists;
        } catch (error) {
          if (!(error instanceof StaleRow)) throw error;
        }
      }
      throw new Conflict();
    }

    return {read, save};
  }

  window.familyHomeListSync = {createRepository, mergeLists, equal, Conflict};
})();

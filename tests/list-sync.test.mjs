import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const domain = {};
runInNewContext(source('public/list-sync.js'), {window: domain});
const {createRepository, Conflict} = domain.familyHomeListSync;

function mockDatabase({legacy = false} = {}) {
  const tables = {
    family_lists: [{id:'list', family_id:'family', client_key:'market', name:'Mercado', emoji:null, sort_order:0, extra:{}, updated_at:'2026-10-01'}],
    list_categories: [],
    list_items: [{id:'item', list_id:'list', client_key:'base', name:'Produto', done:false, note:null, category_id:null, sort_order:0, data:{}, updated_at:'2026-10-01'}],
    family_documents: []
  };
  const requests = [];
  let nextId = 0;
  let failure;

  const client = {
    from(table) {
      let operation = 'select', values, range, single = false;
      const filters = [], orders = [];
      const query = {
        select: () => query,
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order(key) { orders.push(key); return query; },
        range(start, end) { range = [start, end]; return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        insert(row) { operation = 'insert'; values = row; return query; },
        update(row) { operation = 'update'; values = row; return query; },
        delete() { operation = 'delete'; return query; },
        then(resolve) {
          requests.push({table, operation, values});
          if (legacy && table === 'family_lists') return resolve({error:{code:'PGRST205'}});
          if (failure?.table === table && failure.operation === operation) {
            const {error} = failure;
            failure = null;
            return resolve({error});
          }
          const rows = tables[table];
          let result = rows.filter(row => filters.every(filter => filter(row)));
          if (operation === 'insert') {
            const key = table === 'family_documents' ? ['family_id','doc_key']
              : table === 'family_lists' ? ['family_id','client_key'] : ['list_id','client_key'];
            if (rows.some(row => key.every(field => row[field] === values[field]))) {
              return resolve({error:{code:'23505'}});
            }
            const row = {...structuredClone(values), id:'new-' + (++nextId)};
            rows.push(row);
            result = [row];
          } else if (operation === 'update') {
            for(const row of result) Object.assign(row, structuredClone(values));
          } else if (operation === 'delete') {
            tables[table] = rows.filter(row => !result.includes(row));
          }
          result.sort((a,b) => {
            for (const key of orders) {
              if (a[key] < b[key]) return -1;
              if (a[key] > b[key]) return 1;
            }
            return 0;
          });
          if (range) result = result.slice(range[0], range[1] + 1);
          resolve({data:structuredClone(single ? result[0] ?? null : result)});
        }
      };
      return query;
    }
  };
  return {client, tables, requests, fail(table, operation, error) { failure = {table, operation, error}; }};
}

const withItem = (lists, id) => lists.map(list => ({
  ...list, items:[...list.items, {id,name:id,done:false,category:'other'}]
}));
const editItem = (lists, changes) => lists.map(list => ({
  ...list, items:list.items.map(item => item.id === 'base' ? {...item,...changes} : item)
}));
const withPurchase = (lists, record) => lists.map(list => ({
  ...list, purchaseHistory:[...list.purchaseHistory, record]
}));

test('two stale clients add items without dropping each other’s changes', async () => {
  const {client,requests} = mockDatabase();
  const first = createRepository(client), second = createRepository(client);
  const a = (await first.read('family')).lists, b = (await second.read('family')).lists;
  await Promise.all([
    first.save('family','a',a,withItem(a,'added-a')),
    second.save('family','b',b,withItem(b,'added-b'))
  ]);
  const {lists} = await first.read('family');
  assert.deepEqual(Array.from(lists[0].items, item => item.id).sort(), ['added-a','added-b','base']);
  assert.equal(requests.some(request => request.operation === 'delete'), false);
  assert.equal(requests.some(request => request.operation === 'update'), false);
});

test('independent fields merge and conflicting edits stay pending for review', async () => {
  const {client} = mockDatabase();
  const db = createRepository(client);
  const base = (await db.read('family')).lists;
  await Promise.all([
    db.save('family','a',base,editItem(base,{name:'Atualizado'})),
    db.save('family','b',base,editItem(base,{done:true}))
  ]);
  const current = (await db.read('family')).lists[0].items[0];
  assert.equal(current.name,'Atualizado');
  assert.equal(current.done,true);
  await assert.rejects(db.save('family','b',base,editItem(base,{name:'Versão antiga'})), Conflict);
  assert.equal((await db.read('family')).lists[0].items[0].name,'Atualizado');
});

test('an explicit delete leaves newer items intact and a failed delete is retriable', async () => {
  const fixture = mockDatabase(), db = createRepository(fixture.client);
  const base = (await db.read('family')).lists;
  await db.save('family','a',base,withItem(base,'new'));
  const edited = base.map(list => ({...list,items:[]}));
  fixture.fail('list_items','delete',new Error('simulated failure'));
  await assert.rejects(db.save('family','b',base,edited), /simulated failure/);
  await db.save('family','b',base,edited);
  assert.deepEqual(Array.from((await db.read('family')).lists[0].items, item => item.id), ['new']);
});

test('a partial list creation resumes safely on retry', async () => {
  const fixture = mockDatabase(), db = createRepository(fixture.client);
  const base = (await db.read('family')).lists;
  const edited = [...base, {id:'new-list',name:'Nova',category:undefined,
    items:[{id:'child',name:'Item',done:false,category:'other'}]}];
  fixture.fail('list_items','insert',new Error('transport'));
  await assert.rejects(db.save('family','a',base,edited), /transport/);
  const lists = await db.save('family','a',base,edited);
  assert.equal(lists.find(list => list.id === 'new-list').items[0].id, 'child');
  assert.equal(fixture.tables.family_lists.filter(row => row.client_key === 'new-list').length, 1);
});

test('receipt keys prevent concurrent duplicates and distinct purchases are retained', async () => {
  const {client} = mockDatabase(), db = createRepository(client);
  const base = (await db.read('family')).lists;
  await Promise.all([
    db.save('family','a',base,withPurchase(base,{id:'r1',receiptKey:'receipt'})),
    db.save('family','b',base,withPurchase(base,{id:'r2',receiptKey:'receipt'}))
  ]);
  await db.save('family','c',base,withPurchase(base,{id:'r3',receiptKey:'other'}));
  assert.deepEqual(Array.from((await db.read('family')).lists[0].purchaseHistory, row => row.receiptKey), ['receipt','other']);
});

test('legacy document uses conditional writes and merges independent changes', async () => {
  const {client,tables} = mockDatabase({legacy:true}), db = createRepository(client);
  tables.family_documents.push({family_id:'family',doc_key:'lists',updated_at:'2026-10-01',
    payload:[{id:'market',name:'Mercado',items:[]}]});
  const base = (await db.read('family')).lists;
  await Promise.all([
    db.save('family','a',base,withItem(base,'first')),
    db.save('family','b',base,withItem(base,'second'))
  ]);
  assert.deepEqual(Array.from((await db.read('family')).lists[0].items, item => item.id).sort(), ['first','second']);
});

test('a relational read failure blocks writes to prevent empty or stale fallback from replacing data', async () => {
  const fixture = mockDatabase(), db = createRepository(fixture.client);
  const base = (await db.read('family')).lists;
  fixture.fail('list_items','select',new Error('read failure'));
  await assert.rejects(db.save('family','a',base,withItem(base,'new')), /read failure/);
  assert.equal(fixture.requests.some(request => request.operation !== 'select'), false);
});

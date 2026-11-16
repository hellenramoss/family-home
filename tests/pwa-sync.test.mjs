import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scope = 'fh-list-sync-v2:user:family';
const turn = () => new Promise(resolve => setImmediate(resolve));

function browser(storage, backend, online = true) {
  const events = new Map(), timers = new Map();
  let timerId = 0, authChange;
  const navigator = {onLine:online};
  const user = {id:'user'}, member = {family_id:'family',display_name:'Test',role:'member'};
  const localStorage = {
    getItem:key => storage.get(key) ?? null,
    setItem:(key,value) => storage.set(key,value),
    removeItem:key => storage.delete(key)
  };
  const document = {
    addEventListener(name, callback) { events.set(name,callback); },
    querySelector() { return null; },
    createElement() { return {append(){}}; },
    body:{append(){}}, head:{append(){}}
  };
  const query = {
    select:() => query, eq:() => query, order:() => query, limit:() => query,
    maybeSingle:async () => ({data:member})
  };
  const channel = {on:() => channel, subscribe:() => channel};
  const sb = {
    auth:{
      getSession:async () => ({data:{session:{user}}}),
      getUser:async () => ({data:{user}}),
      onAuthStateChange(callback) { authChange=callback; }
    },
    from:() => query, channel:() => channel, removeChannel() {}
  };
  const window = {
    addEventListener:(name, callback) => events.set(name, callback),
    dispatchEvent:event => events.get(event.type)?.(event),
    FAMILY_HOME_SYNC_CONFIG:{url:'mock',publishableKey:'mock'},
    supabase:{createClient:() => sb}
  };
  const context = {
    window,document,navigator,localStorage,Event,
    CustomEvent:class extends Event {
      constructor(name,options){super(name);this.detail=options.detail;}
    },
    setInterval(callback) { events.set('poll',callback); },
    setTimeout(callback) { timers.set(++timerId,callback);return timerId; },
    clearTimeout(id) { timers.delete(id); },
    console:{warn(){}}
  };
  runInNewContext(source('public/list-sync.js'),context);
  window.familyHomeListSync.createRepository=() => backend;
  runInNewContext(source('public/family-sync-v1.js'),context);
  return {
    async settle() {
      for (let attempt=0;attempt<12;attempt++) {
        await turn();
        const callbacks = [...timers.values()];
        timers.clear();
        if (!callbacks.length) return;
        for (const callback of callbacks) callback();
      }
      assert.fail('sync timers did not settle');
    },
    async online(value) { navigator.onLine=value; events.get('online')(); await this.settle(); },
    signedOut() { authChange('SIGNED_OUT'); },
    poll() { return events.get('poll')(); },
    auth:window.familyHomeCloud
  };
}

test('offline changes outlive a restart and are sent on reconnect', async () => {
  let lists = [{id:'market',name:'Mercado',items:[]}], saves = 0;
  const storage = new Map([
    ['fh-list-membership-v2:user', JSON.stringify({family_id:'family'})],
    [scope, JSON.stringify({snapshot:lists,pending:[]})]
  ]);
  const backend = {
    async read() { return {lists}; },
    async save(_family,_user,_before,after) { saves++; return lists=after; }
  };
  const first = browser(storage,backend,false);
  await first.settle();
  const before = first.auth.visibleLists;
  const after = [{...before[0],items:[{id:'offline',name:'Offline',done:false}]}];
  assert.equal(first.auth.editLists(before,after),true);
  await first.settle();
  assert.equal(saves,0);
  assert.equal(JSON.parse(storage.get(scope)).pending.length,1);

  const second = browser(storage,backend,false);
  await second.settle();
  assert.equal(second.auth.visibleLists[0].items[0].id,'offline');
  await second.online(true);
  assert.equal(saves,1);
  assert.equal(second.auth.syncState,'synced');
  assert.equal(JSON.parse(storage.get(scope)).pending.length,0);
});

test('a missing Realtime event is recovered by polling', async () => {
  let lists = [{id:'market',name:'Mercado',items:[]}];
  const client = browser(new Map(), {read:async () => ({lists})});
  await client.settle();
  assert.equal(client.auth.visibleLists[0].items.length,0);
  lists = [{...lists[0],items:[{id:'another',name:'Alteração',done:false}]}];
  client.poll();
  await client.settle();
  assert.equal(client.auth.visibleLists[0].items[0].id,'another');
});

test('the shell recovers a list from the URL or active ID and respects intentional Home navigation', () => {
  function start(hash, initial) {
    const storage = new Map(Object.entries(initial));
    const shell = {style:{},querySelector:()=>null,querySelectorAll:()=>[]};
    runInNewContext(source('public/app-shell.js'),{
      document:{body:{append(){}},createElement:()=>shell,getElementById:()=>({})},
      localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
      location:{hash},history:{replaceState(){}},
      MutationObserver:class {observe(){}},setTimeout(){},crypto:globalThis.crypto
    });
    return [shell.style.display,storage.get('fh-shell-route')];
  }
  assert.deepEqual(start('#fh=lists',{'fh-shell-route':'home'}),['none','lists']);
  assert.deepEqual(start('',{'fh-active-list-id':'market'}),['none','lists']);
  assert.deepEqual(start('#fh=home',{'fh-active-list-id':'market'}),['block','home']);
});

test('a notification focuses an existing Family Home window without navigating it', async () => {
  const handlers = new Map();
  let focused = 0, navigated = 0, newWindows = 0, work;
  const self = {
    location:{origin:'https://example.test'},
    addEventListener:(event, callback) => handlers.set(event,callback),
    clients:{
      matchAll:async () => [
        {url:'https://example.test/other/',focus(){throw Error('wrong app');}},
        {url:'https://example.test/family-home/#fh=lists',focus(){focused++;},navigate(){navigated++;}}
      ],
      openWindow(){newWindows++;}
    }
  };
  runInNewContext(source('public/sw.js'),{self,URL});
  handlers.get('notificationclick')({notification:{close(){}},waitUntil:promise=>work=promise});
  await work;
  assert.deepEqual([focused,navigated,newWindows],[1,0,0]);
});

test('recurrence reopens a due task through the list editor without reloading the page', () => {
  const meta = {'test task':{repeat:'daily',nextDueDate:'2010-01-01'}};
  const stored = new Map([['fh-house-meta-v1',JSON.stringify(meta)]]);
  let lists = [{id:'house',items:[{id:'task',name:'Test task',done:true}]}], timer;
  const window = {
    addEventListener(){},
    dispatchEvent(event){lists=event.detail.apply(lists);event.detail.saved=true;}
  };
  runInNewContext(source('public/task-recurrence-reminders.js'),{
    window,document:{
      createElement:()=>({}),head:{append(){}},body:{},querySelectorAll:()=>[],addEventListener(){}
    },
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)},
    CustomEvent:class {constructor(_name,options){this.detail=options.detail;}},
    MutationObserver:class {observe(){}},
    setInterval(callback){timer=callback;},setTimeout(){},
    location:{reload(){throw Error('unexpected reload');}}
  });
  timer();
  assert.equal(lists[0].items[0].done,false);
  assert.ok(JSON.parse(stored.get('fh-house-meta-v1'))['test task'].reopenedOn);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('a partially overlapping legacy batch preserves the original batch and counts new items once', () => {
 const storage = new Map();
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const window={addEventListener(){}};
 const context={window,localStorage,document:{body:{},querySelector:()=>null},MutationObserver:class{observe(){}},setInterval(){},setTimeout(){}};
 const source=readFileSync(new URL('../public/budget-experience-v3.js',import.meta.url),'utf8').replace('let queued=false;','window.audit={sync};let queued=false;');
 vm.runInNewContext(source,context);
 storage.set('family-home-lists',JSON.stringify([{id:'market',items:[],purchaseHistory:[
  {id:'first',price:'20,00',purchasedAt:'2026-11-10T10:00:00-03:00'},
  {id:'second',price:'30,00',purchasedAt:'2026-11-10T10:00:00-03:00'}
 ]}]));
 const original={id:'batch',source:'market-batch',sourcePurchaseIds:['first'],categoryId:'market',amount:20,date:'2026-11-10',description:'Compra anterior'};
 storage.set('fh-budget-v1',JSON.stringify({categories:[{id:'market'}],transactions:[original]}));
 window.audit.sync();window.audit.sync();
 const transactions=JSON.parse(storage.get('fh-budget-v1')).transactions;
 assert.deepEqual(transactions.find(item=>item.id==='batch'),original);
 assert.equal(transactions.filter(item=>!item.hidden).reduce((sum,item)=>sum+item.amount,0),50);
 assert.ok(transactions.some(item=>item.sourcePurchaseId==='first'&&item.hidden));
});

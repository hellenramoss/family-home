import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
test('a legacy batch overlapping a purchase group is counted once', () => {
  const storage = new Map();
  const localStorage = {getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const window = {addEventListener(){}};
  const context = {window,localStorage,document:{body:{},querySelector:()=>null},
    MutationObserver:class{observe(){}},setInterval(){},setTimeout(){}};
  const script = read('budget-experience-v3.js').replace('let queued=false;', 'window.audit={sync};let queued=false;');
  vm.runInNewContext(script, context);
  storage.set('family-home-lists', JSON.stringify([{id:'market',items:[],purchaseHistory:[
    {id:'p',price:'100,00',itemName:'Teste',purchasedAt:'2026-11-10T10:00:00-03:00'}
  ]}]));
  storage.set('fh-budget-v1', JSON.stringify({categories:[{id:'market'}],transactions:[
    {id:'old',source:'market-batch',sourcePurchaseIds:['p'],categoryId:'market',amount:100,date:'2026-11-10'}
  ]}));
  window.audit.sync();
  window.audit.sync();
  const transactions=JSON.parse(storage.get('fh-budget-v1')).transactions.filter(item=>!item.hidden);
  assert.equal(transactions.reduce((total,item)=>total+item.amount,0),100);
});
test('Nubank person filter includes allocated invoice lines', () => {
  const source=read('finance-nubank-shared.js');
  const expression=source.match(/const rows=(.*);/)[1];
  const rows=vm.runInNewContext(expression,{filter:'hellen',lines:[{id:'a',allocation:'hellen'}],personals:[]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'a');
});
test('Nubank displays fractional cents with the historical upward rounding', () => {
  const expression=read('finance-nubank-shared.js').match(/const fmt=n=>(.*);/)[1];
  assert.ok(vm.runInNewContext('(n=>'+expression+')(1.001)').includes('1,01'));
});

test('dashboard keeps remote expense and local purchases visible without mixing totals',()=>{
 const file=readFileSync(new URL('../public/finance-dashboard.js',import.meta.url),'utf8');
 const body={innerHTML:'',querySelectorAll:()=>[]},target={innerHTML:'',querySelectorAll:()=>[]};
 const panel={querySelector:selector=>selector==='.fdBody'?body:target,querySelectorAll:()=>[]};
 const window={addEventListener(){}};
 const document={documentElement:{},querySelector:selector=>selector==='.financeDashboard'?panel:null};
 const code=file.replace('window.addEventListener', "window.test={set:(v)=>{rows=v.rows;marketSpent=v.marketSpent;petsSpent=v.petsSpent;marketItems=v.marketItems;tab='transactions';scope='family'},render};window.addEventListener");
 vm.runInNewContext(code,{window,document,MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 window.test.set({rows:[{id:'remote',title:'Previsão mercado',category:'Mercado',direction:'expense',status:'planned',amount:150,competence:'2026-11-01'}],
 marketSpent:80,petsSpent:20,marketItems:[{amount:100,marketAmount:80,petAmount:20,date:'2026-11-10',description:'Compra'}]});
 window.test.render();
 assert.match(target.innerHTML,/Previsão mercado/);
 assert.match(target.innerHTML,/80,00/);
 assert.match(target.innerHTML,/20,00/);
 assert.match(body.innerHTML,/150,00/);
 assert.match(body.innerHTML,/histórico local/);
});
test('a historical expense with unknown payment is presented without claiming it is unpaid',()=>{
 const body={innerHTML:'',querySelectorAll:()=>[]},target={innerHTML:'',querySelectorAll:()=>[]};
 const panel={querySelector:selector=>selector==='.fdBody'?body:target,querySelectorAll:()=>[]};
 const window={addEventListener(){}};
 const document={documentElement:{},querySelector:selector=>selector==='.financeDashboard'?panel:null};
 const code=read('finance-dashboard.js').replace('window.addEventListener',"window.test={set:()=>{rows=[{id:'historical',title:'Conta',category:'Casa',direction:'expense',status:'posted',payment_status:'unknown',amount:50,competence:'2025-01-01'}];tab='transactions';scope='family'},render};window.addEventListener");
 vm.runInNewContext(code,{window,document,MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 window.test.set();window.test.render();
 assert.match(target.innerHTML,/Pagamento não informado/);
 assert.doesNotMatch(target.innerHTML,/Não pago/);
 assert.match(target.innerHTML,/Marcar pago/);
});
test('personal card details appear in the individual view without payment or transaction editing actions',()=>{
 const body={innerHTML:'',querySelectorAll:()=>[]},target={innerHTML:'',querySelectorAll:()=>[]};
 const panel={querySelector:selector=>selector==='.fdBody'?body:target,querySelectorAll:()=>[]};
 const window={addEventListener(){}};
 const document={documentElement:{},querySelector:selector=>selector==='.financeDashboard'?panel:null};
 const code=read('finance-dashboard.js').replace('window.addEventListener',"window.test={set:()=>{rows=[{id:'card-line',title:'Compra',category:'Cartões',direction:'expense',status:'posted',payment_status:'unknown',amount:50,competence:'2026-11-01',cardDetail:true}];tab='transactions';scope='person'},render};window.addEventListener");
 vm.runInNewContext(code,{window,document,MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 window.test.set();window.test.render();
 assert.match(target.innerHTML,/Compra pessoal incluída na fatura familiar/);
 assert.doesNotMatch(target.innerHTML,/data-pay|data-edit/);
});

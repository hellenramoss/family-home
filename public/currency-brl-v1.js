(()=>{
const LISTS='family-home-lists';
const nativeValueSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
const moneyField=input=>{
  if(!(input instanceof HTMLInputElement))return false;
  if(input.closest('.priceRow'))return true;
  const label=input.closest('label');
  const text=(label?.textContent||'').toLowerCase();
  return text.includes('preço pago')||text.includes('valor reservado')||(input.closest('.fhBudgetEditModal')&&text.includes('valor'));
};
const formatDigits=value=>{
  const digits=String(value||'').replace(/\D/g,'');
  if(!digits)return'';
  return (Number(digits)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
};
const normalizeLegacy=value=>{
  const s=String(value||'').trim();
  if(!s)return s;
  if(/^\d+\.\d{1,2}$/.test(s))return s.replace('.',',');
  return s;
};
function setForReact(input,value){
  if(input.value===value)return;
  if(nativeValueSetter)nativeValueSetter.call(input,value);else input.value=value;
}
function repairStoredPrices(){
  try{
    const lists=JSON.parse(localStorage.getItem(LISTS)||'[]');let changed=false;
    lists.forEach(list=>{
      (list.items||[]).forEach(item=>{if(item.price){const n=normalizeLegacy(item.price);if(n!==item.price){item.price=n;changed=true}}});
      (list.purchaseHistory||[]).forEach(row=>{if(row.price){const n=normalizeLegacy(row.price);if(n!==row.price){row.price=n;changed=true}}});
    });
    if(changed)localStorage.setItem(LISTS,JSON.stringify(lists));
  }catch{}
}
repairStoredPrices();
document.addEventListener('focusin',e=>{
  const input=e.target;if(!moneyField(input))return;
  const fixed=normalizeLegacy(input.value);if(fixed!==input.value)setForReact(input,fixed)
},true);
document.addEventListener('input',e=>{
  const input=e.target;if(!moneyField(input))return;
  const masked=formatDigits(input.value);setForReact(input,masked)
},true);
})();
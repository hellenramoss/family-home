(()=>{
function split(total,count,firstMonth){
 const value=String(total).trim().replace(/\./g,'').replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(value)||!Number.isInteger(count)||count<1||count>360||!/^\d{4}-(0[1-9]|1[0-2])$/.test(firstMonth))throw Error('Informe valor, número de parcelas e mês inicial válidos.');
 const [integer,fraction='']=value.split('.');const cents=Number(integer)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents))throw Error('Valor excede o limite permitido.');
 const base=Math.floor(cents/count),remainder=cents%count,[year,month]=firstMonth.split('-').map(Number);
 return Array.from({length:count},(_,i)=>{const current=year*12+month-1+i;return {number:i+1,count,month:String(Math.floor(current/12)).padStart(4,'0')+'-'+String(current%12+1).padStart(2,'0'),cents:base+(i<remainder?1:0)}});
}
function parseExisting(label){
 const value=String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 if(!value)return {type:'unknown'};
 if(value==='recorrente')return {type:'recurring'};
 if(value==='ultima')return {type:'last'};
 const match=value.match(/^(\d+)\s*(?:de|\/)\s*(\d+)$/);
 if(!match)return {type:'unknown'};
 const current=Number(match[1]),count=Number(match[2]);
 if(!Number.isSafeInteger(current)||!Number.isSafeInteger(count)||current<1||count<current||count>600)return {type:'unknown'};
 return {type:'installment',current,count,remaining:count-current};
}
function projectExisting(label,amountCents,firstMonth){
 const item=parseExisting(label);
 if(item.type!=='installment'||!Number.isSafeInteger(amountCents)||amountCents<0||!/^\d{4}-(0[1-9]|1[0-2])$/.test(firstMonth))return [];
 const [year,month]=firstMonth.split('-').map(Number);
 return Array.from({length:item.remaining},(_,i)=>{const current=year*12+month+i;return {number:item.current+i+1,count:item.count,month:String(Math.floor(current/12)).padStart(4,'0')+'-'+String(current%12+1).padStart(2,'0'),cents:amountCents}});
}
window.familyFinanceInstallments={split,parseExisting,projectExisting};
})();

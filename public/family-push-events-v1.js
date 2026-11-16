(()=>{
const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return null}};
const itemMap=l=>new Map((l?.items||[]).map(i=>[i.id,i]));
function activity(before,after){
 if(!Array.isArray(before)||!Array.isArray(after))return null;
 const oldLists=new Map(before.map(l=>[l.id,l])),newLists=new Map(after.map(l=>[l.id,l]));
 const changes=[];
 for(const l of after){
  const old=oldLists.get(l.id);
  if(!old){changes.push({kind:'list-add',list:l});continue}
  if(old.name!==l.name)changes.push({kind:'list-rename',list:l,oldName:old.name});
  const om=itemMap(old),nm=itemMap(l);
  for(const i of l.items||[]){
   const oi=om.get(i.id);
   if(!oi)changes.push({kind:'item-add',list:l,item:i});
   else if(Boolean(oi.done)!==Boolean(i.done))changes.push({kind:i.done?'item-done':'item-undone',list:l,item:i});
   else if(oi.name!==i.name)changes.push({kind:'item-edit',list:l,item:i,oldItem:oi});
  }
  for(const i of old.items||[])if(!nm.has(i.id))changes.push({kind:'item-delete',list:l,item:i});
 }
 for(const l of before)if(!newLists.has(l.id))changes.push({kind:'list-delete',list:l});
 if(changes.length!==1)return null;
 return changes[0];
}
function text(change,actor){
 const a=actor||'Alguém',ln=change.list?.name||'uma lista',n=change.item?.name||'';
 switch(change.kind){
  case'item-add':return`${a} adicionou “${n}” em ${ln}`;
  case'item-done':return`${a} concluiu “${n}” em ${ln}`;
  case'item-undone':return`${a} reabriu “${n}” em ${ln}`;
  case'item-delete':return`${a} removeu “${n}” de ${ln}`;
  case'item-edit':return`${a} atualizou “${n}” em ${ln}`;
  case'list-rename':return`${a} renomeou “${change.oldName}” para “${ln}”`;
  case'list-add':return`${a} criou a lista “${ln}”`;
  case'list-delete':return`${a} removeu a lista “${ln}”`;
  default:return null;
 }
}
const cloud=window.familyHomeCloud,sb=window.familyHomeSupabase;
if(!cloud||!sb)return;
const save=cloud.saveLists.bind(cloud);
cloud.saveLists=async (before,after)=>{
 const result=await save(before,after);
 const change=activity(before,after);
 if(!change)return result;
 const body=text(change,cloud.currentMembership?.display_name);
 if(body){
  void sb.functions.invoke('push-test',{body:{title:'Family Home 🏠',body,tag:`family-home-${change.kind}-${change.list?.id||'list'}`,url:'/family-home/'}})
   .then(({error})=>{if(error)console.warn('Family Home: notificação indisponível.')})
   .catch(()=>console.warn('Family Home: notificação indisponível.'));
 }
 return result;
};
})();

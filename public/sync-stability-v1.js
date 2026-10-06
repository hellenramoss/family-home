(()=>{
let localUntil=0;
const mark=()=>{localUntil=Date.now()+1800};
document.addEventListener('click',e=>{if(e.target.closest?.('.itemCheck,.swipeDelete,.primaryAction,.confirm'))mark()},true);
document.addEventListener('touchend',e=>{if(e.target.closest?.('.itemCheck'))mark()},true);
window.addEventListener('family-home-cloud-data',e=>{if(Date.now()<localUntil)e.stopImmediatePropagation()},true);
window.addEventListener('family-home-family-ready',()=>{const cloud=window.familyHomeCloud;if(!cloud||cloud.__stableSave)return;cloud.__stableSave=true;const save=cloud.saveLists.bind(cloud);cloud.saveLists=async payload=>{mark();try{return await save(payload)}finally{setTimeout(()=>{if(Date.now()>=localUntil)localUntil=0},200)}}});
})();
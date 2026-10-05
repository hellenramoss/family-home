(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  if(!descriptor?.get||!descriptor?.set)return;
  Object.defineProperty(Node.prototype,'textContent',{
    configurable:descriptor.configurable,
    enumerable:descriptor.enumerable,
    get:descriptor.get,
    set(value){
      const next=value==null?'':String(value);
      if(descriptor.get.call(this)===next)return;
      descriptor.set.call(this,value);
    }
  });
})();

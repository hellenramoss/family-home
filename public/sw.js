const CACHE='family-home-v3';
const APP='/family-home/';

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add(new Request(APP,{cache:'reload'}))));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request,{cache:'no-store'})
      .then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request);
        return cached||caches.match(APP);
      })
  );
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||''}}
  const title=data.title||'Family Home';
  const options={
    body:data.body||'A família atualizou uma lista.',
    icon:'/family-home/icons/icon-192.png',
    badge:'/family-home/icons/icon-192.png',
    tag:data.tag||'family-home-update',
    renotify:true,
    data:{url:data.url||APP,listId:data.listId||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||APP;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target);return}
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});

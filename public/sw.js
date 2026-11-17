const CACHE='family-home-v29';
const APP='/family-home/';
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const request = new Request(APP, {cache:'reload'});
    const response = await fetch(request);
    if (!response.ok) throw new Error('Family Home shell unavailable');
    const html = await response.clone().text();
    const assets = new Set();
    for (const [, reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      const url = new URL(reference, response.url || new URL(APP, self.location.origin));
      if (url.origin === self.location.origin && url.pathname.startsWith(APP)) assets.add(url.href);
    }
    await cache.addAll([...assets]);
    await cache.put(request, response);
    try { await cache.add(SDK); } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('family-home-v') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const appAsset = url.origin === self.location.origin && url.pathname.startsWith(APP);
  if (!appAsset && url.href !== SDK) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, {cache:'no-store'});
      if (response.ok || url.href === SDK && response.type === 'opaque') {
        try { await cache.put(event.request, response.clone()); } catch {}
      }
      if (response.ok || response.type === 'opaque' || response.status < 500) return response;
    } catch {}
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return await cache.match(APP) || Response.error();
    return Response.error();
  })());
});

self.addEventListener('push', event => {
  let data={};
  try { data=event.data?.json()||{}; } catch { data={body:event.data?.text()||''}; }
  const title=data.title||'Family Home';
  const options={
    body:data.body||'A família atualizou uma lista.',
    icon:'/family-home/family-home-icon.svg',
    badge:'/family-home/family-home-icon.svg',
    tag:data.tag||'family-home-update',
    renotify:true,
    data:{url:data.url||APP}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const app=windows.find(client=>{
      const url=new URL(client.url);
      return url.origin===self.location.origin&&url.pathname.startsWith(APP);
    });
    if(app) {
      await app.focus();
      return;
    }
    const url=new URL(event.notification.data?.url||APP,self.location.origin);
    const target=url.origin===self.location.origin&&url.pathname.startsWith(APP)?url.href:APP;
    await self.clients.openWindow(target);
  })());
});

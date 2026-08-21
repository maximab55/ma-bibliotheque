// Ma Bibliothèque V19 — service worker
const VERSION="v19";
const SHELL_CACHE=`ma-bibliotheque-shell-${VERSION}`;
const DATA_CACHE=`ma-bibliotheque-data-${VERSION}`;
const IMAGE_CACHE=`ma-bibliotheque-images-${VERSION}`;

const APP_SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith("ma-bibliotheque-") && ![SHELL_CACHE,DATA_CACHE,IMAGE_CACHE].includes(key))
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,cacheName,{ignoreSearch=false}={}){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request);
    if(response && (response.ok || response.type==="opaque")){
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(error){
    const cached=await cache.match(request,{ignoreSearch});
    if(cached)return cached;
    throw error;
  }
}

async function cacheFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response && (response.ok || response.type==="opaque")){
    cache.put(request,response.clone()).catch(()=>{});
  }
  return response;
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);

  // App navigation: use fresh site online, cached shell offline.
  if(request.mode==="navigate"){
    event.respondWith(
      networkFirst(request,SHELL_CACHE)
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  // Public library API request only. Never cache authenticated GitHub requests.
  if(
    url.hostname==="api.github.com" &&
    url.pathname==="/repos/maximab55/ma-bibliotheque/contents/library.json" &&
    !request.headers.has("authorization")
  ){
    event.respondWith(networkFirst(request,DATA_CACHE,{ignoreSearch:true}));
    return;
  }

  // Cache covers and other images after first display.
  if(request.destination==="image"){
    event.respondWith(cacheFirst(request,IMAGE_CACHE));
    return;
  }

  // Same-origin application assets.
  if(url.origin===self.location.origin){
    event.respondWith(
      networkFirst(request,SHELL_CACHE)
        .catch(()=>caches.match(request))
    );
  }
});

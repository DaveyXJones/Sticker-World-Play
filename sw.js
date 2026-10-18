/* Sticker Worlds outside Claude: keeps the page, its icons, its fonts and its music, so it opens without a connection.
   build.sh stamps which copy this is into KIND ('sticker-worlds', or 'sticker-worlds-test' for the test copy in test/)
   and the build into CACHE, so each new build replaces the old copy of the same kind, and leaves the other alone. */
const KIND = 'sticker-worlds', CACHE = KIND + '-2340340234';
// This copy's own files sit in the folder beside sw.js, and its songs in music/. The test copy lives in a folder below
// the real one's, so the real one's service worker sees its requests too (before the test copy's own takes over): it
// leaves those be.
const ROOT = new URL('./', location.href).pathname;
const ours = url => { const rest = url.pathname.slice(ROOT.length); return url.pathname.startsWith(ROOT) && !rest.replace(/^music\//, '').includes('/'); };
const SHELL = ['./', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'music/woodblock-whispers.mp3'];
const FONTS = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap';

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);
  try { // the fonts too, so the cover title looks right offline
    const css = await fetch(FONTS);
    if (css.ok) {
      const text = await css.clone().text();
      await c.put(FONTS, css);
      await Promise.all([...text.matchAll(/url\((https:[^)]+)\)/g)].map(m => c.add(m[1])));
    }
  } catch (err) { /* offline while installing: they're kept the first time the page asks for them */ }
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.replace(/-\d+$/, '') === KIND) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || (url.origin === location.origin && !ours(url))) return; // (the test copy's, say)
  if (r.mode === 'navigate') {
    // The page itself: the newest from the network, or the kept copy when there's no connection (or it's slow).
    const net = fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
      return res;
    });
    const slow = new Promise(ok => setTimeout(ok, 3500)).then(() => caches.match('./'));
    e.respondWith(Promise.race([net, slow]).then(res => res || net).catch(() => caches.match('./')));
  } else if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(r, { ignoreVary: true }).then(hit => hit || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    })));
  }
});

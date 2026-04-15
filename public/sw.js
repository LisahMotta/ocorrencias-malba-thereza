// sw.js — Service Worker do PWA Ocorrências Malba Thereza
const CACHE = 'sisroe-v9';

// Arquivos que ficam em cache para funcionar offline
const ARQUIVOS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/ws.js',
  '/js/chat.js',
  '/js/notif.js',
  '/assets/logo_sp.png',
  '/assets/turmas.json',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instalação — cacheia os arquivos estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

// Ativação — limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — estratégia: rede primeiro, cache como fallback
self.addEventListener('fetch', (e) => {
  // Ignorar qualquer coisa que não seja http/https PRIMEIRO
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) return;

  const url = new URL(e.request.url);

  // Requisições de API sempre vão para a rede
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ erro: 'Sem conexão. Verifique a internet.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Ignorar chrome-extension e outros esquemas não suportados
  if (!e.request.url.startsWith('http')) return;

  // WebSocket — não interceptar
  if (e.request.url.startsWith('ws')) return;

  // Arquivos estáticos — rede primeiro, cache como fallback
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // Só cacheia URLs http/https (ignora chrome-extension e outros)
        if (e.request.url.startsWith('http')) {
          const clone = resp.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// Recebe mensagem para forçar atualização
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

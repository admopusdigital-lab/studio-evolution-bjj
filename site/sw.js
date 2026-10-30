/* Studio Evolution BJJ · service worker do app (app.html e o painel, area-do-professor.html?painel).
   Guarda as telas para o app abrir rápido e mesmo sem internet.
   - Páginas, scripts e estilos do site: busca na rede primeiro (sempre a versão nova) e usa a guardada se cair.
   - Imagens, fontes e bibliotecas com versão no endereço: usa a guardada e só busca na rede se não tiver.
   - Login e dados (Supabase) e vídeos: nunca passam pelo cache.
   Ao mudar a lista abaixo, suba a versão (VERSAO) para o celular trocar o cache antigo. */
var VERSAO = "evo-app-v5";
var TELAS = [
  "app.html", "painel.html", "painel.js", "painel-hoje.js", "painel-alunos.js", "painel-crm.js", "painel-fin.js", "painel-mov.js", "painel.css", "area-do-professor.html", "entrar.html", "nova-senha.html", "acessos.html",
  "site.css", "app.css", "tema.css", "acesso.css",
  "site.js", "acesso.js", "movimentos.js", "supabase-config.js", "manifest.webmanifest",
  "img/logo-evolution-mask.webp", "img/logo-evolution-bjj.webp",
  "img/app/icone-192.png", "img/app/favicon-32.png",
  "img/takes/guarda.jpg", "img/takes/tecnica.jpg", "img/takes/aquecimento.jpg", "img/takes/adulto.jpg",
  "img/takes/abertura-1.jpg", "img/takes/abertura-2.jpg", "img/takes/abertura-3.jpg"
];
var DE_FORA = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener("install", function (e) {
  /* uma tela que falte não impede as outras de entrar no cache */
  e.waitUntil(caches.open(VERSAO).then(function (c) {
    return Promise.all(TELAS.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("evo-app-") === 0 && k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function guarda(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    var copia = res.clone();
    caches.open(VERSAO).then(function (c) { c.put(req, copia); });
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || req.headers.has("range")) return;
  var daqui = url.origin === self.location.origin;
  if (!daqui && !DE_FORA.test(req.url)) return;          /* Supabase e o resto: direto na rede */
  if (/\.(mp4|webm|mp3)$/i.test(url.pathname)) return;    /* vídeos e áudio: grandes demais para guardar */

  var fixo = !daqui || /\.(png|jpe?g|webp|avif|svg|woff2?)$/i.test(url.pathname);
  if (fixo) {
    e.respondWith(caches.match(req).then(function (tem) {
      return tem || fetch(req).then(function (res) { return guarda(req, res); });
    }));
    return;
  }
  /* páginas: entrar.html?app e entrar.html são a mesma tela guardada */
  var pagina = req.mode === "navigate";
  e.respondWith(fetch(req).then(function (res) { return guarda(req, res); }).catch(function () {
    return caches.match(req, { ignoreSearch: pagina }).then(function (tem) {
      return tem || (pagina ? caches.match("entrar.html") : Response.error());
    });
  }));
});

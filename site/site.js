/* Studio Evolution BJJ · comportamento comum a todas as páginas do redesign.
   Cada página chama Site.boot({ intro, setup, loader }) no fim do próprio script. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var Site = (window.Site = { $: $, $$: $$, root: root, reduce: reduce, fine: fine, lenis: null });

  /* Cada página abre no topo: o navegador não deve trazer a posição da página anterior.
     Só um #id que exista na página (ex.: #horarios) leva direto até ele. */
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  var hashEl = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  var touched = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) { window.addEventListener(t, function () { touched = true; }, { passive: true, once: true }); });
  function toTop() {
    if (hashEl || touched) return;
    window.scrollTo(0, 0);
    if (Site.lenis) Site.lenis.scrollTo(0, { immediate: true, force: true });
  }
  toTop();

  function session(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }
  Site.session = session;

  /* ---------- Versão Black (padrão) / Claro ---------- */
  var lookBtn = $("#lookBtn"), lookTxt = $("#lookTxt");
  /* o nome do botão é o próprio texto ("Versão clara"): quem usa comando de voz fala o que vê.
     Onde não cabe, o texto sai da tela pelo CSS, mas continua sendo o nome. */
  if (lookBtn) { lookBtn.removeAttribute("aria-pressed"); lookBtn.removeAttribute("aria-label"); }
  function paintLook(l) {
    var black = l === "black";
    root.setAttribute("data-look", l);
    if (lookTxt) lookTxt.textContent = black ? "Versão clara" : "Versão black";
    /* sem armazenamento no navegador, a versão clara segue de página em página pelo #claro */
    $$("a[data-int]").forEach(function (a) {
      var base = a.getAttribute("data-base") || a.getAttribute("href");
      a.setAttribute("data-base", base);
      a.setAttribute("href", base + (!black && base.indexOf("#") < 0 ? "#claro" : ""));
    });
    try { localStorage.setItem("evo-tema", l); } catch (e) {}
    try {
      if (!black && !location.hash) history.replaceState(null, "", "#claro");
      if (black && (location.hash === "#claro" || location.hash === "#black")) history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {}
  }
  Site.paintLook = paintLook;
  paintLook(root.getAttribute("data-look") === "black" ? "black" : "light");
  if (lookBtn) lookBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-look") === "black" ? "light" : "black";
    var r = lookBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!document.startViewTransition || reduce) { paintLook(next); return; }
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var vt = document.startViewTransition(function () { paintLook(next); });
    vt.ready.then(function () {
      root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] },
        { duration: 1100, easing: "cubic-bezier(0.76, 0, 0.24, 1)", pseudoElement: "::view-transition-new(root)" });
    });
  });

  /* ---------- Botões: o texto rola no hover ---------- */
  $$(".btn").forEach(function (b) {
    var tn = Array.prototype.slice.call(b.childNodes).find(function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    if (!tn) return;
    var t = tn.textContent.trim(), w = document.createElement("span");
    w.className = "bt"; w.setAttribute("data-t", t); w.innerHTML = "<span></span>"; w.firstChild.textContent = t;
    b.replaceChild(w, tn);
  });

  /* ---------- Menu em tela cheia (celular e tablet) ---------- */
  var nav = $("#nav"), menuBtn = null, menu = null, menuOpen = false;
  if (nav) {
    menuBtn = document.createElement("button");
    menuBtn.className = "menu-btn"; menuBtn.type = "button";
    menuBtn.setAttribute("aria-label", "Abrir menu"); menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.innerHTML = "<i></i><i></i>";
    $(".nav-right", nav).appendChild(menuBtn);
    menu = document.createElement("div");
    menu.className = "menu"; menu.id = "menu"; menu.setAttribute("aria-hidden", "true");
    var items = $$(".links a", nav).map(function (a) {
      return '<a href="' + a.getAttribute("href") + '" data-int><span>' + a.textContent.trim() + "</span></a>";
    }).join("");
    menu.innerHTML = "<nav aria-label=\"Menu\">" + items + '<a href="area-do-aluno.html" data-int><span><em>Área do aluno</em></span></a></nav>' +
      '<div class="menu-foot"><b>(15) 99674-1812</b><span>Av. Getúlio Vargas, 400 · Jardim São Paulo, Sorocaba</span><span>Segunda a sexta · Adulto 8h, 11h e 19h · Kids 10h e 18h</span></div>';
    document.body.appendChild(menu);
    menuBtn.setAttribute("aria-controls", "menu");
    paintLook(root.getAttribute("data-look"));
  }
  function setMenu(open) {
    if (!menu) return;
    menuOpen = open;
    root.classList.toggle("menu-open", open);
    navTone();
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    if (Site.lenis) open ? Site.lenis.stop() : Site.lenis.start();
    if (window.gsap && !reduce) {
      gsap.killTweensOf(menu);
      if (open) {
        gsap.set(menu, { visibility: "visible" });
        gsap.to(menu, { clipPath: "circle(150% at 100% 0%)", duration: 0.9, ease: "expo.inOut" });
        gsap.fromTo($$("nav a span", menu), { yPercent: 130 }, { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.06, delay: 0.25 });
      } else {
        gsap.to(menu, { clipPath: "circle(0% at 100% 0%)", duration: 0.7, ease: "expo.inOut", onComplete: function () { gsap.set(menu, { visibility: "hidden" }); } });
      }
    } else {
      menu.style.visibility = open ? "visible" : "hidden";
      menu.style.clipPath = open ? "none" : "circle(0% at 100% 0%)";
    }
  }
  if (menuBtn) menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen) setMenu(false); });

  /* ---------- Navegação e botão do WhatsApp claros sobre os capítulos escuros ---------- */
  var darks = $$("[data-dark]"), waBtn = $(".wa-float");
  function over(y) {
    for (var i = 0; i < darks.length; i++) {
      var r = darks[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return true;
    }
    return false;
  }
  function navTone() {
    if (!nav || !darks) return;
    nav.classList.toggle("on-dark", over(40) && !menuOpen);
    if (waBtn) waBtn.classList.toggle("on-dark", over(window.innerHeight - 50));
  }
  if (nav && darks.length) {
    window.addEventListener("scroll", navTone, { passive: true });
    window.addEventListener("resize", navTone);
    navTone();
  }

  /* ---------- Divisão de texto ----------
     Cada palavra fica inteira dentro de uma máscara e sobe de uma vez.
     Dividir letra por letra quebrava o espaçamento da Bodoni ("V enha") e deixava pedaços soltos no meio do giro. */
  function mask(inner) { var w = document.createElement("span"); w.className = "w"; inner.classList.add("wi"); w.appendChild(inner); return w; }
  function split(el, mode) {
    if (!el) return [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var s = document.createElement("span"); s.textContent = p;
            if (mode === "fade") { s.className = "fw"; frag.appendChild(s); return; }
            frag.appendChild(mask(s));
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains("pill") && !ch.classList.contains("nosplit")) {
          if (ch.classList.contains("hy")) {
            if (mode !== "fade") { var hold = document.createElement("span"); ch.parentNode.insertBefore(hold, ch); hold.parentNode.replaceChild(mask(ch), hold); }
            return;
          }
          walk(ch);
        }
      });
    })(el);
    return $$(mode === "fade" ? ".fw" : ".wi", el);
  }
  Site.split = split;
  function inView(el, f) { return el.getBoundingClientRect().top < window.innerHeight * (f || 0.92); }
  Site.inView = inView;

  /* entrada dos títulos: cada palavra sobe esticada, deitada para trás, e fica de pé, como um golpe que encaixa */
  var PUNCH = { yPercent: 120, scaleY: 1.45, skewY: 7, rotationX: 58, transformOrigin: "0% 100%" };
  Site.PUNCH = PUNCH;
  /* rótulos em mono: as letras embaralham e se acertam, como um painel de placar */
  function scramble(el) {
    if (reduce || el.children.length || el.dataset.scr) return;
    el.dataset.scr = "1";
    var txt = el.textContent, abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", n = 0, total = 16;
    var tick = function () {
      n++;
      var reveal = Math.floor((n / total) * txt.length);
      el.textContent = txt.split("").map(function (c, i) { return i < reveal || /[\s·\-—,.\/]/.test(c) ? c : abc[Math.floor(Math.random() * abc.length)]; }).join("");
      if (n < total) setTimeout(tick, 34); else el.textContent = txt;
    };
    tick();
  }
  Site.scramble = scramble;

  /* Abertura padrão das páginas internas */
  function defaultIntro() {
    var tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
    var t = $(".phero-title");
    if (t) tl.from(split(t, "words"), Object.assign({ duration: 1.4, stagger: 0.06 }, PUNCH), 0);
    $$(".phero .label").forEach(function (l) { tl.add(function () { scramble(l); }, 0.3); });
    /* abertura de cinema: a foto acende do escuro, o kanji desliza, os botões sobem e a ficha técnica
       vira célula por célula, como as plaquinhas de um placar */
    var cin = $(".phero.cin");
    if (cin) {
      var bgi = $(".cin-bg img", cin), gh = $(".cin-ghost", cin), rw = $$(".cin-row > *", cin), cells = $$(".cin-data > div", cin);
      if (bgi) tl.from(bgi, { scale: 1.25, opacity: 0, duration: 2.4, ease: "expo.out" }, 0);
      if (gh) tl.from(gh, { opacity: 0, xPercent: 16, duration: 2.2, ease: "expo.out" }, 0.4);
      if (rw.length) tl.from(rw, { y: 24, opacity: 0, duration: 1.1, stagger: 0.07, ease: "power3.out" }, 0.75);
      if (cells.length) tl.from(cells, { rotationX: -92, opacity: 0, transformOrigin: "50% 0%", duration: 1.4, stagger: 0.1, ease: "expo.out" }, 0.9);
    }
    $$(".phero [data-in-media]").forEach(function (m, i) {
      tl.from(m, { clipPath: "inset(100% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut" }, 0.1 + i * 0.12);
      var img = $("img", m); if (img) tl.from(img, { scale: 1.35, duration: 2, ease: "expo.out" }, 0.15 + i * 0.12);
    });
    var items = $$(".phero [data-in]");
    if (items.length) tl.from(items, { y: 26, opacity: 0, duration: 1.1, stagger: 0.08, ease: "power3.out" }, 0.4);
    if ($(".phero-kanji")) tl.from(".phero-kanji", { opacity: 0, y: 40, duration: 1.4 }, 0.7);
    tl.from(".nav-in", { y: -30, opacity: 0, duration: 1.1 }, 0.15);
    return tl;
  }

  var saveData = !!(navigator.connection && navigator.connection.saveData);

  /* ---------- selos ao vivo: a próxima aula e o atendimento, pela hora de quem está vendo ---------- */
  Site.nextClass = function () {
    var d = new Date(), wd = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
    var CL = [[8, "Adulto"], [10, "Kids"], [11, "Adulto"], [18, "Kids"], [19, "Adulto"]];
    if (wd >= 1 && wd <= 5) for (var i = 0; i < CL.length; i++) if (h < CL[i][0] + 1) {
      var now = h >= CL[i][0];
      return { now: now, label: now ? "Aula agora" : "Próxima aula", text: (now ? "" : "Hoje · ") + CL[i][1] + " " + CL[i][0] + "h" };
    }
    return { now: false, label: "Próxima aula", text: (wd === 5 || wd === 6 ? "Segunda" : "Amanhã") + " · Adulto 8h" };
  };
  Site.office = function () {
    var d = new Date(), wd = d.getDay(), h = d.getHours() + d.getMinutes() / 60, week = wd >= 1 && wd <= 5;
    if (week && h >= 8 && h < 21) return { open: true, label: "Aberto agora", text: "Atendimento até as 21h" };
    if (week && h < 8) return { open: false, label: "Fechado", text: "Abre hoje às 8h" };
    return { open: false, label: "Fechado", text: (wd >= 1 && wd <= 4) || wd === 0 ? "Abre amanhã às 8h" : "Abre segunda às 8h" };
  };
  /* só as pílulas de status: outras páginas usam data-next para outras coisas (ex.: a próxima faixa na Área do Professor) */
  $$(".pill-live[data-next]").forEach(function (el) {
    var n = Site.nextClass(), s = $("span", el), b = $("b", el);
    if (!s || !b) return;
    s.textContent = n.label; b.textContent = n.text;
    el.classList.toggle("hot", n.now);
  });
  $$(".pill-live[data-office]").forEach(function (el) {
    var o = Site.office(), s = $("span", el), b = $("b", el);
    if (!s || !b) return;
    s.textContent = o.label; b.textContent = o.text;
    el.classList.toggle("open", o.open); el.classList.toggle("closed", !o.open);
  });

  /* ---------- fitas cruzadas: aceleram com a rolagem e invertem o sentido quando a página sobe ---------- */
  function bandsFx(lenis) {
    var tracks = $$(".bands .mq-track").map(function (el) { return { el: el, dir: +el.dataset.dir || -1, x: 0, w: 0 }; });
    if (!tracks.length) return;
    var measure = function () { tracks.forEach(function (t) { t.w = t.el.children[0].offsetWidth; }); };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    var boost = 0, sgn = 1, lastY = window.scrollY;
    gsap.ticker.add(function (time, dt) {
      var v;
      if (lenis) v = lenis.velocity;
      else { v = (window.scrollY - lastY) / 2; lastY = window.scrollY; }
      if (Math.abs(v) > 0.6) sgn = v > 0 ? 1 : -1;
      boost += (Math.min(Math.abs(v) * 0.25, 5) - boost) * 0.06;
      var stepX = (0.8 + boost) * (dt / 16.67) * sgn;
      tracks.forEach(function (t) {
        if (!t.w) return;
        t.x += t.dir * stepX;
        if (t.x <= -t.w) t.x += t.w;
        if (t.x > 0) t.x -= t.w;
        t.el.style.transform = "translate3d(" + t.x + "px,0,0)";
      });
    });
  }

  /* rola até um elemento descontando a barra fixa: Lenis no computador, rolagem nativa no celular.
     cb (opcional) roda uma vez quando a rolagem termina; se nada avisar o fim, roda em 1,7 s */
  Site.scrollTo = function (target, offset, cb) {
    var el = typeof target === "string" ? $(target) : target, done = false;
    var end = function () { if (done) return; done = true; window.removeEventListener("scrollend", end); if (cb) cb(); };
    if (!el) { end(); return; }
    offset = offset === undefined ? -90 : offset;
    var top = el.getBoundingClientRect().top + window.scrollY + offset;
    if (Math.abs(top - window.scrollY) < 2) { end(); return; }
    if (cb) setTimeout(end, 1700);
    if (Site.lenis) { Site.lenis.scrollTo(el, { offset: offset, duration: 1.4, onComplete: end }); return; }
    if (cb && "onscrollend" in window) window.addEventListener("scrollend", end);
    window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
  };

  /* move o foco para el sem deixá-lo cair no body. Regra: quem esconde ou troca o elemento focado
     chama isto com o próximo lugar. Título, célula ou nota ganham tabindex=-1 (focáveis só pelo script).
     opts vai direto para focus() (ex.: { preventScroll: true }). Devolve true se o foco chegou lá:
     um elemento escondido ou dentro de [inert] não recebe foco, então tire o inert antes de chamar. */
  Site.focusSoft = function (el, opts) {
    el = typeof el === "string" ? $(el) : el;
    if (!el) return false;
    if (!el.matches("a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]")) el.setAttribute("tabindex", "-1");
    el.focus(opts);
    return document.activeElement === el;
  };

  /* animações sem fim (pulsos do celular, brilho da logo do rodapé) só rodam com o elemento na tela:
     .live liga e desliga a animação pelo CSS. Sem IntersectionObserver, ficam sempre ligadas */
  function liveFx() {
    var els = $$(".device, .foot-logo-wrap, [data-live]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("live"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("live", e.isIntersecting); });
    }, { rootMargin: "80px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }
  liveFx();

  /* WhatsApp: ícone redondo no celular; aparece depois da primeira tela e some perto do convite final,
     para nunca ficar por cima de um botão ou de um texto importante */
  function whatsapp() {
    var wa = $(".wa-float");
    if (!wa) return;
    var label = Array.prototype.slice.call(wa.childNodes).find(function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    if (label) { var s = document.createElement("span"); s.className = "wa-t"; s.textContent = label.textContent.trim(); wa.replaceChild(s, label); }
    wa.insertAdjacentHTML("beforeend", '<svg class="wa-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l1.2-3.6A7.9 7.9 0 1 1 8.4 18.6z"/><path d="M8.8 11.6h.01M12 11.6h.01M15.2 11.6h.01" stroke-width="2.6"/></svg>');
    root.classList.add("wa-js");
    var end = $(".cta") || $(".foot");
    var check = function () {
      var show = window.scrollY > window.innerHeight * 0.55;
      if (show && end && end.getBoundingClientRect().top < window.innerHeight * 0.9) show = false;
      wa.classList.toggle("on", show);
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
  }

  /* trilhos que deslizam para o lado no celular: as bolinhas mostram em qual cartão você está */
  function swipers() {
    $$("[data-swipe]").forEach(function (row) {
      var items = Array.prototype.slice.call(row.children);
      if (items.length < 2) return;
      var dots = document.createElement("div");
      dots.className = "swipe-dots"; dots.setAttribute("aria-hidden", "true");
      dots.innerHTML = items.map(function () { return "<i></i>"; }).join("");
      row.parentNode.insertBefore(dots, row.nextSibling);
      var paint = function () {
        dots.hidden = row.scrollWidth <= row.clientWidth + 4;
        if (dots.hidden) return;
        var step = (items[1].offsetLeft - items[0].offsetLeft) || 1;
        var i = Math.max(0, Math.min(items.length - 1, Math.round(row.scrollLeft / step)));
        Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle("on", k === i); });
      };
      row.addEventListener("scroll", paint, { passive: true });
      window.addEventListener("resize", paint);
      paint();
    });
  }

  /* vídeos: só baixam quando chegam perto da tela e pausam quando saem dela.
     data-ambient = vídeo de fundo (nunca mostra controles); data-eager = baixa logo, porque está na primeira tela */
  function videos() {
    $$("video[data-src]").forEach(function (v) {
      var ambient = v.hasAttribute("data-ambient");
      var load = function () { if (!v.getAttribute("src")) v.src = v.dataset.src; };
      if (reduce || saveData || !("IntersectionObserver" in window)) {
        v.preload = "none";
        if (!ambient) { v.controls = true; load(); }
        return;
      }
      if (v.hasAttribute("data-eager")) load();
      new IntersectionObserver(function (es, ob) { if (es[0].isIntersecting) { load(); ob.disconnect(); } }, { rootMargin: "700px 0px" }).observe(v);
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      }, { threshold: 0.12 }).observe(v);
    });
  }

  /* ---------- Inicialização com animação ---------- */
  Site.boot = function (opts) {
    opts = opts || {};
    var loader = $("#loader");
    toTop();
    window.addEventListener("load", toTop);
    whatsapp(); swipers(); videos();
    /* depois que a primeira tela carrega, as outras fotos já baixam em segundo plano:
       assim nenhuma caixa aparece vazia quando a pessoa rola rápido (exceto no modo de economia de dados) */
    if (!saveData) window.addEventListener("load", function () {
      setTimeout(function () { $$('img[loading="lazy"]').forEach(function (i) { i.decoding = "async"; i.loading = "eager"; }); }, 300);
    });
    if (reduce || !window.gsap || !window.ScrollTrigger) {
      root.classList.remove("entering", "entering-img");
      root.classList.add("intro-go");
      if (loader) loader.remove();
      $$("video[autoplay]").forEach(function (v) { if (reduce) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; } });
      if (opts.basic) opts.basic(Site);
      session("evo-seen", "1");
      return;
    }
    try {
      gsap.registerPlugin(ScrollTrigger);
      /* no celular a barra de endereço aparece e some ao rolar; isso não deve recalcular as animações */
      ScrollTrigger.config({ ignoreMobileResize: true });
      if (loader) loader.style.animation = "none";

      /* rolagem suave só com mouse e trackpad; no toque, a rolagem nativa do celular é mais leve e natural */
      var lenis = null;
      if (window.Lenis && fine) {
        /* uma tela que rola por dentro (as telas do celular simulado, ou [data-scroll-own]) recebe a roda
           enquanto ainda tem para onde rolar; no fim dela, a página volta a rolar suave */
        var ownScroll = function (v) {
          var t = v.event && v.event.target, dy = v.deltaY;
          var box = dy && t && t.closest ? t.closest(".ap-view, [data-scroll-own]") : null;
          if (!box || box.scrollHeight <= box.clientHeight + 1) return true;
          return !(dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0);
        };
        lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, virtualScroll: ownScroll });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
        Site.lenis = window.__lenis = lenis;
        toTop();
      }
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var id = a.getAttribute("href"); var t = id.length > 1 && document.getElementById(id.slice(1));
          if (!t) return; e.preventDefault();
          Site.scrollTo(t);
        });
      });

      /* navegação some ao descer e volta ao subir; barra de progresso */
      var onScroll = function (y, dir) { if (!nav) return; nav.classList.toggle("scrolled", y > 40); nav.classList.toggle("hide", dir === 1 && y > 500 && !menuOpen); };
      if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll, e.direction); });
      else { var ly = 0; window.addEventListener("scroll", function () { var y = window.scrollY; onScroll(y, y > ly ? 1 : -1); ly = y; }, { passive: true }); }
      if ($("#progressBar")) gsap.to("#progressBar", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      /* cortina entre páginas */
      var curtain = document.createElement("div");
      curtain.className = "curtain"; curtain.setAttribute("aria-hidden", "true");
      curtain.innerHTML = '<i class="tt"></i><span class="logo"></span><i class="tb"></i>';
      document.body.appendChild(curtain);
      gsap.set(curtain, { yPercent: 130 });
      Site.leave = function (url, img) {
        session("evo-nav", "1");
        if (menuOpen) setMenu(false);
        if (lenis) lenis.stop();
        /* saindo por um cartão com foto: a foto cresce até cobrir a tela e a próxima página começa nela */
        var frame = img && img.complete && img.naturalWidth ? img.parentElement : null;
        if (frame) {
          var r = frame.getBoundingClientRect(), src = img.currentSrc || img.src;
          var box = document.createElement("div");
          box.className = "vt-img"; box.innerHTML = '<img alt="">';
          box.firstChild.src = src;
          box.firstChild.style.objectPosition = getComputedStyle(img).objectPosition;
          gsap.set(box, { left: r.left, top: r.top, width: r.width, height: r.height });
          document.body.appendChild(box);
          session("evo-nav-img", src);
          gsap.timeline({ onComplete: function () { location.href = url; } })
            .to(box, { left: 0, top: 0, width: innerWidth, height: innerHeight, duration: 0.95, ease: "expo.inOut" })
            .fromTo(box.firstChild, { scale: 1.06 }, { scale: 1, duration: 0.95, ease: "expo.inOut" }, 0);
          return;
        }
        gsap.timeline({ onComplete: function () { location.href = url; } })
          .fromTo(curtain, { yPercent: 130, y: function () { return innerHeight * 0.2; } }, { yPercent: 0, y: 0, duration: 0.9, ease: "expo.inOut" })
          .fromTo($(".logo", curtain), { opacity: 0, backgroundPosition: "100% 0" }, { opacity: 1, backgroundPosition: "0% 0", duration: 0.9, ease: "power2.out" }, 0.45);
      };
      document.addEventListener("click", function (e) {
        var a = e.target.closest("a");
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
        var h = a.getAttribute("href") || "";
        if (!/^[\w-]+\.html(#[\w-]*)?$/.test(h)) return;
        e.preventDefault();
        var card = a.closest("[data-vt-card]");
        Site.leave(a.href, card ? $("img", card) : null);
      });
      window.addEventListener("pageshow", function (e) {
        if (!e.persisted) return;
        gsap.set(curtain, { yPercent: 130, y: 0 });
        $$(".vt-img").forEach(function (b) { b.remove(); });
        if (lenis) lenis.start();
      });

      /* abertura da página */
      var tl = (opts.intro || defaultIntro)(Site) || gsap.timeline({ paused: true });
      if (opts.setup) opts.setup(Site);
      shared(lenis);
      depthFx();
      pointerFx(lenis);
      bandsFx(lenis);

      /* a abertura só começa com a fonte de títulos pronta (ou depois de 1 s): se ela chega com o título
         já na tela, as linhas mudam de largura e a página salta (CLS). .intro-go mostra o topo das áreas do app */
      var fontsIn = document.fonts && document.fonts.load ?
        Promise.race([document.fonts.load('400 1em "Archivo Black"'), new Promise(function (r) { setTimeout(r, 1000); })]) : Promise.resolve();
      var go = function () { root.classList.add("intro-go"); tl.play(0); };
      var play = function () { fontsIn.then(go, go); };
      session("evo-seen", "1");
      if (loader && opts.loader && getComputedStyle(loader).display !== "none") {
        if (lenis) lenis.stop();
        opts.loader(function () { if (lenis) lenis.start(); ScrollTrigger.refresh(); play(); });
      } else {
        if (loader) loader.remove();
        if (root.classList.contains("entering-img")) {
          /* chegou por uma foto: ela cobre a tela e sobe, revelando a página */
          if (lenis) lenis.stop();
          var cover = document.createElement("div");
          cover.className = "enter-cover"; cover.setAttribute("aria-hidden", "true");
          document.body.appendChild(cover);
          root.classList.remove("entering", "entering-img");
          gsap.timeline({ delay: 0.15, onComplete: function () { cover.remove(); if (lenis) lenis.start(); } })
            .fromTo(cover, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.15, ease: "expo.inOut" })
            .add(play, 0.5);
        } else if (root.classList.contains("entering")) {
          if (lenis) lenis.stop();
          gsap.set(curtain, { yPercent: 0, y: 0 });
          gsap.set($(".logo", curtain), { opacity: 1, backgroundPosition: "0% 0" });
          root.classList.remove("entering");
          gsap.timeline({ delay: 0.12, onComplete: function () { gsap.set(curtain, { yPercent: 130, y: 0 }); if (lenis) lenis.start(); } })
            .to($(".logo", curtain), { opacity: 0, y: -30, duration: 0.45, ease: "power3.in" })
            .to(curtain, { yPercent: -100, y: function () { return -innerHeight * 0.2; }, duration: 1.1, ease: "expo.inOut" }, 0.2)
            .add(play, 0.75)
            .set($(".logo", curtain), { y: 0 });
        } else {
          play();
        }
      }
      window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    } catch (err) {
      root.classList.remove("entering", "entering-img");
      root.classList.add("intro-go");
      if (loader && loader.parentNode) loader.remove();
      if (window.gsap) gsap.set(".wi, .fw, .nav-in, [data-in], [data-in-media]", { clearProps: "all" });
      console.error(err);
    }
  };

  /* ---------- Profundidade 3D ----------
     [data-tilt] ou [data-tilt3d="graus"]: o cartão inclina na direção do mouse; as camadas [data-z] saem da
     superfície e [data-glare] acrescenta um brilho que acompanha a luz. No toque, [data-tilt-touch] muda o
     ângulo com a rolagem. Os kanjis gigantes ganham volume (o contorno repetido em camadas, uma atrás da outra)
     e giram com o mouse. [data-stand="graus"]: o bloco entra deitado e levanta do tatame com a rolagem. */
  function extrude(el, n, gap) {
    if (!el) return null;
    var done = $(".x3", el);
    if (done) return done;
    var txt = el.textContent.trim(), box = document.createElement("span");
    box.className = "x3";
    for (var i = 0; i < n; i++) {
      var l = document.createElement("i");
      l.textContent = txt;
      if (i) { l.style.transform = "translateZ(" + (-i * gap) + "px)"; l.style.opacity = (1 - (i / n) * 0.88).toFixed(2); }
      box.appendChild(l);
    }
    el.textContent = "";
    el.appendChild(box);
    el.classList.add("x3-host");
    return box;
  }
  Site.extrude = extrude;

  function depthFx() {
    $$(".hero-ghost, .cin-ghost, .sp-ghost").forEach(function (g) {
      var box = extrude(g, 6, 18);
      gsap.set(box, { rotationY: -18, rotationX: 5 });
      if (reduce) return;
      var sec = g.closest("section") || g.parentElement;
      if (fine) {
        var ry = gsap.quickTo(box, "rotationY", { duration: 1.8, ease: "power3" }), rx = gsap.quickTo(box, "rotationX", { duration: 1.8, ease: "power3" });
        sec.addEventListener("mousemove", function (e) { ry(-18 + (e.clientX / innerWidth - 0.5) * 64); rx(5 - (e.clientY / innerHeight - 0.5) * 30); });
      } else {
        gsap.to(box, { rotationY: 24, duration: 6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      }
    });

    $$("[data-tilt], [data-tilt3d]").forEach(function (t) {
      var max = parseFloat(t.getAttribute("data-tilt3d")) || 8;
      t.classList.add("d3");
      if (getComputedStyle(t).position === "static") t.style.position = "relative";
      $$("[data-z]", t).forEach(function (l) { gsap.set(l, { z: parseFloat(l.getAttribute("data-z")) || 0 }); });
      if (reduce) return;
      gsap.set(t, { transformPerspective: parseFloat(t.getAttribute("data-persp")) || 1000 });
      if (fine) {
        var gl = null;
        if (t.hasAttribute("data-glare")) { gl = document.createElement("i"); gl.className = "d3-glare"; gl.setAttribute("aria-hidden", "true"); t.appendChild(gl); }
        var rx = gsap.quickTo(t, "rotationX", { duration: 0.9, ease: "power3" }), ry = gsap.quickTo(t, "rotationY", { duration: 0.9, ease: "power3" });
        t.addEventListener("pointermove", function (e) {
          if (e.pointerType && e.pointerType !== "mouse") return;
          var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          ry((x - 0.5) * 2 * max); rx((0.5 - y) * 2 * max);
          if (gl) { t.style.setProperty("--gx", (x * 100).toFixed(1) + "%"); t.style.setProperty("--gy", (y * 100).toFixed(1) + "%"); }
          t.classList.add("d3-on");
        });
        t.addEventListener("pointerleave", function () { rx(0); ry(0); t.classList.remove("d3-on"); });
      } else if (t.hasAttribute("data-tilt-touch")) {
        gsap.fromTo(t, { rotationX: max }, { rotationX: -max * 0.7, ease: "none", scrollTrigger: { trigger: t, start: "top bottom", end: "bottom top", scrub: true } });
      }
    });

    if (!reduce) $$("[data-stand]").forEach(function (el) {
      var a = parseFloat(el.getAttribute("data-stand")) || 50;
      gsap.fromTo(el, { rotationX: a, y: 46, opacity: 0, transformPerspective: 1000, transformOrigin: "50% 100%" },
        { rotationX: 0, y: 0, opacity: 1, transformPerspective: 1000, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 98%", end: "top 66%", scrub: 0.6 } });
    });
  }

  /* trilhos que deslizam com o dedo: o cartão do centro fica de frente e os vizinhos viram de lado, em profundidade */
  Site.coverflow = function (row, max) {
    if (!row || reduce || fine) return;
    var cards = Array.prototype.slice.call(row.children), raf = 0;
    max = max || 26;
    var paint = function () {
      raf = 0;
      var live = row.scrollWidth > row.clientWidth + 2, rr = row.getBoundingClientRect(), cx = rr.left + rr.width / 2;
      cards.forEach(function (c) {
        if (!live) { gsap.set(c, { rotationY: 0, z: 0 }); return; }
        var r = c.getBoundingClientRect(), d = (r.left + r.width / 2 - cx) / (r.width || 1);
        d = Math.max(-1.3, Math.min(1.3, d));
        gsap.set(c, { rotationY: -d * max, z: -Math.abs(d) * 110, transformPerspective: 1000 });
      });
    };
    var ask = function () { if (!raf) raf = requestAnimationFrame(paint); };
    row.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    paint();
  };

  /* ---------- Com mouse: cursor, luz ambiente, brilho nos cartões e fotos que inclinam com a velocidade ---------- */
  var SPOT = ".vals li, .quiz, .features li, .sched-notes p, .space-card, .dgrid li, .diff-grid li, .gcard, .kpi, .funnel div, .bridge a, .numbers > div";
  function pointerFx(lenis) {
    if (!fine || reduce) return;
    var ring = document.createElement("div"), amb = document.createElement("div");
    ring.className = "cur is-off"; ring.setAttribute("aria-hidden", "true"); ring.innerHTML = '<div class="cur-ring"><b></b></div>';
    amb.className = "amb"; amb.setAttribute("aria-hidden", "true");
    document.body.appendChild(amb);
    document.body.appendChild(ring);
    var rEl = ring.firstChild, lab = rEl.firstChild, state = "";
    var rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
    var ax = gsap.quickTo(amb, "x", { duration: 1.8, ease: "power3" }), ay = gsap.quickTo(amb, "y", { duration: 1.8, ease: "power3" });
    window.addEventListener("mousemove", function (e) {
      rx(e.clientX); ry(e.clientY); ax(e.clientX); ay(e.clientY);
      ring.classList.remove("is-off");
      var t = e.target.closest ? e.target.closest("[data-cursor], a, button, select, input, textarea, label, [data-tilt]") : null;
      var next = !t ? "" : t.hasAttribute("data-cursor") ? "l:" + t.getAttribute("data-cursor") : t.matches("input, textarea, select") ? "off" : "link";
      if (next === state) return;
      state = next;
      rEl.classList.toggle("is-link", next === "link");
      rEl.classList.toggle("is-label", next.indexOf("l:") === 0);
      lab.textContent = next.indexOf("l:") === 0 ? next.slice(2) : "";
      ring.classList.toggle("is-off", next === "off");
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { ring.classList.add("is-off"); });
    window.addEventListener("mousedown", function () { ring.classList.add("is-down"); });
    window.addEventListener("mouseup", function () { ring.classList.remove("is-down"); });

    $$(SPOT).forEach(function (el) {
      el.classList.add("spot");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });

    /* quanto mais rápido a página rola, mais as fotos inclinam; parou, endireitam */
    if (lenis) {
      var sk = $$(".rimg, .ci, .team .tilt, [data-skew]").map(function (el) { return gsap.quickTo(el, "skewY", { duration: 0.8, ease: "power3" }); });
      if (sk.length) lenis.on("scroll", function (e) { var s = Math.max(-4, Math.min(4, e.velocity * 0.14)); sk.forEach(function (f) { f(s); }); });
    }
  }

  /* ---------- Animações comuns ---------- */
  function shared(lenis) {
    /* aberturas de cinema: a foto afunda devagar, o kanji sobe e as camadas reagem ao mouse */
    $$(".cin").forEach(function (h) {
      var ST = { trigger: h, start: "top top", end: "bottom top", scrub: true };
      var bg = $(".cin-bg", h), gh = $(".cin-ghost", h), tt = $(".phero-title", h), wr = $(".wrap", h);
      if (bg) gsap.to(bg, { yPercent: 9, scale: 1.08, ease: "none", scrollTrigger: ST });
      if (gh) gsap.to(gh, { yPercent: -16, ease: "none", scrollTrigger: ST });
      /* ao sair, o conteúdo tomba para trás, como se deitasse no tatame */
      if (wr) { gsap.set(wr, { transformPerspective: 1200, transformOrigin: "50% 100%" }); gsap.to(wr, { rotationX: 16, z: -110, ease: "none", scrollTrigger: ST }); }
      if (fine) {
        var bx = bg && gsap.quickTo(bg, "x", { duration: 1.4, ease: "power3" }), gx = gh && gsap.quickTo(gh, "x", { duration: 1.6, ease: "power3" }), tx = tt && gsap.quickTo(tt, "x", { duration: 1.6, ease: "power3" });
        /* o título gira em 3D: o contorno fica ao fundo e o ouro vem para a frente */
        var trx = tt && gsap.quickTo(tt, "rotationX", { duration: 1.6, ease: "power3" }), trY = tt && gsap.quickTo(tt, "rotationY", { duration: 1.6, ease: "power3" });
        h.addEventListener("mousemove", function (e) {
          var mx = e.clientX / innerWidth - 0.5, my = e.clientY / innerHeight - 0.5;
          if (bx) bx(mx * -22); if (gx) gx(mx * 34); if (tx) tx(mx * 12);
          if (trY) { trY(mx * 16); trx(-my * 9); }
        });
      }
    });
    /* títulos: as palavras sobem por trás de uma máscara, esticadas, e assentam */
    $$(".split").forEach(function (h) {
      var words = split(h, "words");
      if (inView(h, 0.9)) return;
      gsap.from(words, Object.assign({ duration: 1.25, ease: "expo.out", stagger: 0.05, scrollTrigger: { trigger: h, start: "top 88%", once: true } }, PUNCH));
    });
    $$(".label").forEach(function (l) {
      if (l.closest(".hero, .phero") || inView(l)) return;
      gsap.from(l, { x: -24, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: l, start: "top 92%", once: true, onEnter: function () { scramble(l); } } });
    });
    /* palavras que escurecem com a leitura */
    $$("[data-fadewords]").forEach(function (p) {
      gsap.fromTo(split(p, "fade"), { opacity: 0.14 }, { opacity: 1, stagger: 0.08, ease: "none", scrollTrigger: { trigger: p, start: "top 80%", end: "bottom 45%", scrub: true } });
    });
    /* listas e grades que sobem em sequência */
    $$("[data-rise]").forEach(function (box) {
      var kids = Array.prototype.slice.call(box.children);
      if (inView(box, 0.95)) return;
      gsap.from(kids, { y: 50, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: box, start: "top 88%", once: true } });
    });
    /* parallax (mais contido em tela pequena, onde as fotos ficam empilhadas) */
    var depth = window.innerWidth < 760 ? 0.35 : 1;
    $$("[data-speed]").forEach(function (el) {
      var s = (parseFloat(el.dataset.speed) || 0) * depth; if (!s) return;
      gsap.fromTo(el, { y: -s * 160 }, { y: s * 160, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    /* fotos que se abrem e assentam */
    $$("[data-reveal]").forEach(function (box) {
      gsap.fromTo(box, { clipPath: "inset(12% 8% 12% 8%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: box, start: "top 98%", end: "top 62%", scrub: true } });
      var img = $("img", box);
      if (img) gsap.fromTo(img, { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom 30%", scrub: true } });
    });
    $$("[data-drift] img, .cta-photo img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    /* convite final: o cartão se abre até a borda */
    $$(".cta-inner").forEach(function (c) {
      gsap.fromTo(c, { clipPath: "inset(7% 4% 7% 4% round 36px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: c.parentElement, start: "top bottom", end: "top 10%", scrub: true } });
    });
    /* rodapé: a logo gigante sobe */
    if ($("#footLogo")) gsap.fromTo("#footLogo", { clipPath: "inset(100% 0% 0% 0%)", yPercent: 30 }, { clipPath: "inset(0% 0% 0% 0%)", yPercent: 0, ease: "none", scrollTrigger: { trigger: ".foot-logo-wrap", start: "top bottom", end: "bottom bottom", scrub: true } });
    /* botões magnéticos */
    if (fine) $$("[data-magnetic]").forEach(function (b) {
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.6, ease: "power3.out" });
      });
      b.addEventListener("mouseleave", function () { gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: "expo.out" }); });
    });
  }
})();

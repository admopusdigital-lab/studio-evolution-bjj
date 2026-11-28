/* Painel · material: o que o estilo (painel-material.css) não faz sozinho.
   1) a aula no tatame: a turma em aula agora (ou a que começa em até 1 hora) dá a cor da luz do fundo e aparece
      num indicador no topo, visível de qualquer área; um toque leva ao Hoje;
   2) a lente do menu lateral (e a da barra do celular) desliza até a área escolhida;
   3) ao rolar, o topo ganha a borda que dissolve e, no celular, a barra recolhe (para baixo) ou volta (para cima).
   Nada aqui é necessário para usar o painel. */
(function () {
  "use strict";
  var raiz = document.documentElement, topo = document.querySelector(".pn-top"), menu = document.querySelector(".dash-side");
  if (!topo || !menu || !window.Site) return;
  var parado = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DUR = 60;   /* minutos de cada aula, como no resto do sistema */
  var CHAVE = { "Adulto": "adulto", "Kids 1": "kids1", "Kids 2": "kids2", "Open Mat": "open" };

  /* ---------- 1) a aula no tatame ---------- */
  var chip = document.createElement("button");
  chip.type = "button"; chip.className = "pn-agora"; chip.hidden = true;
  chip.innerHTML = '<i aria-hidden="true"></i><span></span>';
  var rotulo = topo.querySelector(".pn-t");
  (rotulo || topo.firstChild).insertAdjacentElement("afterend", chip);
  chip.addEventListener("click", function () { if (window.P && P.go) P.go("hoje", true); });

  function aula() {
    var agora = new Date(), t = agora.getTime(), melhor = null;
    Site.aulasDo(agora.getDay()).forEach(function (c) {
      var p = c.t.split(":"), ini = new Date(agora); ini.setHours(+p[0], +p[1], 0, 0);
      var i = ini.getTime(), f = i + DUR * 60000;
      if (t >= i && t < f) { if (!melhor || melhor.estado !== "sim") melhor = { c: c, estado: "sim", falta: 0 }; }
      else if (i > t && i - t <= 60 * 60000 && (!melhor || (melhor.estado === "logo" && i - t < melhor.falta))) melhor = { c: c, estado: "logo", falta: i - t };
    });
    return melhor;
  }
  function pintaAula() {
    var a = aula();
    if (!a) { raiz.removeAttribute("data-turma"); raiz.removeAttribute("data-agora"); chip.hidden = true; return; }
    raiz.setAttribute("data-turma", CHAVE[a.c.n] || "adulto");
    raiz.setAttribute("data-agora", a.estado);
    var min = Math.max(1, Math.round(a.falta / 60000));
    chip.querySelector("span").textContent = a.estado === "sim" ? "No tatame: " + a.c.n + " · " + Site.hora(a.c.t) : "Em " + min + " min: " + a.c.n + " · " + Site.hora(a.c.t);
    chip.setAttribute("aria-label", (a.estado === "sim" ? "Aula no tatame agora: " : "Próxima aula em " + min + " minutos: ") + a.c.n + ", " + Site.hora(a.c.t) + ". Abrir o Hoje");
    chip.hidden = false;
  }
  pintaAula();
  setInterval(pintaAula, 30000);
  document.addEventListener("evo-grade", pintaAula);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) pintaAula(); });

  /* ---------- 2) as lentes ---------- */
  function lente(caixa, classe, eixo, folga, botoes) {
    var l = document.createElement("span");
    l.className = classe; l.setAttribute("aria-hidden", "true");
    caixa.insertBefore(l, caixa.firstChild);
    function poe() {
      var b = caixa.querySelector(botoes + '[aria-current="true"]');
      if (!b || b.hidden || !b.offsetParent || b.classList.contains("pn-dock-go")) { caixa.style.setProperty("--lo", "0"); return; }
      if (eixo === "y") { caixa.style.setProperty("--ly", b.offsetTop + "px"); caixa.style.setProperty("--lh", b.offsetHeight + "px"); }
      else { caixa.style.setProperty("--lx", (b.offsetLeft + folga) + "px"); caixa.style.setProperty("--lw", Math.max(0, b.offsetWidth - folga * 2) + "px"); }
      caixa.style.setProperty("--lo", "1");
    }
    new MutationObserver(poe).observe(caixa, { subtree: true, attributes: true, attributeFilter: ["aria-current", "hidden"] });
    window.addEventListener("resize", poe);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(poe);
    l.style.transition = "none"; poe();
    requestAnimationFrame(function () { requestAnimationFrame(function () { l.style.transition = ""; }); });
    return poe;
  }
  lente(menu, "dash-lente", "y", 0, "button");
  var dock = document.querySelector(".pn-dock");
  if (dock) lente(dock, "pn-dock-lente", "x", 5, "button");

  /* ---------- 3) rolagem ---------- */
  var ult = window.scrollY || 0, marcado = false;
  window.addEventListener("scroll", function () {
    if (marcado) return;
    marcado = true;
    requestAnimationFrame(function () {
      marcado = false;
      var y = window.scrollY || 0, fim = document.documentElement.scrollHeight - window.innerHeight;
      raiz.classList.toggle("pr-rolou", y > 6);
      if (dock && !parado) {
        if (y < 40 || y > fim - 24 || y < ult - 5) dock.classList.remove("mini");
        else if (y > ult + 5) dock.classList.add("mini");
      }
      ult = y;
    });
  }, { passive: true });
  if (dock) dock.addEventListener("click", function () { dock.classList.remove("mini"); }, true);
})();

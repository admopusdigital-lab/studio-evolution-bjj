/* App · material: os três comportamentos que o estilo (app-material.css) não faz sozinho.
   1) a lente da barra de baixo anda até a aba escolhida;
   2) ao rolar, o topo do conteúdo passa a dissolver e a barra recolhe (rolando para baixo) ou volta (para cima);
   3) um toque curto de vibração ao trocar de aba, onde o aparelho tem (Android).
   Nada aqui é necessário para usar o app: sem este arquivo, a barra fica parada e o destaque não desliza. */
(function () {
  "use strict";
  var ap = document.getElementById("ap"), dock = document.getElementById("apDock");
  if (!ap || !dock) return;
  var views = ap.querySelector(".ap-views");
  var parado = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- a lente ---------- */
  var lente = document.createElement("span");
  lente.className = "ap-dock-lente"; lente.setAttribute("aria-hidden", "true");
  dock.insertBefore(lente, dock.firstChild);
  function poeLente() {
    var b = dock.querySelector('button[aria-current="true"]');
    /* a aba do meio (a moeda) tem o próprio destaque: ali a lente some */
    if (!b || b.classList.contains("ap-dock-go")) { dock.style.setProperty("--lo", "0"); return; }
    var folga = 8;
    dock.style.setProperty("--lw", Math.max(0, b.offsetWidth - folga * 2) + "px");
    dock.style.setProperty("--lx", (b.offsetLeft + folga) + "px");
    dock.style.setProperty("--lo", "1");
  }
  /* a aba muda por vários caminhos (toque, sino, link de aviso): observar o atributo pega todos */
  new MutationObserver(poeLente).observe(dock, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
  window.addEventListener("resize", poeLente);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(poeLente);
  /* primeira posição sem animar (a lente não "chega voando" na abertura) */
  lente.style.transition = "none"; poeLente();
  requestAnimationFrame(function () { requestAnimationFrame(function () { lente.style.transition = ""; }); });

  /* ---------- rolagem: borda que dissolve e barra que recolhe ---------- */
  var ult = new WeakMap(), marcado = false;
  function aoRolar(e) {
    var v = e.target;
    if (!v || !v.classList || !v.classList.contains("ap-view")) return;
    if (marcado) return;
    marcado = true;
    requestAnimationFrame(function () {
      marcado = false;
      var y = v.scrollTop, antes = ult.get(v) || 0, fim = v.scrollHeight - v.clientHeight;
      v.classList.toggle("rolou", y > 6);
      if (!parado) {
        if (y < 40 || y > fim - 24 || y < antes - 5) dock.classList.remove("mini");
        else if (y > antes + 5) dock.classList.add("mini");
      }
      ult.set(v, y);
    });
  }
  if (views) views.addEventListener("scroll", aoRolar, { capture: true, passive: true });
  /* trocar de aba devolve a barra inteira */
  dock.addEventListener("click", function (e) {
    dock.classList.remove("mini");
    var b = e.target.closest && e.target.closest("button");
    if (b && b.getAttribute("aria-current") !== "true" && navigator.vibrate && !parado) { try { navigator.vibrate(6); } catch (x) {} }
  }, true);
})();

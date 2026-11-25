/* Painel · celular: no lugar da faixa de abas que corria para o lado (e cortava), uma barra embaixo com
   Hoje, Alunos, o botão dourado da Chamada, Financeiro e Mais (as outras abas numa folha). Só aparece até 860 px.
   Respeita as áreas liberadas para cada pessoa da equipe: o que está escondido no menu lateral some aqui também. */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var side = $(".dash-side");
  if (!side) return;
  var FIXOS = ["hoje", "alunos", "fin"];
  var ICONE = function (go) { var b = $('button[data-go="' + go + '"] use', side); return b ? b.getAttribute("href") : "#i-home"; };
  var NOME = function (go) { var b = $('button[data-go="' + go + '"]', side); return b ? b.childNodes[1] ? b.textContent.replace(/\d+$/, "").trim() : go : go; };

  var dock = document.createElement("nav");
  dock.className = "pn-dock";
  dock.setAttribute("aria-label", "Menu do painel no celular");
  dock.innerHTML =
    btn("hoje", "Hoje") + btn("alunos", "Alunos") +
    '<button type="button" class="pn-dock-go" data-cham><span class="coin"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-check"/></svg></span>Chamada</button>' +
    btn("fin", "Financeiro") +
    '<button type="button" data-mais aria-expanded="false" aria-controls="pnMais"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-menu"/></svg>Mais</button>';
  function btn(go, tx) {
    return '<button type="button" data-dock="' + go + '"><svg class="ic" aria-hidden="true" focusable="false"><use href="' + ICONE(go) + '"/></svg>' + tx + '<span class="badge" hidden></span></button>';
  }
  var folha = document.createElement("div");
  folha.className = "pn-mais";
  folha.id = "pnMais";
  folha.hidden = true;
  folha.setAttribute("role", "dialog");
  folha.setAttribute("aria-label", "Outras áreas do painel");
  document.body.appendChild(folha);
  document.body.appendChild(dock);
  document.documentElement.classList.add("tem-dock");

  function visiveis() { return $$("button[data-go]", side).filter(function (b) { return !b.hidden && getComputedStyle(b).display !== "none"; }); }
  function pinta() {
    var ok = {};
    visiveis().forEach(function (b) { ok[b.dataset.go] = b; });
    $$("[data-dock]", dock).forEach(function (b) {
      var s = ok[b.dataset.dock];
      b.hidden = !s;
      b.setAttribute("aria-current", s && s.getAttribute("aria-current") === "true" ? "true" : "false");
      var bs = s && $(".badge", s), bd = $(".badge", b);
      bd.hidden = !bs || bs.hidden; bd.textContent = bs ? bs.textContent : "";
    });
    $("[data-cham]", dock).hidden = !ok.hoje;
    var outros = visiveis().filter(function (b) { return FIXOS.indexOf(b.dataset.go) < 0; });
    var naMais = outros.some(function (b) { return b.getAttribute("aria-current") === "true"; });
    $("[data-mais]", dock).setAttribute("aria-current", naMais ? "true" : "false");
    $("[data-mais]", dock).hidden = !outros.length;
    folha.innerHTML = '<ul>' + outros.map(function (b) {
      var bd = $(".badge", b);
      return '<li><button type="button" data-ir="' + b.dataset.go + '"' + (b.getAttribute("aria-current") === "true" ? ' aria-current="true"' : "") + '><svg class="ic" aria-hidden="true" focusable="false"><use href="' + ICONE(b.dataset.go) + '"/></svg>' +
        esc(b.textContent.replace(/\s*\d+\s*$/, "").trim()) + (bd && !bd.hidden ? '<span class="badge">' + esc(bd.textContent) + "</span>" : "") + "</button></li>";
    }).join("") + "</ul>";
  }
  function fechaMais() { folha.hidden = true; $("[data-mais]", dock).setAttribute("aria-expanded", "false"); }
  dock.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-mais")) {
      var abre = folha.hidden;
      folha.hidden = !abre;
      b.setAttribute("aria-expanded", abre ? "true" : "false");
      if (abre) { var f = $("button", folha); if (f) f.focus(); }
      return;
    }
    fechaMais();
    if (b.hasAttribute("data-cham")) {
      /* a chamada da aula do momento, na tela Hoje */
      P.go("hoje");
      setTimeout(function () { var r = $(".cham-h") || $("#room"); if (r) r.scrollIntoView({ block: "start", behavior: Site.reduce ? "auto" : "smooth" }); }, 250);
      return;
    }
    P.go(b.dataset.dock);
  });
  folha.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-ir]");
    if (!b) return;
    fechaMais();
    P.go(b.dataset.ir, true);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !folha.hidden) { fechaMais(); $("[data-mais]", dock).focus(); } });
  document.addEventListener("click", function (e) { if (!folha.hidden && !folha.contains(e.target) && !dock.contains(e.target)) fechaMais(); });
  /* o menu lateral é a fonte: aba atual, permissões e números mudam lá e a barra acompanha */
  new MutationObserver(function () { pinta(); }).observe(side, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-current", "hidden"] });
  pinta();
})();

/* Painel · Primeiros passos: enquanto o Studio coloca o sistema para rodar, o Hoje mostra o que falta
   (grade, alunos, chave Pix, mensalidades do mês, primeiro movimento e primeira chamada). Cada passo se marca
   sozinho quando o dado aparece no banco; a lista some quando tudo está feito ou quando o professor esconde.
   Só para o dono do painel (a equipe não vê). */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var hoje = $('.dv[data-v="hoje"]'), hj = hoje && $(".hj", hoje);
  if (!hj) return;
  var box = document.createElement("section");
  box.className = "ps";
  box.id = "hPassos";
  box.hidden = true;
  box.setAttribute("aria-labelledby", "psT");
  /* embaixo da chamada: a aula do momento continua sendo a primeira coisa do Hoje */
  hj.parentNode.insertBefore(box, hj.nextSibling);
  var FIM = "evo-passos-fim";
  function escondido() { try { return localStorage.getItem(FIM) === "1"; } catch (e) { return false; } }

  var PASSOS = [
    { k: "grade", t: "Conferir a grade de aulas", d: "Os horários aparecem no site, no agendamento e no app.", bt: "Abrir a grade", ir: function () { P.go("config"); if (P.abaCfg) P.abaCfg("aulas"); } },
    { k: "alunos", t: "Cadastrar os alunos", d: "Cada aluno recebe o acesso ao app.", bt: "Ir para Alunos", ir: function () { P.go("alunos"); } },
    { k: "pix", t: "Pôr a chave Pix do Studio", d: "Ela vai junto na mensagem de cobrança.", bt: "Pôr a chave", ir: function () { P.go("config"); if (P.abaCfg) P.abaCfg("studio"); } },
    { k: "mens", t: "Lançar as mensalidades do mês", d: "Para o Financeiro mostrar quem pagou e quem falta.", bt: "Ir para o Financeiro", ir: function () { P.go("fin"); } },
    { k: "mov", t: "Publicar o primeiro movimento", d: "Um vídeo com quiz na biblioteca da faixa.", bt: "Ir para Movimentos", ir: function () { P.go("mov"); } },
    { k: "pres", t: "Fazer a primeira chamada", d: "Mostre o QR da TV ou marque a presença aqui no Hoje.", bt: "Ir para a chamada", ir: function () { var r = $("#room"); if (r) r.scrollIntoView({ block: "start", behavior: Site.reduce ? "auto" : "smooth" }); } }
  ];
  var feito = {};

  function conferir() {
    if (escondido() || !(P.ehDono && P.ehDono())) { box.hidden = true; return Promise.resolve(); }
    var mes = P.mesIni(P.hoje());
    feito.alunos = P.alunosDeVerdade().length > 0;
    feito.pres = (P.pres || []).length > 0;
    return Promise.all([
      P.q(function (sb) { return sb.from("configuracoes").select("chave, valor").in("chave", ["grade", "studio"]); }).catch(function () { return []; }),
      P.q(function (sb) { return sb.from("mensalidades").select("id").eq("competencia", mes).limit(1); }).catch(function () { return []; }),
      P.q(function (sb) { return sb.from("movimentos").select("id").eq("publicado", true).limit(1); }).catch(function () { return []; })
    ]).then(function (r) {
      var cfg = {};
      (r[0] || []).forEach(function (x) { cfg[x.chave] = x.valor; });
      feito.grade = !!cfg.grade;
      feito.pix = !!(cfg.studio && cfg.studio.pix);
      feito.mens = (r[1] || []).length > 0;
      feito.mov = (r[2] || []).length > 0;
      paint();
    });
  }
  function paint() {
    var n = PASSOS.filter(function (p) { return feito[p.k]; }).length;
    box.hidden = n === PASSOS.length || escondido();
    if (box.hidden) return;
    var prox = PASSOS.filter(function (p) { return !feito[p.k]; })[0];
    box.innerHTML = '<div class="ps-h"><div><p class="fin-k" id="psT">Primeiros passos</p><p class="ps-sub">' + n + " de " + PASSOS.length + " prontos para o Studio rodar no sistema</p></div>" +
      '<span class="ps-bar" aria-hidden="true"><i style="width:' + Math.round(n / PASSOS.length * 100) + '%"></i></span>' +
      '<button class="mini-btn ghost" type="button" data-ps-fim>Esconder</button></div>' +
      '<ol class="ps-l">' + PASSOS.map(function (p) {
        var ok = !!feito[p.k];
        return '<li class="' + (ok ? "ok" : p === prox ? "agora" : "") + '"><span class="ps-mk" aria-hidden="true">' + (ok ? '<svg class="ic"><use href="#i-check"/></svg>' : "") + "</span>" +
          "<div><b>" + esc(p.t) + (ok ? '<span class="sr-only"> · feito</span>' : "") + "</b><small>" + esc(p.d) + "</small></div>" +
          (ok ? "" : '<button class="mini-btn' + (p === prox ? "" : " ghost") + '" type="button" data-ps="' + p.k + '">' + esc(p.bt) + "</button>") + "</li>";
      }).join("") + "</ol>";
  }
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-ps-fim")) {
      try { localStorage.setItem(FIM, "1"); } catch (er) {}
      box.hidden = true;
      P.toast("Primeiros passos escondidos. Tudo continua nas abas do painel.");
      return;
    }
    var p = PASSOS.filter(function (x) { return x.k === b.dataset.ps; })[0];
    if (p) p.ir();
  });
  P.aoAbrir("hoje", function () { conferir().catch(function () {}); });
  window.addEventListener("load", function () { setTimeout(function () { if (P.atual && P.atual() === "hoje") conferir().catch(function () {}); }, 1800); });
})();

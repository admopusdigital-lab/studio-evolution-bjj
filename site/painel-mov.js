/* Painel · Movimentos (movimentos.js: vídeo, pontos-chave e quiz por faixa) e Configurações (dados do Studio e
   o estado das integrações). */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc, focusSoft = P.focusSoft;
  var BC = { branca: "oklch(0.96 0.004 90)", cinza: "oklch(0.66 0.012 260)", amarela: "oklch(0.85 0.15 95)", laranja: "oklch(0.72 0.16 55)", verde: "oklch(0.58 0.13 150)", azul: "oklch(0.55 0.17 258)", roxa: "oklch(0.45 0.15 305)", marrom: "oklch(0.42 0.07 50)", preta: "oklch(0.2 0.006 285)" };

  /* ---------- Movimentos ---------- */
  var MV = [], mvF = "todas", mvEdit = null, mvEst = {}, mvForm = $("#mvForm"), mvAdd = $("#mvAdd");
  function mvFaixa(f) { return '<span class="fx"><i style="background:' + BC[f] + '"></i>Faixa ' + Mov.FAIXAS[f].toLowerCase() + "</span>"; }
  function mvCapa(m) { return m.video && m.video.poster ? m.video.poster : m.video && m.video.tipo === "youtube" ? "https://i.ytimg.com/vi/" + m.video.ref + "/mqdefault.jpg" : ""; }
  function mvCarregar() {
    return Mov.lista({ todos: true }).then(function (l) {
      MV = l;
      return Promise.all(l.map(function (m) { return Mov.estudaram(m.id).catch(function () { return []; }); }));
    }).then(function (est) { mvEst = {}; est.forEach(function (n, i) { mvEst[MV[i].id] = n; }); mvPaint(); });
  }
  function mvPaint() {
    var pub = MV.filter(function (m) { return m.publicado; });
    $("#mvK1").textContent = pub.length;
    $("#mvK2").textContent = pub.filter(function (m) { return m.video; }).length;
    $("#mvK3").textContent = pub.filter(function (m) { return !m.video; }).length;
    $("#mvK4").textContent = Object.keys(mvEst).reduce(function (a, k) { return a + mvEst[k].length; }, 0);
    var fx = Mov.ORDEM.filter(function (f) { return MV.some(function (m) { return m.faixa === f; }); });
    if (mvF !== "todas" && fx.indexOf(mvF) < 0) mvF = "todas";
    $("#mvF").innerHTML = ["todas"].concat(fx).map(function (f) { return '<button type="button" data-f="' + f + '" aria-pressed="' + (f === mvF) + '">' + (f === "todas" ? "Todas" : Mov.FAIXAS[f]) + "</button>"; }).join("");
    var q = P.norm($("#mvQ").value.trim()), vis = MV.filter(function (m) { return (mvF === "todas" || m.faixa === mvF) && (!q || P.norm(m.nome).indexOf(q) >= 0); });
    $("#mvList").innerHTML = vis.map(function (m) {
      var c = mvCapa(m), n = (mvEst[m.id] || []).length;
      return '<li class="mv" data-id="' + m.id + '"><span class="mv-th">' + (c ? '<img src="' + c + '" alt="">' : '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"/></svg>') + "</span>" +
        "<div><b>" + esc(m.nome) + '</b><span class="mv-tags">' + mvFaixa(m.faixa) + '<span class="pill-s">' + Mov.CATS[m.cat] + "</span>" +
        (!m.video ? '<span class="pill-s gold">Esperando vídeo</span>' : '<span class="pill-s in">' + (m.video.tipo === "youtube" ? "YouTube" : "Vídeo") + "</span>") +
        '<span class="pill-s">' + (m.quiz.length ? "Quiz: " + m.quiz.length + (m.quiz.length === 1 ? " pergunta" : " perguntas") : "Sem quiz") + "</span>" +
        (m.publicado ? "" : '<span class="pill-s warn">Rascunho</span>') + "</span>" +
        "<small>" + (n ? "Estudaram: " + n + (n === 1 ? " aluno" : " alunos") : "Ninguém fez o quiz ainda") + "</small></div>" +
        '<div class="acts">' + (n ? '<button class="mini-btn ghost" type="button" data-mv-who aria-expanded="false">Quem estudou</button>' : "") +
        '<button class="mini-btn" type="button" data-mv-edit aria-label="Editar ' + esc(m.nome) + '">Editar</button></div>' +
        '<div class="mv-who" hidden><ul>' + (mvEst[m.id] || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></li>";
    }).join("");
    $$("#mvList img").forEach(function (im) { im.onerror = function () { im.hidden = true; }; });
    var e = $("#mvEmpty");
    e.hidden = vis.length > 0;
    e.textContent = q ? "Nenhum movimento com “" + $("#mvQ").value.trim() + "”." : MV.length ? "Nenhum movimento nesta faixa ainda." : "Nenhum movimento cadastrado ainda. Toque em Adicionar movimento: o vídeo pode ser um link do YouTube (não listado).";
  }
  $("#mvF").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; mvF = b.dataset.f; mvPaint(); });
  $("#mvQ").addEventListener("input", mvPaint);
  $("#mvList").addEventListener("click", function (e) {
    var b = e.target.closest("button"), li = b && b.closest(".mv");
    if (!b || !li) return;
    var m = MV.filter(function (x) { return x.id === li.dataset.id; })[0];
    if (b.hasAttribute("data-mv-who")) { var w = $(".mv-who", li), open = w.hidden; w.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); }
    else if (b.hasAttribute("data-mv-edit") && m) mvAbrir(m);
  });
  $("#mfFaixa").innerHTML = Mov.ORDEM.map(function (f) { return '<option value="' + f + '">' + Mov.FAIXAS[f] + "</option>"; }).join("");
  $("#mfCat").innerHTML = Object.keys(Mov.CATS).map(function (k) { return '<option value="' + k + '">' + Mov.CATS[k] + "</option>"; }).join("");
  function mfQ(i, d) {
    d = d || { q: "", a: ["", "", ""], r: -1, dica: "" };
    var L = "ABC";
    return '<fieldset class="mf-q"><legend>Pergunta ' + (i + 1) + "</legend>" +
      '<input class="crm-in" data-f="q" aria-label="Pergunta ' + (i + 1) + '" placeholder="A pergunta" value="' + esc(d.q) + '">' +
      [0, 1, 2].map(function (k) {
        return '<div class="mf-alt"><label class="mf-ok"><input type="radio" name="mfR' + i + '" value="' + k + '"' + (d.r === k ? " checked" : "") + ' aria-label="Alternativa ' + L[k] + ' é a certa"><span>certa</span></label>' +
          '<input class="crm-in" data-f="a' + k + '" aria-label="Pergunta ' + (i + 1) + ", alternativa " + L[k] + '" placeholder="Alternativa ' + L[k] + '" value="' + esc(d.a[k] || "") + '"></div>';
      }).join("") +
      '<input class="crm-in" data-f="dica" aria-label="Pergunta ' + (i + 1) + ', dica para quem errar" placeholder="Dica para quem errar (opcional)" value="' + esc(d.dica || "") + '">' +
      '<button class="mini-btn ghost" type="button" data-rmq>Remover pergunta</button></fieldset>';
  }
  function mfLer() {
    return $$(".mf-q", mvForm).map(function (fs) {
      var v = function (f) { return $('[data-f="' + f + '"]', fs).value.trim(); }, r = $("input[type=radio]:checked", fs);
      return { q: v("q"), a: [v("a0"), v("a1"), v("a2")], r: r ? +r.value : -1, dica: v("dica"), el: fs };
    });
  }
  function mfQs(lista) { $("#mfQs").innerHTML = lista.map(function (d, i) { return mfQ(i, d); }).join(""); $("#mfAddQ").hidden = lista.length >= 5; }
  function mfVinfo() {
    var t = $("#mfVideo").value.trim(), v = mvEdit && t === Mov.videoTexto(mvEdit.video) ? mvEdit.video : Mov.video(t), el = $("#mfVinfo");
    el.className = "mf-vinfo" + (v === false ? " bad" : v ? " ok" : "");
    el.textContent = v === false ? "Esse link não toca no app. Use um link do YouTube ou de um arquivo de vídeo (.mp4)."
      : !v ? "Sem vídeo: o movimento aparece no app como “em gravação”, e o quiz espera o vídeo."
      : v.tipo === "youtube" ? "YouTube · vídeo " + v.ref + ". Deixe o vídeo como Não listado no YouTube." : "Arquivo de vídeo.";
    return v;
  }
  $("#mfVideo").addEventListener("input", mfVinfo);
  function mfErro(el, msg) {
    $$("[aria-invalid]", mvForm).forEach(function (f) { f.removeAttribute("aria-invalid"); });
    $("#mfErr").textContent = msg;
    if (el) { el.setAttribute("aria-invalid", "true"); focusSoft(el, { preventScroll: false }); }
  }
  function mvAbrir(m) {
    mvEdit = m || null;
    $("#mvFormT").textContent = m ? "Editar movimento" : "Novo movimento";
    $("#mfNome").value = m ? m.nome : "";
    $("#mfFaixa").value = m ? m.faixa : (mvF !== "todas" ? mvF : "branca");
    $("#mfCat").value = m ? m.cat : "raspagem";
    $("#mfDur").value = m && m.video && m.video.dur ? m.video.dur : "";
    $("#mfVideo").value = m ? Mov.videoTexto(m.video) : "";
    $("#mfPontos").value = m ? m.pontos.join("\n") : "";
    $("#mfPub").checked = m ? m.publicado : true;
    mfQs(m && m.quiz.length ? m.quiz : [{ q: "", a: ["", "", ""], r: -1, dica: "" }]);
    $("#mfDel").hidden = !m;
    $("#mfDelAsk").hidden = true;
    mfErro(null, "");
    mfVinfo();
    mvAdd.setAttribute("aria-expanded", "true");
    mvForm.hidden = false;
    P.aparece(mvForm);
    mvForm.scrollIntoView({ block: "start", behavior: Site.reduce ? "auto" : "smooth" });
    focusSoft($("#mfNome"), { preventScroll: true });
  }
  function mvFechar(foco) { mvAdd.setAttribute("aria-expanded", "false"); mvForm.hidden = true; mvEdit = null; if (foco) focusSoft(foco); }
  mvAdd.addEventListener("click", function () { if (mvForm.hidden || mvEdit) mvAbrir(null); else mvFechar(mvAdd); });
  $("#mfCancel").addEventListener("click", function () { mvFechar(mvAdd); });
  mvForm.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); mvFechar(mvAdd); } });
  $("#mfAddQ").addEventListener("click", function () { var l = mfLer(); l.push({ q: "", a: ["", "", ""], r: -1, dica: "" }); mfQs(l); focusSoft($('.mf-q:last-of-type [data-f="q"]', mvForm)); });
  $("#mfQs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rmq]");
    if (!b) return;
    var l = mfLer(), i = l.map(function (x) { return x.el; }).indexOf(b.closest(".mf-q"));
    l.splice(i, 1);
    mfQs(l);
    focusSoft($("#mfAddQ").hidden ? $("#mfPub") : $("#mfAddQ"));
  });
  mvForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = $("#mfNome").value.trim().replace(/\s+/g, " "), dur = $("#mfDur").value.trim(), v = mfVinfo(), quiz = [], erro = null;
    if (nome.length < 2) return mfErro($("#mfNome"), "Digite o nome do movimento.");
    if (v === false) return mfErro($("#mfVideo"), "Esse link não toca no app. Use um link do YouTube ou de um arquivo de vídeo (.mp4).");
    if (dur && !/^\d{1,3}:[0-5]\d$/.test(dur)) return mfErro($("#mfDur"), "Duração em minutos e segundos, como 6:40.");
    mfLer().forEach(function (d, i) {
      if (erro || (!d.q && !d.a.join("") && !d.dica)) return;
      var fs = d.el, n = "Pergunta " + (i + 1) + ": ";
      if (!d.q) erro = [$('[data-f="q"]', fs), n + "escreva a pergunta."];
      else if (d.a.some(function (a) { return !a; })) erro = [$('[data-f="a' + d.a.map(function (a) { return !!a; }).indexOf(false) + '"]', fs), n + "preencha as 3 alternativas."];
      else if (d.r < 0) erro = [$("input[type=radio]", fs), n + "marque qual alternativa é a certa."];
      else quiz.push({ q: d.q, a: d.a, r: d.r, dica: d.dica });
    });
    if (erro) return mfErro(erro[0], erro[1]);
    if (v) { v = JSON.parse(JSON.stringify(v)); if (dur) v.dur = dur; else delete v.dur; }
    var pub = $("#mfPub").checked, m = {
      id: mvEdit ? mvEdit.id : undefined, nome: nome, faixa: $("#mfFaixa").value, cat: $("#mfCat").value, video: v || null,
      pontos: $("#mfPontos").value.split("\n").map(function (t) { return t.trim(); }).filter(Boolean), quiz: quiz, publicado: pub
    };
    var era = mvEdit;
    Mov.salvar(m).then(function (salvo) {
      mvFechar(null);
      if (mvF !== "todas" && mvF !== salvo.faixa) mvF = salvo.faixa;
      return mvCarregar().then(function () {
        var b = $('#mvList .mv[data-id="' + salvo.id + '"] [data-mv-edit]');
        if (b) focusSoft(b);
        var fx = "faixa " + Mov.FAIXAS[salvo.faixa].toLowerCase();
        P.toast(!pub ? "Rascunho salvo: os alunos ainda não veem “" + salvo.nome + "”."
          : (era ? "Movimento atualizado" : "Movimento salvo") + ": “" + salvo.nome + "” já aparece no app dos alunos da " + fx + "." + (salvo.video ? "" : " Sem vídeo, ele aparece como em gravação."));
      });
    }).catch(function () { mfErro(null, "Não deu para salvar agora. Confira a internet e tente de novo."); });
  });
  $("#mfDel").addEventListener("click", function () {
    $("#mfDelT").textContent = "Apagar “" + mvEdit.nome + "”? Os alunos deixam de ver o movimento e o progresso dele some.";
    $("#mfDelAsk").hidden = false;
    focusSoft($("#mfDelNo"));
  });
  $("#mfDelNo").addEventListener("click", function () { $("#mfDelAsk").hidden = true; focusSoft($("#mfDel")); });
  $("#mfDelYes").addEventListener("click", function () {
    var m = mvEdit;
    Mov.apagar(m.id).then(function () { mvFechar(null); return mvCarregar(); }).then(function () { P.toast("“" + m.nome + "” foi apagado."); });
  });
  P.aoAbrir("mov", function () { mvCarregar().catch(function (e) { P.erro(e, "Não deu para carregar os movimentos"); }); });

  /* ---------- Configurações ---------- */
  var CFG0 = { nome: "Studio Evolution BJJ", whatsapp: "15996741812", endereco: "Av. Getúlio Vargas, 400, sala 3, sobreloja · Jardim São Paulo, Sorocaba/SP · 18051-480", atendimento: "Segunda a sexta, das 8h às 21h", vagas: 10, pix: "" };
  P.cfg = Object.assign({}, CFG0);
  function carregarCfg() {
    return P.q(function (sb) { return sb.from("configuracoes").select("valor").eq("chave", "studio").maybeSingle(); }).then(function (r) {
      P.cfg = Object.assign({}, CFG0, r ? r.valor : {});
      return P.cfg;
    });
  }
  function card(t, st, txt) { return '<article class="cfg-card"><div class="cfg-top"><h4>' + t + "</h4>" + st + '</div><p class="cfg-what">' + txt + "</p></article>"; }
  function paintCfg() {
    var c = P.cfg, v = function (k) { return esc(c[k] == null ? "" : c[k]); };
    $("#cfgBox").innerHTML =
      '<h4 class="fin-k" style="margin-top:8px">Integrações</h4><div class="cfg-grid">' +
        card("Login e dados", '<span class="pill-s in">Ligado</span>', "Supabase: contas do app, alunos, presenças, mensalidades e o resto deste painel ficam no banco do Studio.") +
        card("Pedidos do site", '<span class="pill-s in">Ligado</span>', "Cada pedido de aula experimental feito no site entra em Interessados, com a turma, o dia e o horário.") +
        card("Cobrança automática", '<span class="pill-s">Não ligada</span>', "Boleto, Pix e cartão com baixa automática (Asaas). Por enquanto, a cobrança sai pelo seu WhatsApp, com a mensagem pronta, e você dá baixa em Mensalidades.") +
        card("WhatsApp de avisos", '<span class="pill-s">Não ligado</span>', "Lembretes automáticos de aula e de mensalidade por um número só de avisos (Evolution API). Por enquanto, as mensagens abrem no seu WhatsApp para você enviar.") +
      "</div>" +
      '<form class="crm-form" id="cfgForm" novalidate style="margin-top:22px"><p class="fin-k">Dados do Studio</p><div class="crm-grid">' +
        '<label class="crm-f"><span>Nome</span><input class="crm-in" id="cfNome" value="' + v("nome") + '"></label>' +
        '<label class="crm-f"><span>WhatsApp do Studio</span><input class="crm-in" id="cfFone" inputmode="tel" value="' + esc(P.fone(c.whatsapp)) + '"></label>' +
        '<label class="crm-f"><span>Chave Pix <small>(vai na mensagem de cobrança)</small></span><input class="crm-in" id="cfPix" value="' + v("pix") + '" autocomplete="off"></label>' +
        '<label class="crm-f"><span>Vagas por aula</span><input class="crm-in" id="cfVagas" inputmode="numeric" value="' + v("vagas") + '"></label>' +
        '<label class="crm-f wide"><span>Endereço</span><input class="crm-in" id="cfEnd" value="' + v("endereco") + '"></label>' +
        '<label class="crm-f wide"><span>Atendimento</span><input class="crm-in" id="cfAt" value="' + v("atendimento") + '"></label></div>' +
        '<p class="muted" style="font-size:12px;margin-top:8px">A grade de aulas (horários e turmas) fica no site; para mudar, fale com a OPUS. O limite de vagas no app é 10 por aula.</p>' +
        '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar dados</button></div></form>';
  }
  $("#cfgBox").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, fone = P.foneBanco($("#cfFone").value), vagas = parseInt(P.digitos($("#cfVagas").value), 10);
    if (!fone) return P.erroForm(f, $("#cfFone"), "Confira o WhatsApp: DDD e número.");
    var d = { nome: $("#cfNome").value.trim() || CFG0.nome, whatsapp: fone, pix: $("#cfPix").value.trim(), vagas: vagas > 0 ? vagas : 10, endereco: $("#cfEnd").value.trim(), atendimento: $("#cfAt").value.trim() };
    $('[type="submit"]', f).classList.add("loading");
    P.q(function (sb) { return sb.from("configuracoes").upsert({ chave: "studio", valor: d }); }).then(carregarCfg).then(function () { paintCfg(); P.toast("Dados do Studio salvos."); })
      .catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er); });
  });
  P.aoAbrir("config", function () { carregarCfg().then(paintCfg).catch(function (e) { paintCfg(); P.erro(e, "Não deu para carregar as configurações"); }); });
  window.addEventListener("load", function () { carregarCfg().catch(function () {}); });
})();

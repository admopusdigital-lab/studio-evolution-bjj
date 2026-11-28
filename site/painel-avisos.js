/* Painel · Avisos: o professor (ou a equipe) escreve um recado para um aluno, uma turma ou todos.
   Onde estiver {nome}, cada aluno lê o próprio primeiro nome. Quem ativou os avisos no app recebe a notificação
   no celular; quem não ativou vê o recado ao abrir o app (ele fica guardado em avisos).
   Quem envia e guarda é a função de servidor "push". O alcance de cada aluno vem de push_alcance(). */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var box = $("#recBox");
  if (!box) return;
  if (!Acesso.real) { box.innerHTML = '<p class="rec-vazio">Os avisos funcionam com o sistema do Studio ligado.</p>'; return; }

  var RAIZ = "https://raw.githubusercontent.com/admopusdigital-lab/studio-evolution-bjj/main/";
  var SQL_AVISOS = RAIZ + "supabase/atualizar-2026-11-29.sql", FUNCAO = RAIZ + "supabase/functions/push/index.ts";
  var TURMAS = [["adulto", "Adulto"], ["feminino", "Feminino"], ["kids1", "Kids 1"], ["kids2", "Kids 2"]];
  var TELAS = [["inicio", "Início"], ["presenca", "Agendar"], ["movimentos", "Movimentos"], ["perfil", "Perfil"]];
  var ROT = { todos: "todos os alunos", adulto: "Adulto", feminino: "Feminino", kids1: "Kids 1", kids2: "Kids 2" };
  var MODELOS = [
    ["Lembrete da aula", "Sua aula é hoje, {nome}", "Te esperamos no tatame. Marque a sua vaga pelo app.", "presenca"],
    ["Mensalidade", "Mensalidade do mês", "{nome}, a mensalidade vence nesta semana. Se já pagou, é só desconsiderar.", "inicio"],
    ["Parabéns pelo grau", "Parabéns, {nome}!", "Grau novo na faixa. O Studio inteiro comemora com você. Oss!", "perfil"],
    ["Sentimos sua falta", "Sentimos sua falta, {nome}", "Faz um tempo que você não treina. Que tal voltar nesta semana? Sua vaga está te esperando.", "presenca"]
  ];
  var MAX_T = 60, MAX_C = 240, MAX_ALUNOS = 200;
  /* o que está sendo escrito */
  var E = { modo: "todos", turma: "adulto", ids: {}, busca: "", tela: "inicio", confirma: false };
  /* o que veio do servidor */
  var ALC = null;          /* { id do aluno: aparelhos com aviso ativo }; null enquanto não se sabe */
  var semBanco = false;    /* falta o SQL de 29/11 (tabela avisos ou a função push_alcance) */
  var funcao = "";         /* "" ainda não conferida · "ok" · "velha" · "falta" */
  var enviando = false, montado = false;

  /* o primeiro nome como a pessoa lê (igual à função do servidor): "ana" ou "ANA" no cadastro vira "Ana" */
  function primeiro(n) {
    var p = String(n || "").trim().split(/\s+/)[0] || "";
    return p && (p === p.toLowerCase() || p === p.toUpperCase()) ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p;
  }
  function comNome(t, nome) { return String(t).split("{nome}").join(nome); }
  function todos() { return P.ativos().slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }); }
  function alvo() {
    var l = todos();
    if (E.modo === "turma") return l.filter(function (a) { return a.turma === E.turma; });
    if (E.modo === "escolher") return l.filter(function (a) { return E.ids[a.id]; });
    return l;
  }
  function temConta(a) { return !!(a.conta || a.responsavel_conta); }
  function aparelhos(a) { return (ALC && ALC[a.id]) || 0; }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }

  /* ---------- a tela, montada uma vez; depois só as partes que mudam são repintadas ---------- */
  function monta() {
    if (montado) return;
    montado = true;
    box.innerHTML =
      '<p class="rec-banco" id="recBanco" role="status" hidden></p>' +
      '<div class="rec-g">' +
      '<form class="cam-card rec-form" id="recForm" novalidate aria-label="Escrever um aviso">' +
        '<fieldset class="rec-fs"><legend class="rec-lg">Para quem</legend>' +
          '<div class="seg rec-seg" role="group" aria-label="Para quem enviar">' +
            '<button type="button" data-modo="todos">Todos</button><button type="button" data-modo="turma">Uma turma</button><button type="button" data-modo="escolher">Escolher alunos</button></div>' +
          '<div class="chips" id="recTurmas" role="group" aria-label="Qual turma" hidden>' +
            TURMAS.map(function (t) { return '<button type="button" data-turma="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
          '<div class="rec-esc" id="recEsc" hidden>' +
            '<div class="rec-busca"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-search"/></svg><label class="sr-only" for="recBusca">Buscar aluno pelo nome</label>' +
              '<input class="crm-in" id="recBusca" type="search" placeholder="Buscar pelo nome" autocomplete="off" enterkeyhint="search"></div>' +
            '<div class="rec-esc-h"><span id="recEscN" aria-live="polite"></span><button type="button" class="rec-lk" id="recLimpa" hidden>Limpar a escolha</button></div>' +
            '<ul class="rec-l" id="recL" aria-label="Alunos ativos"></ul></div>' +
        "</fieldset>" +
        '<div class="rec-fs"><p class="rec-lg" id="recModT">Começar de um modelo</p><div class="chips" role="group" aria-labelledby="recModT">' +
          MODELOS.map(function (m, i) { return '<button type="button" data-modelo="' + i + '">' + esc(m[0]) + "</button>"; }).join("") + "</div></div>" +
        '<label class="crm-f rec-f"><span>Título <small id="recTitN" aria-hidden="true"></small></span><input class="crm-in" id="recTit" maxlength="' + MAX_T + '" autocomplete="off" aria-describedby="recDica"></label>' +
        '<div class="crm-f rec-f"><label for="recTxt"><span>Mensagem <small id="recTxtN" aria-hidden="true"></small></span></label>' +
          '<textarea class="crm-in" id="recTxt" maxlength="' + MAX_C + '" rows="4" aria-describedby="recDica"></textarea>' +
          '<p class="rec-nome"><button type="button" class="rec-lk" id="recNome">Inserir o primeiro nome</button><span id="recDica">Onde estiver <i class="rec-var">nome</i>, cada aluno lê o próprio nome.</span></p></div>' +
        '<fieldset class="rec-fs"><legend class="rec-lg">Ao tocar no aviso, o app abre em</legend><div class="chips" role="group" aria-label="Tela do app">' +
          TELAS.map(function (t) { return '<button type="button" data-tela="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div></fieldset>" +
      "</form>" +
      '<aside class="rec-lado" aria-label="Prévia, alcance e envio">' +
        '<section class="cam-card" aria-labelledby="recPvH"><div class="cam-h"><h4 id="recPvH">Como chega no celular</h4></div>' +
          '<div class="rec-tela"><p class="rec-hora" id="recHora" aria-hidden="true"></p>' +
            '<div class="rec-not"><img src="img/app/icone-192.png" alt="" width="34" height="34"><div><p class="rec-not-h"><span>Studio Evolution</span><span>agora</span></p><b id="recPvT"></b><p id="recPvC"></p></div></div></div>' +
          '<p class="cam-nota" id="recPvN"></p></section>' +
        '<section class="cam-card" aria-labelledby="recAlH"><div class="cam-h"><h4 id="recAlH">Alcance deste aviso</h4></div>' +
          '<p class="rec-alc" id="recAlc"></p><div class="rec-bar" aria-hidden="true"><i id="recAlcB"></i></div><p class="cam-nota" id="recAlcS"></p></section>' +
        '<div class="rec-fim"><p class="pu-e" id="recErr" role="alert" hidden></p>' +
          '<div class="rec-env"><button class="mini-btn" type="submit" form="recForm" id="recEnv"></button><button class="mini-btn ghost" type="button" id="recNao" hidden>Cancelar</button></div></div>' +
      "</aside>" +
      "</div>" +
      '<section class="cam-card rec-hist" aria-labelledby="recHiH"><div class="cam-h"><h4 id="recHiH">Últimos avisos enviados</h4></div><ul class="rec-h" id="recH"><li class="rec-vazio">Carregando…</li></ul></section>';
    liga();
    pinta();
  }

  function pintaLista() {
    var l = todos(), b = P.norm(E.busca), ul = $("#recL");
    var v = b ? l.filter(function (a) { return P.norm(a.nome).indexOf(b) >= 0; }) : l;
    ul.innerHTML = v.length ? v.map(function (a) {
      var n = aparelhos(a), st = !temConta(a) ? ["sem", "Sem conta no app"] : n ? ["ok", "Aviso ativo"] : ["app", "Vê ao abrir o app"];
      return '<li><label class="rec-al"><input type="checkbox" data-id="' + a.id + '"' + (E.ids[a.id] ? " checked" : "") + ">" +
        '<span class="av"' + (window.Fotos ? Fotos.attr(a.foto) : "") + ' aria-hidden="true">' + esc(P.ini(a.nome)) + "</span>" +
        '<span class="rec-al-t"><b>' + esc(a.nome) + "</b><small>" + esc(P.beltTxt(a.faixa, a.graus)) + " · " + esc(P.TURMAS[a.turma] || a.turma) + "</small></span>" +
        (ALC || !temConta(a) ? '<span class="rec-st ' + st[0] + '">' + (st[0] === "ok" ? '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-bell"/></svg>' : "") + st[1] + "</span>" : "") +
        "</label></li>";
    }).join("") : '<li class="rec-vazio">' + (l.length ? "Nenhum aluno com esse nome." : "Nenhum aluno ativo. Cadastre os alunos em Alunos.") + "</li>";
  }
  function pintaAlvo() {
    $$("[data-modo]", box).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.modo === E.modo)); });
    $$("[data-turma]", box).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.turma === E.turma)); });
    $$("[data-tela]", box).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tela === E.tela)); });
    $("#recTurmas").hidden = E.modo !== "turma";
    $("#recEsc").hidden = E.modo !== "escolher";
    var n = Object.keys(E.ids).filter(function (k) { return P.porId[k] && P.porId[k].ativo !== false; }).length;
    $("#recEscN").textContent = n ? plural(n, "aluno escolhido", "alunos escolhidos") : "Marque quem vai receber";
    $("#recLimpa").hidden = !n;
  }
  function pintaPrevia() {
    var tit = $("#recTit").value.trim(), txt = $("#recTxt").value.trim(), l = alvo(), nome = l.length ? primeiro(l[0].nome) : "Nome";
    var usa = (tit + txt).indexOf("{nome}") >= 0, t = $("#recPvT"), c = $("#recPvC");
    t.textContent = tit ? comNome(tit, nome) : "Título do aviso";
    c.textContent = txt ? comNome(txt, nome) : "A mensagem aparece aqui enquanto você escreve.";
    t.classList.toggle("vazio", !tit); c.classList.toggle("vazio", !txt);
    $("#recHora").textContent = P.hm(new Date());
    $("#recPvN").textContent = !usa ? "Todos recebem este mesmo texto." : l.length ? "Prévia com o nome de " + nome + ". Cada aluno recebe com o próprio nome." : "Cada aluno recebe com o próprio nome.";
    $("#recTitN").textContent = $("#recTit").value.length + " de " + MAX_T;
    $("#recTxtN").textContent = $("#recTxt").value.length + " de " + MAX_C;
  }
  function pintaAlcance() {
    var l = alvo(), y = l.length, x = l.filter(function (a) { return aparelhos(a) > 0; }).length, sem = l.filter(function (a) { return !temConta(a); }).length;
    var el = $("#recAlc"), s = $("#recAlcS");
    if (!y) { el.innerHTML = "Escolha quem vai receber."; $("#recAlcB").style.width = "0%"; s.textContent = ""; return; }
    if (!ALC) {
      el.innerHTML = "<b>" + y + "</b>" + (y === 1 ? "aluno" : "alunos") + " neste envio";
      $("#recAlcB").style.width = "0%";
      s.textContent = semBanco ? "Para ver quem está com o aviso ativo no celular, falta atualizar o banco (aviso no topo)." : "Conferindo quem está com o aviso ativo no celular…";
      return;
    }
    el.innerHTML = "<b>" + x + "</b>de " + y + (y === 1 ? " aluno" : " alunos") + " com aviso ativo no celular";
    $("#recAlcB").style.width = Math.round(x / y * 100) + "%";
    s.textContent = (x === y ? "Todos recebem a notificação na hora." : "Quem não tem vê o recado ao abrir o app.") +
      (sem ? " " + (sem === 1 ? "1 ainda não tem conta no app e não recebe." : sem + " ainda não têm conta no app e não recebem.") : "");
  }
  function pintaBotao() {
    var l = alvo(), n = l.length, b = $("#recEnv");
    b.disabled = enviando || !n;
    b.textContent = enviando ? "Enviando…" : !n ? (E.modo === "escolher" ? "Escolha os alunos" : "Nenhum aluno neste grupo") :
      E.confirma ? "Confirmar: enviar para todos os " + n : n === 1 ? "Enviar para " + primeiro(l[0].nome) : "Enviar para " + n + " alunos";
    $("#recNao").hidden = !E.confirma || enviando;
  }
  function pintaBanco() {
    var el = $("#recBanco"), h = "";
    if (funcao === "falta") h += "<b>Falta publicar a função push no Supabase.</b>Edge Functions, Deploy a new function, nome push, cole " +
      '<a href="' + FUNCAO + '" target="_blank" rel="noopener">este arquivo</a> e deixe o Verify JWT desligado. Sem ela nenhum aviso sai.';
    else if (funcao === "velha") h += "<b>Falta atualizar a função push no Supabase.</b>Edge Functions, push, cole " +
      '<a href="' + FUNCAO + '" target="_blank" rel="noopener">este arquivo</a> no lugar do código e clique em Deploy. Enquanto isso, o aviso vai igual para todos, sem o nome de cada aluno, e não fica guardado no app.';
    if (semBanco) h += (h ? " " : "") + "<b>Falta atualizar o banco de dados.</b>Abra o Supabase, SQL Editor, New query, cole " +
      '<a href="' + SQL_AVISOS + '" target="_blank" rel="noopener">este arquivo</a> inteiro e clique em Run. Depois recarregue esta página. Enquanto isso, o aviso chega como notificação, mas não fica guardado no app.';
    el.innerHTML = h;
    el.hidden = !h;
  }
  function pinta() {
    if (!montado) return;
    pintaAlvo(); pintaLista(); pintaPrevia(); pintaAlcance(); pintaBotao(); pintaBanco();
  }
  function erro(msg, foco) {
    var e = $("#recErr");
    e.textContent = msg || ""; e.hidden = !msg;
    if (msg && foco) foco.focus();
  }
  function desconfirma() { if (E.confirma) { E.confirma = false; pintaBotao(); } }

  /* ---------- o que vem do servidor ---------- */
  function faltaNoBanco(e) { return /42P01|42883|PGRST205|PGRST202|PGRST204|does not exist|schema cache|Could not find/i.test(((e && e.code) || "") + " " + ((e && e.message) || "")); }
  function carregaAlcance() {
    return P.q(function (sb) { return sb.rpc("push_alcance"); }).then(function (l) {
      ALC = {};
      (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.aluno) ALC[x.aluno] = x.aparelhos || 0; });
    }, function (e) { ALC = null; if (faltaNoBanco(e)) semBanco = true; });
  }
  function confereTabela() {
    return P.q(function (sb) { return sb.from("avisos").select("id").limit(1); }).then(function () {}, function (e) { if (faltaNoBanco(e)) semBanco = true; });
  }
  function confereFuncao() {
    if (funcao === "ok") return Promise.resolve();
    return P.db.then(function (sb) { return sb.functions.invoke("push", { body: { acao: "versao" } }); }).then(function (r) {
      if (r.error) { funcao = r.error.context && r.error.context.status === 404 ? "falta" : "velha"; return; }
      funcao = r.data && r.data.versao >= 2 ? "ok" : "velha";
    }, function () { /* sem rede: não dá para saber; fica sem aviso */ });
  }
  function quando(ts) { var d = new Date(ts); return P.dataBR(P.iso(d)) + " · " + Site.hora(P.hm(d)); }
  function marcaNome(t) { return esc(t).split("{nome}").join('<i class="rec-var">nome</i>'); }
  function carregaHistorico() {
    var ul = $("#recH");
    return P.q(function (sb) { return sb.from("push_envios").select("id, titulo, corpo, para, aparelhos, criado_em").order("criado_em", { ascending: false }).limit(10); }).then(function (l) {
      l = l || [];
      if (!l.length) { ul.innerHTML = '<li class="rec-vazio">Nenhum aviso enviado ainda.</li>'; return; }
      var ids = l.map(function (x) { return x.id; });
      /* quantos alunos cada envio alcançou e quantos já leram (só com o banco de 29/11) */
      var leram = semBanco ? Promise.resolve([]) : P.todos(function (sb) { return sb.from("avisos").select("envio, lido_em").in("envio", ids).order("id"); }).catch(function () { return []; });
      return leram.then(function (av) {
        var c = {};
        (av || []).forEach(function (x) { var k = c[x.envio] = c[x.envio] || { n: 0, lidos: 0 }; k.n++; if (x.lido_em) k.lidos++; });
        ul.innerHTML = l.map(function (x) {
          var k = c[x.id];
          /* "todos" e a turma ganham a contagem; o envio por escolha já diz o nome ou quantos são */
          return "<li><b>" + marcaNome(x.titulo) + "</b><span>" + marcaNome(x.corpo) + "</span><small>" + quando(x.criado_em) + " · para " + esc(ROT[x.para] || x.para) +
            (k && ROT[x.para] ? " (" + plural(k.n, "aluno", "alunos") + ")" : "") + " · " + (x.aparelhos === 1 ? "1 celular recebeu" : x.aparelhos + " celulares receberam") +
            (k ? " · " + (k.lidos === k.n && k.n > 1 ? "todos leram" : k.lidos === 1 ? "1 leu" : k.lidos + " leram") : "") + "</small></li>";
        }).join("");
      });
    }).catch(function (e) {
      ul.innerHTML = '<li class="rec-vazio">' + (faltaNoBanco(e) ? "O histórico aparece depois de atualizar o banco de dados." : "Não deu para carregar o histórico. Confira a internet.") + "</li>";
      if (faltaNoBanco(e)) { semBanco = true; pintaBanco(); }
    });
  }
  function carregar() {
    monta();
    return Promise.all([carregaAlcance(), confereTabela(), confereFuncao()]).then(function () { pinta(); return carregaHistorico(); });
  }

  /* ---------- enviar ---------- */
  function enviar() {
    var tit = $("#recTit").value.trim(), txt = $("#recTxt").value.trim(), l = alvo();
    if (enviando) return;
    if (!l.length) return erro(E.modo === "escolher" ? "Marque pelo menos um aluno." : "Não há aluno ativo neste grupo.");
    if (l.length > MAX_ALUNOS && E.modo === "escolher") return erro("São muitos alunos de uma vez (o máximo é " + MAX_ALUNOS + "). Envie por turma.");
    if (tit.length < 2) return erro("Escreva o título.", $("#recTit"));
    if (txt.length < 2) return erro("Escreva a mensagem.", $("#recTxt"));
    if (funcao === "falta") return erro("A função push ainda não foi publicada no Supabase. Veja o aviso no topo desta tela.");
    if (funcao === "velha" && (tit + txt).indexOf("{nome}") >= 0) return erro("A função do servidor ainda não troca o {nome}. Atualize a função (aviso no topo desta tela) ou tire o {nome} do texto.");
    /* "Todos" pede uma confirmação: é o envio que mais gente recebe */
    if (E.modo === "todos" && !E.confirma) { E.confirma = true; erro(""); pintaBotao(); return; }
    var para = E.modo === "todos" ? "todos" : E.modo === "turma" ? E.turma : l.map(function (a) { return a.id; });
    enviando = true; erro(""); pintaBotao();
    P.db.then(function (sb) { return sb.functions.invoke("push", { body: { acao: "enviar", para: para, titulo: tit, corpo: txt, tela: E.tela } }); }).then(function (r) {
      enviando = false; E.confirma = false;
      if (r.error) {
        var ctx = r.error.context, st = ctx && ctx.status;
        var le = st === 404 ? Promise.resolve({ erro: "A função push ainda não foi publicada no Supabase." }) : ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
        return le.then(function (b) { pintaBotao(); erro((b && b.erro) || "Não deu para enviar. Confira a internet e tente de novo."); });
      }
      var d = r.data || {}, n = d.alunos != null ? d.alunos : l.length;
      if (d.versao >= 2) {
        funcao = "ok";
        if (d.sem_tabela) semBanco = true;
        P.toast("Aviso enviado para " + plural(n, "aluno", "alunos") + ". " +
          (d.aparelhos ? (d.aparelhos === 1 ? "1 celular recebeu agora" : d.aparelhos + " celulares receberam agora") : "Ninguém está com o aviso ativo no celular") +
          (d.sem_tabela ? "." : (d.aparelhos ? "; os outros veem" : ": todos veem") + " ao abrir o app."));
      } else {
        funcao = "velha";
        P.toast(d.aparelhos ? "Aviso enviado para " + plural(d.aparelhos, "celular", "celulares") + ". Não ficou guardado no app: falta atualizar a função push." : "Ninguém desse grupo ativou as notificações, e o recado não ficou guardado: falta atualizar a função push.");
      }
      $("#recTit").value = ""; $("#recTxt").value = "";
      pinta();
      carregaAlcance().then(function () { pintaLista(); pintaAlcance(); });
      carregaHistorico();
    }, function () { enviando = false; E.confirma = false; pintaBotao(); erro("Não deu para enviar. Confira a internet e tente de novo."); });
  }

  /* ---------- os toques ---------- */
  function liga() {
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || !box.contains(b)) return;
      if (b.dataset.modo) { E.modo = b.dataset.modo; E.confirma = false; erro(""); pintaAlvo(); pintaPrevia(); pintaAlcance(); pintaBotao(); if (E.modo === "escolher" && e.detail) P.focusSoft($("#recBusca"), { preventScroll: true }); return; }
      if (b.dataset.turma) { E.turma = b.dataset.turma; erro(""); pintaAlvo(); pintaPrevia(); pintaAlcance(); pintaBotao(); return; }
      if (b.dataset.tela) { E.tela = b.dataset.tela; pintaAlvo(); return; }
      if (b.dataset.modelo) {
        var m = MODELOS[+b.dataset.modelo];
        $("#recTit").value = m[1]; $("#recTxt").value = m[2]; E.tela = m[3];
        erro(""); desconfirma(); pintaAlvo(); pintaPrevia();
        P.focusSoft($("#recTxt"), { preventScroll: true });
        return;
      }
      if (b.id === "recLimpa") { E.ids = {}; pintaAlvo(); pintaLista(); pintaPrevia(); pintaAlcance(); pintaBotao(); return; }
      if (b.id === "recNao") { E.confirma = false; pintaBotao(); $("#recEnv").focus(); return; }
      if (b.id === "recNome") {
        /* põe {nome} onde está o cursor (na mensagem, ou no título se foi o último campo usado) */
        var c = ultimo && ultimo.id === "recTit" ? $("#recTit") : $("#recTxt"), max = c.id === "recTit" ? MAX_T : MAX_C;
        var i = c.selectionStart != null ? c.selectionStart : c.value.length, f = c.selectionEnd != null ? c.selectionEnd : i;
        var novo = c.value.slice(0, i) + "{nome}" + c.value.slice(f);
        if (novo.length > max) return erro("Não cabe: o " + (c.id === "recTit" ? "título" : "texto") + " já está no limite de letras.");
        c.value = novo; c.focus(); c.setSelectionRange(i + 6, i + 6);
        erro(""); pintaPrevia();
      }
    });
    var ultimo = null;
    ["recTit", "recTxt"].forEach(function (id) {
      var c = $("#" + id);
      c.addEventListener("input", function () { erro(""); desconfirma(); pintaPrevia(); });
      c.addEventListener("focus", function () { ultimo = c; });
    });
    $("#recBusca").addEventListener("input", function () { E.busca = this.value; pintaLista(); });
    $("#recL").addEventListener("change", function (e) {
      var c = e.target;
      if (!c.dataset || !c.dataset.id) return;
      if (c.checked) E.ids[c.dataset.id] = 1; else delete E.ids[c.dataset.id];
      erro(""); pintaAlvo(); pintaPrevia(); pintaAlcance(); pintaBotao();
    });
    $("#recForm").addEventListener("submit", function (e) { e.preventDefault(); enviar(); });
  }

  /* a ficha do aluno e o Hoje abrem a aba já com a pessoa escolhida (sem id: só no modo de escolher) */
  P.avisoPara = function (id) {
    monta();
    E.modo = "escolher"; E.confirma = false; E.busca = "";
    if (id) { E.ids = {}; E.ids[id] = 1; }
    $("#recBusca").value = "";
    P.go("avisos", true);
    pinta();
    if (id) setTimeout(function () { P.focusSoft($("#recTit"), { preventScroll: true }); }, 60);
  };
  P.aoAbrir("avisos", carregar);
  P.aoMudarAlunos(function () { if (montado) pinta(); });
  if (P.atual() === "avisos") carregar();
})();

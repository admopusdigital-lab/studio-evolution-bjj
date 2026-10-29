/* Painel · Interessados (CRM): os pedidos do site (pedido_site) e os contatos que o professor adiciona.
   Etapas: novo → em atendimento → aula agendada → matriculado (vira aluno) ou sem interesse. Cada mudança fica no histórico. */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var LEADS = [], etapaF = "abertos";
  var ETAPA = { novo: "Novo", atendimento: "Em atendimento", agendado: "Aula agendada", matriculado: "Matriculado", perdido: "Sem interesse" };
  var ORIGEM = { site: "Pelo site", instagram: "Instagram", indicacao: "Indicação", visita: "Passou no Studio", whatsapp: "WhatsApp", google: "Google", outro: "Outro" };
  var PROG = { adulto: "Adulto", feminino: "Feminino", kids: "Kids" };
  var FILTROS = [["abertos", "Em aberto"], ["novo", "Novos"], ["atendimento", "Em atendimento"], ["agendado", "Aula agendada"], ["matriculado", "Matriculados"], ["perdido", "Sem interesse"]];
  function passa(l, f) { return f === "abertos" ? ["novo", "atendimento", "agendado"].indexOf(l.etapa) >= 0 : l.etapa === f; }

  function carregar() {
    return P.todos(function (sb) { return sb.from("leads").select("*").order("criado_em", { ascending: false }); }).then(function (l) { LEADS = l; paint(); return l; });
  }
  P.recarregarLeads = carregar;
  function aulaTx(l) { return l.aula_data ? Site.DIAS[P.dia(l.aula_data).getDay()].toLowerCase().slice(0, 3) + " " + P.dataBR(l.aula_data) + (l.aula_hora ? ", " + Site.hora(l.aula_hora) : "") : ""; }
  function oQue(l) { return (l.turma_aula || PROG[l.programa]) + (l.crianca ? ", para " + l.crianca + (l.idade ? ", " + l.idade + " anos" : "") : ""); }
  function pill(l) {
    var c = l.etapa === "novo" ? "gold" : l.etapa === "agendado" || l.etapa === "matriculado" ? "in" : l.etapa === "perdido" ? "" : "";
    return '<span class="pill-s ' + c + '">' + (l.etapa === "novo" ? "Retornar" : ETAPA[l.etapa]) + (l.etapa === "agendado" && l.aula_data ? " · " + aulaTx(l) : "") + "</span>";
  }
  function paint() {
    var abertos = LEADS.filter(function (l) { return passa(l, "abertos"); }).length, novos = LEADS.filter(function (l) { return l.etapa === "novo"; }).length;
    var mes = P.mesIni(P.hoje()), doMes = LEADS.filter(function (l) { return P.mesIni(l.criado_em.slice(0, 10)) === mes; });
    $("#ldK").textContent = abertos + " em aberto · " + doMes.length + " neste mês · " + doMes.filter(function (l) { return l.etapa === "matriculado"; }).length + " matrículas";
    P.selo("bLeads", novos);
    $("#ldChips").innerHTML = FILTROS.map(function (f) { var n = LEADS.filter(function (l) { return passa(l, f[0]); }).length; return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (etapaF === f[0]) + '">' + f[1] + " · " + n + "</button>"; }).join("");
    var q = P.norm($("#ldQ").value.trim()), qd = P.digitos($("#ldQ").value);
    var vis = LEADS.filter(function (l) { return passa(l, etapaF) && (!q || P.norm(l.nome).indexOf(q) >= 0 || P.norm(l.crianca).indexOf(q) >= 0 || (qd.length >= 4 && P.digitos(l.whatsapp).indexOf(qd) >= 0)); });
    $("#ldList").innerHTML = vis.map(function (l) {
      return '<div class="lead" data-id="' + l.id + '"><span class="av">' + P.ini(l.nome) + '</span><div><b><button class="nm-btn" type="button" data-ficha>' + esc(l.nome) + "</button></b>" + pill(l) +
        "<small>" + esc(ORIGEM[l.origem] + " · " + oQue(l)) + (l.aula_data && l.etapa !== "agendado" ? " · pediu " + aulaTx(l) : "") + " · " + P.quando(l.criado_em.slice(0, 10)).replace("hoje", "chegou hoje") + "</small></div>" +
        '<div class="acts"><select class="sel" data-etapa aria-label="Etapa de ' + esc(l.nome) + '">' + Object.keys(ETAPA).map(function (k) { return '<option value="' + k + '"' + (k === l.etapa ? " selected" : "") + ">" + ETAPA[k] + "</option>"; }).join("") + "</select>" +
        (l.whatsapp ? '<button class="mini-btn wa" type="button" data-wa>WhatsApp</button>' : "") +
        (l.etapa === "matriculado" ? '<button class="mini-btn" type="button" data-matricula>Cadastrar aluno</button>' : "") + "</div></div>";
    }).join("");
    var e = $("#ldEmpty");
    e.hidden = vis.length > 0;
    e.innerHTML = !LEADS.length ? "<b>Nenhum interessado ainda.</b>Os pedidos de aula experimental feitos no site aparecem aqui sozinhos. Contatos do Instagram, indicações e visitas, adicione em Adicionar contato."
      : q ? "Ninguém com “" + esc($("#ldQ").value.trim()) + "”." : "Ninguém nesta etapa.";
  }
  $("#ldChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-f]"); if (b) { etapaF = b.dataset.f; paint(); } });
  $("#ldQ").addEventListener("input", paint);
  function porId(id) { return LEADS.filter(function (l) { return l.id === id; })[0]; }
  function registrar(id, texto) { return P.q(function (sb) { return sb.from("lead_eventos").insert({ lead: id, texto: texto }); }); }

  /* a mensagem pronta muda com a etapa */
  function msg(l) {
    var hi = "Oi, " + P.first(l.nome) + "! Aqui é do Studio Evolution BJJ", of = l.crianca ? " do(a) " + l.crianca : "";
    if (l.etapa === "agendado" && l.aula_data) return hi + ". Confirmando a aula experimental" + of + " " + aulaTx(l) + ", no " + (l.turma_aula || PROG[l.programa]) + ". A gente empresta o kimono; chegue uns minutos antes. Qualquer dúvida, é só chamar aqui.";
    if (l.origem === "site" && l.aula_data && l.etapa === "novo") return hi + ". Recebi seu pedido de aula experimental" + of + " para " + aulaTx(l) + ", no " + (l.turma_aula || PROG[l.programa]) + ". Está confirmado! Chegue alguns minutos antes; a gente empresta o kimono. Se esse dia não der, me fala que eu te passo outro.";
    var grade = l.programa === "kids" ? "As turmas Kids treinam às 9h e às 18h: o Kids 1 às terças e quintas, o Kids 2 às segundas e quartas" : (l.programa === "feminino" ? "As alunas treinam junto com as turmas de adulto" : "As turmas de adulto treinam") + ", de segunda a sexta, às 8h, 11h, 19h ou 20h30";
    return hi + ". Que bom que você quer conhecer o jiu-jitsu! " + grade + ". Qual horário fica melhor para " + (l.crianca ? "a aula experimental" + of : "a sua aula experimental") + "? A primeira aula é grátis e a gente empresta o kimono.";
  }
  function mudarEtapa(l, etapa) {
    return P.q(function (sb) { return sb.from("leads").update({ etapa: etapa }).eq("id", l.id); })
      .then(function () { return registrar(l.id, "Etapa: " + ETAPA[etapa]); })
      .then(carregar).then(function () {
        P.toast(P.first(l.nome) + ": " + ETAPA[etapa] + "." + (etapa === "matriculado" ? " Toque em Cadastrar aluno para criar a ficha e a mensalidade." : ""));
      });
  }
  function matricular(l) {
    var pre = { nome: l.crianca || l.nome, turma: l.programa === "kids" ? (l.turma_aula === "Kids 2" ? "kids2" : "kids1") : l.programa, whatsapp: l.whatsapp, responsavel: l.crianca ? l.nome : null };
    P.fecharFicha();
    P.novoAluno(pre, l.id);
  }
  $("#ldList").addEventListener("change", function (e) {
    if (!e.target.matches("[data-etapa]")) return;
    var l = porId(e.target.closest(".lead").dataset.id);
    mudarEtapa(l, e.target.value).catch(function (er) { P.erro(er); carregar(); });
  });
  $("#ldList").addEventListener("click", function (e) {
    var b = e.target.closest("button"), row = e.target.closest(".lead");
    if (!b || !row) return;
    var l = porId(row.dataset.id);
    if (b.hasAttribute("data-ficha")) abrir(l.id);
    else if (b.hasAttribute("data-wa")) { P.wa(l.whatsapp, msg(l)); registrar(l.id, "WhatsApp: mensagem aberta (" + ETAPA[l.etapa].toLowerCase() + ")"); if (l.etapa === "novo") mudarEtapa(l, "atendimento").catch(function () {}); }
    else if (b.hasAttribute("data-matricula")) matricular(l);
  });

  /* ---------- a ficha do contato ---------- */
  function abrir(id) {
    var l = porId(id);
    var dr = P.abrirFicha('<p class="muted">Carregando…</p>', l.nome);
    $("#drSub").textContent = ORIGEM[l.origem] + " · " + ETAPA[l.etapa];
    P.q(function (sb) { return sb.from("lead_eventos").select("*").eq("lead", id).order("criado_em", { ascending: false }); }).then(function (ev) {
      $(".dr-body", dr).innerHTML =
        '<div class="ficha-sec"><h5>Contato</h5><dl class="ficha-dl">' +
          "<dt>WhatsApp</dt><dd>" + (l.whatsapp ? P.fone(l.whatsapp) : "—") + "</dd>" +
          "<dt>Interesse</dt><dd>" + esc(oQue(l)) + "</dd>" +
          (l.aula_data ? "<dt>Aula</dt><dd>" + esc(aulaTx(l)) + (l.codigo ? " · " + esc(l.codigo) : "") + "</dd>" : "") +
          "<dt>Chegou</dt><dd>" + P.dataBRano(l.criado_em) + "</dd>" +
        "</dl></div>" +
        '<form class="crm-form" id="lfNota" novalidate><label class="crm-f wide"><span>Anotação</span><textarea class="crm-in" id="lfNotaT" rows="3">' + esc(l.nota || "") + '</textarea></label><p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar anotação</button></div></form>' +
        '<div class="ficha-sec"><h5>Histórico</h5><ul class="ficha-list">' + (ev || []).map(function (x) { return "<li><span>" + esc(x.texto) + "</span><span>" + P.dataBR(x.criado_em) + " " + P.hm(x.criado_em) + "</span></li>"; }).join("") + "</ul></div>" +
        '<div class="ficha-sec msg-acts">' + (l.whatsapp ? '<button class="mini-btn wa" type="button" data-wa>WhatsApp</button>' : "") +
          '<button class="mini-btn" type="button" data-matricula>Matricular como aluno</button><button class="mini-btn ghost" type="button" data-apaga>Apagar contato</button></div>' +
        '<div class="cfg-panel ask" id="ldDelAsk" hidden><p>Apagar o contato de ' + esc(l.nome) + ' e o histórico dele?</p><div class="msg-acts"><button class="mini-btn" type="button" data-apaga-sim>Apagar</button><button class="mini-btn ghost" type="button" data-apaga-nao>Manter</button></div></div>';
      $("#lfNota", dr).onsubmit = function (e) {
        e.preventDefault();
        var t = $("#lfNotaT").value.trim();
        P.q(function (sb) { return sb.from("leads").update({ nota: t || null }).eq("id", l.id); }).then(function () { return registrar(l.id, "Anotação: " + (t || "apagada")); })
          .then(carregar).then(function () { P.toast("Anotação salva."); abrir(l.id); }).catch(function (er) { P.erro(er); });
      };
      dr.onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-wa")) { P.wa(l.whatsapp, msg(l)); registrar(l.id, "WhatsApp: mensagem aberta"); }
        else if (b.hasAttribute("data-matricula")) matricular(l);
        else if (b.hasAttribute("data-apaga")) $("#ldDelAsk").hidden = false;
        else if (b.hasAttribute("data-apaga-nao")) $("#ldDelAsk").hidden = true;
        else if (b.hasAttribute("data-apaga-sim")) P.q(function (sb) { return sb.from("leads").delete().eq("id", l.id); }).then(carregar).then(function () { P.fecharFicha(); P.toast("Contato apagado."); }).catch(function (er) { P.erro(er); });
      };
    }).catch(function (e) { P.erro(e, "Não deu para abrir o contato"); });
  }

  /* ---------- adicionar contato ---------- */
  var form = $("#ldForm"), add = $("#ldAdd");
  function formHTML() {
    return '<p class="fin-k">Novo contato</p><div class="crm-grid">' +
      '<label class="crm-f"><span>Nome</span><input class="crm-in" id="lfNome" autocomplete="off"></label>' +
      '<label class="crm-f"><span>WhatsApp</span><input class="crm-in" id="lfFone" inputmode="tel" placeholder="(15) 99999-9999" autocomplete="off"></label>' +
      '<label class="crm-f"><span>Turma de interesse</span><select class="sel" id="lfProg"><option value="adulto">Adulto</option><option value="feminino">Feminino</option><option value="kids">Kids (4 a 12 anos)</option></select></label>' +
      '<label class="crm-f"><span>De onde veio</span><select class="sel" id="lfOrig">' + Object.keys(ORIGEM).filter(function (k) { return k !== "site"; }).map(function (k) { return '<option value="' + k + '">' + ORIGEM[k] + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f lf-kid" hidden><span>Nome da criança</span><input class="crm-in" id="lfFilho" autocomplete="off"></label>' +
      '<label class="crm-f lf-kid" hidden><span>Idade</span><input class="crm-in" id="lfIdade" inputmode="numeric" maxlength="2" autocomplete="off"></label>' +
      '<label class="crm-f"><span>Etapa</span><select class="sel" id="lfEtapa"><option value="novo">Novo (retornar)</option><option value="atendimento">Em atendimento</option><option value="agendado">Aula agendada</option></select></label>' +
      '<label class="crm-f lf-aula" hidden><span>Dia da aula</span><input class="crm-in" type="date" id="lfDia" min="' + P.hoje() + '"></label>' +
      '<label class="crm-f lf-aula" hidden><span>Horário</span><select class="sel" id="lfHora"></select></label>' +
      '<label class="crm-f wide"><span>Anotação <small>(opcional)</small></span><textarea class="crm-in" id="lfNota2" rows="2"></textarea></label></div>' +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar contato</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>';
  }
  function sync() {
    var kid = $("#lfProg").value === "kids", ag = $("#lfEtapa").value === "agendado";
    $$(".lf-kid", form).forEach(function (el) { el.hidden = !kid; });
    $$(".lf-aula", form).forEach(function (el) { el.hidden = !ag; });
    var d = $("#lfDia").value, wd = d ? P.dia(d).getDay() : null, l = [];
    if (wd !== null) Site.aulasDo(wd).forEach(function (c) { if ((kid ? /^Kids/.test(c.n) : c.n === "Adulto")) l.push(c); });
    $("#lfHora").innerHTML = l.length ? l.map(function (c) { return '<option value="' + c.t + '|' + c.n + '">' + c.n + " " + Site.hora(c.t) + "</option>"; }).join("") : '<option value="">' + (d ? "Sem aula dessa turma nesse dia" : "Escolha o dia") + "</option>";
  }
  add.addEventListener("click", function () {
    if (!form.hidden) { form.hidden = true; add.setAttribute("aria-expanded", "false"); return; }
    form.innerHTML = formHTML(); sync(); form.hidden = false; add.setAttribute("aria-expanded", "true"); P.aparece(form); P.focusSoft($("#lfNome"));
  });
  form.addEventListener("change", sync);
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { form.hidden = true; add.setAttribute("aria-expanded", "false"); P.focusSoft(add); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = $("#lfNome").value.trim().replace(/\s+/g, " "), foneT = $("#lfFone").value.trim(), fone = P.foneBanco(foneT), prog = $("#lfProg").value, etapa = $("#lfEtapa").value;
    var kid = prog === "kids", filho = kid ? $("#lfFilho").value.trim() : "", idade = kid ? P.digitos($("#lfIdade").value) : "", hora = $("#lfHora").value;
    if (nome.length < 2) return P.erroForm(form, $("#lfNome"), "Digite o nome do contato.");
    if (foneT && !fone) return P.erroForm(form, $("#lfFone"), "Confira o WhatsApp: DDD e número.");
    if (fone && LEADS.some(function (l) { return l.whatsapp === fone; })) return P.erroForm(form, $("#lfFone"), "Esse WhatsApp já está em Interessados.");
    if (idade && (+idade < 4 || +idade > 12)) return P.erroForm(form, $("#lfIdade"), "O Kids é para crianças de 4 a 12 anos.");
    if (etapa === "agendado" && (!$("#lfDia").value || !hora)) return P.erroForm(form, $("#lfDia"), "Escolha o dia e o horário da aula.");
    var h = hora.split("|"), d = {
      nome: nome, whatsapp: fone, programa: prog, origem: $("#lfOrig").value, etapa: etapa, crianca: filho || null, idade: idade ? +idade : null,
      aula_data: etapa === "agendado" ? $("#lfDia").value : null, aula_hora: etapa === "agendado" ? h[0] : null, turma_aula: etapa === "agendado" ? h[1] : null, nota: $("#lfNota2").value.trim() || null
    };
    $('[type="submit"]', form).classList.add("loading");
    P.q(function (sb) { return sb.from("leads").insert(d).select().single(); }).then(function (l) {
      return registrar(l.id, "Contato adicionado no painel · " + ORIGEM[d.origem] + (d.aula_data ? " · aula " + aulaTx(d) : "")).then(function () { return l; });
    }).then(function (l) {
      form.hidden = true; add.setAttribute("aria-expanded", "false");
      etapaF = "abertos"; $("#ldQ").value = "";
      return carregar().then(function () { P.toast("Contato salvo: " + P.first(l.nome) + " está em " + ETAPA[l.etapa] + "."); });
    }).catch(function (er) { $('[type="submit"]', form).classList.remove("loading"); P.erro(er, "Não deu para salvar o contato"); });
  });

  P.aoAbrir("leads", function () { carregar().catch(function (e) { P.erro(e, "Não deu para carregar os interessados"); }); });
  /* o selo do menu já aparece ao abrir o painel */
  window.addEventListener("load", function () { carregar().catch(function () {}); });
})();

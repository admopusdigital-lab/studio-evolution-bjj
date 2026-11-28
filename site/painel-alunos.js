/* Painel · Alunos e Graduações: a lista com filtros, o cadastro (novo e editar), a ficha de cada aluno
   (dados, frequência, mensalidades, graus, acesso ao app) e o registro de grau. */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var filtro = "ativos";

  /* ---------- a lista ---------- */
  var FILTROS = [["ativos", "Ativos"], ["sumidos", "Sem treinar"], ["atrasados", "Mensalidade atrasada"], ["prontos", "Prontos para o grau"], ["kids", "Kids"], ["semnasc", "Sem aniversário"], ["semantes", "Sem aulas de antes"], ["inativos", "Inativos"], ["todos", "Todos"]];
  /* a mensalidade de cada aluno: atrasadas (com os dias) e a do mês. Sem a área Financeiro, a coluna fica com o vencimento */
  var MENS = null;
  function carregarMens() {
    if (!P.pode("financeiro")) { MENS = null; return Promise.resolve(); }
    var mes = P.mesIni(P.hoje());
    return P.todos(function (sb) { return sb.from("mensalidades").select("aluno, competencia, vencimento, pago_em").or("pago_em.is.null,competencia.eq." + mes); }).then(function (l) {
      MENS = {};
      (l || []).forEach(function (m) {
        var x = MENS[m.aluno] = MENS[m.aluno] || { atr: 0, desde: null, mes: null };
        if (!m.pago_em && m.vencimento < P.hoje()) { x.atr++; if (!x.desde || m.vencimento < x.desde) x.desde = m.vencimento; }
        if (m.competencia === mes) x.mes = m;
      });
      paintLista();
    }).catch(function () { MENS = null; });
  }
  P.recarregarMensAlunos = carregarMens;
  function atrasado(a) { return !!(MENS && MENS[a.id] && MENS[a.id].atr); }
  function passa(a, f) {
    return f === "semantes" ? a.ativo && !(a.aulas_antes > 0) : f === "semnasc" ? a.ativo && !a.nascimento : f === "ativos" ? a.ativo : f === "sumidos" ? P.sumido(a)
      : f === "atrasados" ? a.ativo && atrasado(a) : f === "prontos" ? a.ativo && !!P.desdeGrau && (P.desdeGrau(a) || 0) >= 49
      : f === "kids" ? a.ativo && P.kid(a.turma) : f === "inativos" ? !a.ativo : true;
  }
  /* as últimas 4 semanas (segunda a domingo): um quadrado por semana, cheio quando o aluno treinou */
  function semanas(id) {
    var h = P.dia(P.hoje()), seg = new Date(h.getFullYear(), h.getMonth(), h.getDate() - (h.getDay() + 6) % 7), l = [];
    for (var k = 3; k >= 0; k--) {
      var ini = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() - 7 * k), fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
      var a0 = P.iso(ini), a1 = P.iso(fim);
      l.push(P.pres.filter(function (p) { return p.aluno === id && p.data >= a0 && p.data <= a1; }).length);
    }
    return '<span class="sem4" title="Aulas por semana, da mais antiga para esta: ' + l.join(", ") + '">' + l.map(function (n) { return "<i" + (n ? ' class="' + (n > 1 ? "on2" : "on") + '"' : "") + "></i>"; }).join("") + "</span>";
  }
  function regua(a) {
    if (!P.desdeGrau) return "";
    var n = P.desdeGrau(a);
    if (n === null) return "";
    var cor = Site.COR_FAIXA[Site.faixaBase(a.faixa)] || Site.COR_FAIXA.branca;
    return '<span class="gr-bar mini" style="--cor:' + cor + '"><i style="width:' + Math.min(100, Math.round(n / 50 * 100)) + '%"></i></span><span class="gr-n">' + n + "/50</span>";
  }
  function mensTx(a) {
    if (!(a.mensalidade > 0)) return '<span class="muted">sem mensalidade</span>';
    if (!MENS) return vencSel(a);
    var x = MENS[a.id];
    var st = x && x.atr ? '<span class="pill-s warn">Atrasada ' + P.difDias(x.desde, P.hoje()) + (P.difDias(x.desde, P.hoje()) === 1 ? " dia" : " dias") + "</span>"
      : x && x.mes && x.mes.pago_em ? '<span class="pill-s in">Em dia</span>' : '<span class="pill-s">A vencer</span>';
    return '<span class="mens-c">' + st + vencSel(a) + "</span>";
  }
  P.filtroAlunos = function (f) { filtro = f; paintLista(); };
  function paintLista() {
    var at = P.ativos();
    $("#alK").textContent = at.length + (at.length === 1 ? " ativo" : " ativos");
    $("#alChips").innerHTML = FILTROS.map(function (f) {
      var n = P.alunos.filter(function (a) { return passa(a, f[0]); }).length;
      return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (filtro === f[0]) + '">' + f[1] + " · " + n + "</button>";
    }).join("");
    var q = P.norm($("#alQ").value.trim());
    var l = P.alunos.filter(function (a) { return passa(a, filtro) && (!q || P.norm(a.nome).indexOf(q) >= 0 || P.norm(a.responsavel).indexOf(q) >= 0); });
    var mes = P.mesIni(P.hoje());
    $("#alTbl tbody").innerHTML = l.map(function (a) {
      var u = P.ultima(a.id), dias = u ? P.difDias(u, P.hoje()) : null, sum = P.sumido(a);
      return '<tr data-id="' + a.id + '"' + (a.ativo ? "" : ' class="off"') + '><td><div class="nm"><span class="av"' + Fotos.attr(a.foto) + '>' + P.ini(a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + a.id + '">' + esc(a.nome) + "</button><small>" +
        esc(P.turmaTx(a)) + (a.responsavel ? " · resp. " + esc(P.first(a.responsavel)) : "") + (a.ativo ? "" : " · inativo") + "</small></div></div></td>" +
        "<td>" + P.belt(a.faixa, a.graus, a.turma) + "</td>" +
        '<td class="hide-s">' + regua(a) + "</td>" +
        '<td class="hide-s">' + semanas(a.id) + "</td>" +
        "<td>" + (sum && a.ativo ? '<span class="pill-s warn">' + (u ? "há " + dias + " dias" : "nunca veio") + "</span>" : P.quando(u)) + "</td>" +
        "<td>" + mensTx(a) + "</td>" +
        '<td class="act"><div class="row-acts">' + (a.whatsapp ? '<button class="ic-btn wa" type="button" data-wa="' + a.id + '" aria-label="WhatsApp de ' + esc(a.nome) + '" title="WhatsApp"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-wa"/></svg></button>' : "") + "</div></td></tr>";
    }).join("");
    var vazio = $("#alEmpty");
    vazio.hidden = l.length > 0;
    vazio.innerHTML = !P.alunos.length ? "<b>Nenhum aluno cadastrado ainda.</b>Toque em Adicionar aluno para começar. O aluno entra na lista, ganha a mensalidade do mês e, se quiser, o acesso ao app."
      : q ? "Nenhum aluno com “" + esc($("#alQ").value.trim()) + "”." : "Ninguém neste filtro.";
    $("#alTbl").hidden = !l.length;
  }
  /* mudou o dia do vencimento: a mensalidade em aberto deste mês em diante passa para o dia novo (devolve as datas novas) */
  P.moverVencimento = function (alunoId, dia) {
    var mes = P.mesIni(P.hoje()), mudou = [];
    return P.q(function (sb) { return sb.from("mensalidades").select("id, competencia, vencimento").eq("aluno", alunoId).is("pago_em", null).gte("competencia", mes); }).then(function (abertas) {
      return Promise.all((abertas || []).map(function (m) {
        var nova = P.vencDe(m.competencia, dia);
        if (nova === m.vencimento) return null;
        mudou.push(P.dataBR(nova));
        return P.q(function (sb) { return sb.from("mensalidades").update({ vencimento: nova }).eq("id", m.id); });
      }));
    }).then(function () { if (mudou.length && P.recarregarFin) P.recarregarFin(); return mudou; });
  };
  /* o dia do vencimento direto na lista: escolheu, salvou (e a mensalidade em aberto deste mês em diante acompanha) */
  function vencSel(a) {
    if (!(a.mensalidade > 0)) return '<span class="muted" title="Sem mensalidade">—</span>';
    var v = a.vencimento || 10;
    return '<label class="venc-sel"><span class="sr-only">Dia do vencimento de ' + esc(a.nome) + '</span><select class="sel" data-venc="' + a.id + '">' +
      Array.apply(null, Array(31)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (v === i + 1 ? " selected" : "") + ">dia " + (i + 1) + "</option>"; }).join("") + "</select></label>";
  }
  $("#alTbl").addEventListener("change", function (e) {
    var sel = e.target.closest("select[data-venc]");
    if (!sel) return;
    var a = P.porId[sel.dataset.venc], dia = +sel.value, antes = a.vencimento || 10;
    if (!a || dia === antes) return;
    sel.disabled = true;
    var mudou = [];
    P.q(function (sb) { return sb.from("alunos").update({ vencimento: dia }).eq("id", a.id); }).then(function () {
      return P.moverVencimento(a.id, dia);
    }).then(function (m) { mudou = m; return P.carregarAlunos(); }).then(function () {
      P.toast("Vencimento de " + P.first(a.nome) + " agora é dia " + dia + "." + (mudou.length ? " A mensalidade em aberto passou para " + mudou.join(" e ") + "." : ""));
    }).catch(function (er) { sel.value = String(antes); sel.disabled = false; P.erro(er, "Não deu para mudar o vencimento"); });
  });
  $("#alChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-f]"); if (b) { filtro = b.dataset.f; paintLista(); } });
  $("#alQ").addEventListener("input", paintLista);
  $("#alTbl").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ficha) P.abrirAluno(b.dataset.ficha);
    else if (b.dataset.wa) { var a = P.porId[b.dataset.wa]; P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. "); }
  });
  P.aoMudarAlunos(function () { paintLista(); paintGrad(); });
  P.aoAbrir("alunos", function () { P.carregarPresencas().then(paintLista).catch(function () {}); carregarMens(); paintLista(); });

  /* ---------- o formulário (novo e editar) ---------- */
  function formHTML(a, pre) {
    a = a || {};
    pre = pre || {};
    var v = function (k) { return esc(a[k] != null ? a[k] : pre[k] != null ? pre[k] : ""); };
    var turma = a.turma || pre.turma || "adulto";
    return '<p class="fin-k">' + (a.id ? "Editar " + esc(a.nome) : pre.nome ? "Matricular " + esc(pre.nome) : "Novo aluno") + "</p>" +
      '<div class="crm-grid">' +
      '<label class="crm-f"><span>Nome completo</span><input class="crm-in" data-k="nome" autocomplete="off" value="' + v("nome") + '"></label>' +
      '<label class="crm-f"><span>Tratamento nas mensagens</span><select class="sel" data-k="artigo"><option value="">Só o nome</option><option value="a"' + (a.artigo === "a" ? " selected" : "") + '>Feminino (a aluna)</option><option value="o"' + (a.artigo === "o" ? " selected" : "") + ">Masculino (o aluno)</option></select></label>" +
      '<label class="crm-f"><span>Turma</span><select class="sel" data-k="turma">' + Object.keys(P.TURMAS).map(function (t) { return '<option value="' + t + '"' + (t === turma ? " selected" : "") + ">" + P.TURMAS[t] + (t === "feminino" ? " (junto com o Adulto)" : t === "kids1" ? " (terça e quinta)" : t === "kids2" ? " (segunda e quarta)" : "") + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Horário</span><select class="sel" data-k="horario"></select></label>' +
      '<label class="crm-f f-kid"><span>Responsável</span><input class="crm-in" data-k="responsavel" autocomplete="off" value="' + v("responsavel") + '"></label>' +
      '<label class="crm-f"><span>Data de nascimento <small>(para o aviso de aniversário)</small></span><input class="crm-in" type="date" data-k="nascimento" max="' + P.hoje() + '" value="' + v("nascimento") + '"></label>' +
      '<label class="crm-f"><span class="f-fone">WhatsApp</span><input class="crm-in" data-k="whatsapp" inputmode="tel" placeholder="(15) 99999-9999" autocomplete="off" value="' + esc(a.whatsapp ? P.fone(a.whatsapp) : pre.whatsapp ? P.fone(pre.whatsapp) : "") + '"></label>' +
      '<label class="crm-f"><span class="f-mail">E-mail <small>(o login do app)</small></span><input class="crm-in" type="email" data-k="email" autocomplete="off" spellcheck="false" value="' + v("email") + '"></label>' +
      '<label class="crm-f"><span>Faixa</span><select class="sel" data-k="faixa"></select></label>' +
      '<label class="crm-f"><span>Graus</span><select class="sel" data-k="graus" data-atual="' + (a.graus || 0) + '"></select></label>' +
      '<label class="crm-f"><span>Mensalidade (R$)</span><input class="crm-in" data-k="mensalidade" inputmode="decimal" autocomplete="off" value="' + (a.mensalidade != null ? String(a.mensalidade).replace(".", ",") : "") + '"></label>' +
      '<label class="crm-f"><span>Vencimento</span><select class="sel" data-k="vencimento">' + Array.apply(null, Array(31)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + ((a.vencimento || 10) === i + 1 ? " selected" : "") + ">dia " + (i + 1) + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Início no Studio</span><input class="crm-in" type="date" data-k="inicio" max="' + P.hoje() + '" value="' + (a.inicio || P.hoje()) + '"></label>' +
      '<label class="crm-f"><span>Aulas no Studio antes do app <small>(na faixa e grau de hoje)</small></span><input class="crm-in" data-k="aulas_antes" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (a.aulas_antes || "") + '"></label>' +
      '<label class="crm-f wide"><span>Anotação <small>(opcional)</small></span><textarea class="crm-in" data-k="nota" rows="2">' + v("nota") + "</textarea></label>" +
      (pre.responsavel_conta ? '<input type="hidden" data-k="responsavel_conta" value="' + esc(pre.responsavel_conta) + '"><p class="muted wide" style="font-size:12.5px">Vai entrar no plano família de <b>' + esc(pre.titular || "") + "</b>: a conta do app dele marca as aulas e faz o check-in.</p>" : "") +
      "</div>" +
      /* Kids: a autorização do responsável (LGPD, art. 14) fica registrada com a data */
      '<label class="mf-pub f-kid"><input type="checkbox" data-k="consentimento"' + (a.consentimento_em ? " checked disabled" : "") + "><span>" +
        (a.consentimento_em ? "Autorização do responsável registrada em " + P.dataBRano(a.consentimento_em) + (a.consentimento_por ? " (" + esc(a.consentimento_por) + ")" : "")
          : "O responsável autorizou o cadastro da criança e o uso dos dados e da foto pelo Studio (LGPD, art. 14)") +
        ' · <a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a></span></label>' +
      (a.id ? "" : '<div class="crm-grid" style="margin-top:4px"><label class="crm-f"><span>Taxa de matrícula (R$) <small>(opcional)</small></span><input class="crm-in" data-k="taxa" inputmode="decimal" placeholder="0" autocomplete="off"></label></div>' +
        '<label class="mf-pub"><input type="checkbox" data-k="mens1" checked><span>Lançar a mensalidade deste mês no Financeiro</span></label>' +
        '<label class="mf-pub"><input type="checkbox" data-k="app"' + (pre.email ? " checked" : "") + '><span>Criar o acesso ao app <small>(precisa do e-mail; no Kids, a conta é do responsável)</small></span></label>') +
      '<p class="crm-err" role="alert"></p>' +
      '<div class="msg-acts"><button class="mini-btn" type="submit">' + (a.id ? "Salvar" : "Cadastrar aluno") + '</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>';
  }
  function formSync(f, a) {
    var t = $('[data-k="turma"]', f).value, kid = P.kid(t), hs = P.horasDa(t), h = $('[data-k="horario"]', f), fx = $('[data-k="faixa"]', f), cur = h.value || (a && a.horario) || "", cf = fx.value || (a && a.faixa) || "branca";
    h.innerHTML = '<option value="">Sem horário fixo</option>' + hs.map(function (x) { return '<option value="' + x + '">' + (P.TURMAS[t]) + " " + Site.hora(x) + "</option>"; }).join("");
    h.value = hs.indexOf(cur) >= 0 ? cur : "";
    var fxs = kid ? P.FX_KD : P.FX_AD;
    if (fxs.indexOf(cf) < 0) fxs = fxs.concat([cf]);
    fx.innerHTML = fxs.map(function (x) { return '<option value="' + x + '">' + P.FAIXAS[x] + "</option>"; }).join("");
    fx.value = cf;
    /* graus pela IBJJF: adulto até 4 (preta até 6); kids até 11 (sistema mensal) */
    var gs = $('[data-k="graus"]', f), gAtual = gs.options.length ? +gs.value : +(gs.dataset.atual || 0), gMax = Site.maxGraus(fx.value, kid);
    gs.innerHTML = Array.apply(null, Array(gMax + 1)).map(function (_, i) { return "<option>" + i + "</option>"; }).join("");
    gs.value = String(Math.min(gAtual, gMax));
    $$(".f-kid", f).forEach(function (el) { el.hidden = !kid; });
    $(".f-fone", f).textContent = kid ? "WhatsApp do responsável" : "WhatsApp";
    $(".f-mail", f).innerHTML = (kid ? "E-mail do responsável" : "E-mail") + " <small>(o login do app)</small>";
  }
  function ler(f) {
    var g = function (k) { var el = $('[data-k="' + k + '"]', f); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : null; };
    var turma = g("turma"), kid = P.kid(turma), val = g("mensalidade");
    return {
      d: {
        nome: g("nome").replace(/\s+/g, " "), artigo: g("artigo") || null, turma: turma, horario: g("horario") || null,
        responsavel: kid ? (g("responsavel") || null) : null, nascimento: g("nascimento") || null,
        whatsapp: P.foneBanco(g("whatsapp")), email: (g("email") || "").toLowerCase() || null,
        faixa: g("faixa"), graus: +g("graus"), mensalidade: val ? P.num(val) : null, vencimento: +g("vencimento"), inicio: g("inicio") || P.hoje(),
        nota: g("nota") || null, responsavel_conta: g("responsavel_conta") || undefined, aulas_antes: g("aulas_antes") ? parseInt(g("aulas_antes").replace(/\D/g, ""), 10) || 0 : 0
      },
      foneTxt: g("whatsapp"), mens1: g("mens1"), app: g("app"), taxa: g("taxa") ? P.num(g("taxa")) : 0, consent: !!g("consentimento")
    };
  }
  function validar(f, x) {
    var d = x.d, el = function (k) { return $('[data-k="' + k + '"]', f); };
    if (d.nome.length < 3) return P.erroForm(f, el("nome"), "Digite o nome completo.");
    if (P.kid(d.turma) && (!d.responsavel || d.responsavel.length < 3)) return P.erroForm(f, el("responsavel"), "No Kids, digite o nome do responsável.");
    if (P.kid(d.turma) && !f.dataset.editando && !x.consent) return P.erroForm(f, el("consentimento"), "No Kids, marque a autorização do responsável para o cadastro da criança.");
    if (x.foneTxt && !d.whatsapp) return P.erroForm(f, el("whatsapp"), "Confira o WhatsApp: DDD e número, como (15) 99999-9999.");
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return P.erroForm(f, el("email"), "Confira o e-mail.");
    if (x.app && !d.email) return P.erroForm(f, el("email"), "Para criar o acesso ao app, digite o e-mail.");
    if (d.mensalidade !== null && !(d.mensalidade >= 0)) return P.erroForm(f, el("mensalidade"), "Valor da mensalidade em reais, como 200.");
    if (x.taxa !== 0 && !(x.taxa >= 0)) return P.erroForm(f, el("taxa"), "Taxa de matrícula em reais, como 100.");
    if (d.inicio > P.hoje()) return P.erroForm(f, el("inicio"), "O início no Studio não pode ser no futuro.");
    if (!(d.aulas_antes >= 0 && d.aulas_antes <= 5000)) return P.erroForm(f, el("aulas_antes"), "Aulas antes do app: um número de 0 a 5000.");
    var aviso = d.faixa ? P.avisoIdade(d.faixa, d.nascimento) : "";
    if (aviso && !confirm(aviso)) return P.erroForm(f, el("faixa"), aviso.replace(" Registrar assim mesmo?", ""));
    return true;
  }
  /* a 1ª mensalidade: este mês, no dia do vencimento (se o dia já passou, vence no mês que vem) */
  function primeiraParcela(d) {
    var hoje = P.hoje(), mes = P.mesIni(hoje), venc = P.vencDe(mes, d.vencimento);
    if (venc < hoje) { mes = P.somaMes(mes, 1); venc = P.vencDe(mes, d.vencimento); }
    return { competencia: mes, vencimento: venc };
  }

  var form = $("#alForm"), addBtn = $("#alAdd"), preLead = null;
  P.novoAluno = function (pre, leadId) {
    preLead = leadId || null;
    P.go("alunos");
    form.innerHTML = formHTML(null, pre);
    formSync(form, pre);
    form.hidden = false;
    addBtn.setAttribute("aria-expanded", "true");
    P.aparece(form);
    P.focusSoft($('[data-k="nome"]', form), { preventScroll: false });
  };
  addBtn.addEventListener("click", function () {
    if (!form.hidden) { form.hidden = true; addBtn.setAttribute("aria-expanded", "false"); return; }
    P.novoAluno(null);
  });
  form.addEventListener("change", function (e) { if (e.target.dataset.k === "turma" || e.target.dataset.k === "faixa") formSync(form); });
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { form.hidden = true; addBtn.setAttribute("aria-expanded", "false"); P.focusSoft(addBtn); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var x = ler(form);
    if (!validar(form, x)) return;
    var btn = $('[type="submit"]', form);
    btn.classList.add("loading");
    /* só manda o campo quando há aulas antes do app (assim funciona mesmo antes da migração das faixas do Kids) */
    if (x.d.aulas_antes) x.d.aulas_antes_ate = P.hoje(); else delete x.d.aulas_antes;
    if (!x.d.responsavel_conta) delete x.d.responsavel_conta;
    if (P.kid(x.d.turma) && x.consent) { x.d.consentimento_em = new Date().toISOString(); x.d.consentimento_por = x.d.responsavel; }
    var criado = null;
    P.q(function (sb) { return sb.from("alunos").insert(x.d).select().single(); }).catch(function (er) {
      /* banco sem a coluna da autorização (migração de 25/11 ainda não rodou): grava o aluno sem ela e avisa */
      if (!x.d.consentimento_em || !P.semColuna(er)) throw er;
      delete x.d.consentimento_em; delete x.d.consentimento_por;
      setTimeout(function () { P.toast("A autorização do responsável não foi guardada: falta rodar a atualização do banco de 25/11."); }, 3500);
      return P.q(function (sb) { return sb.from("alunos").insert(x.d).select().single(); });
    }).then(function (novo) {
      criado = novo;
      var passos = [];
      if (x.mens1 && x.d.mensalidade > 0) {
        var p = primeiraParcela(x.d);
        passos.push(P.q(function (sb) { return sb.from("mensalidades").insert({ aluno: novo.id, competencia: p.competencia, valor: x.d.mensalidade, vencimento: p.vencimento }); }));
      }
      if (x.d.graus || x.d.faixa !== "branca") passos.push(P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: novo.id, faixa: x.d.faixa, graus: x.d.graus, data: x.d.inicio, nota: P.NOTA_CADASTRO }); }));
      if (x.taxa > 0) passos.push(P.q(function (sb) { return sb.from("cobrancas").insert({ aluno: novo.id, descricao: "Taxa de matrícula", tipo: "matricula", valor: x.taxa, vencimento: P.hoje() }); }));
      /* o interessado passa a apontar para o aluno criado (banco sem a coluna: segue só com a etapa) */
      if (preLead) passos.push(P.q(function (sb) { return sb.from("leads").update({ etapa: "matriculado", aluno: novo.id }).eq("id", preLead); }).catch(function (er) {
        if (!P.semColuna(er)) throw er;
        return P.q(function (sb) { return sb.from("leads").update({ etapa: "matriculado" }).eq("id", preLead); });
      }), P.q(function (sb) { return sb.from("lead_eventos").insert({ lead: preLead, texto: "Matriculado: cadastro de aluno criado" }); }));
      return Promise.all(passos).then(function () { return novo; });
    }).then(function (novo) {
      form.hidden = true;
      addBtn.setAttribute("aria-expanded", "false");
      if (preLead && P.recarregarLeads) P.recarregarLeads();
      preLead = null;
      return P.carregarAlunos().then(function () {
        P.toast("Aluno cadastrado: " + P.first(novo.nome) + ", " + P.turmaTx(novo) + ".");
        if (x.app) return criarAcesso(novo, true);
        P.abrirAluno(novo.id);
      });
    }).catch(function (e) {
      btn.classList.remove("loading");
      /* o aluno já entrou e só um passo seguinte falhou: fecha o formulário (cadastrar de novo duplicaria o aluno) */
      if (criado) {
        form.hidden = true; addBtn.setAttribute("aria-expanded", "false"); preLead = null;
        P.erro(e, "Aluno cadastrado, mas faltou um passo (mensalidade, graduação ou taxa). Confira na ficha");
        return P.carregarAlunos().then(function () { P.abrirAluno(criado.id); }).catch(function () {});
      }
      P.erro(e, "Não deu para cadastrar");
    });
  });

  /* ---------- acesso ao app (função criar-conta): a conta liga sozinha ao cadastro pelo e-mail ---------- */
  function criarAcesso(a, novo) {
    var dono = P.kid(a.turma) && a.responsavel ? a.responsavel : a.nome;
    return Acesso.conta({ acao: "criar", nome: dono, email: a.email, whatsapp: a.whatsapp || "", papel: "aluno" }).then(function (r) {
      if (!r.ok && /Já existe/.test(r.msg || "")) return Acesso.conta({ acao: "nova-senha", email: a.email }).then(function (r2) { r2.reenvio = true; return r2; });
      return r;
    }).then(function (r) {
      return P.carregarAlunos().then(function () {
        P.abrirAluno(a.id, r.ok ? r : null);
        if (!r.ok) P.toast((novo ? "Aluno cadastrado, mas o acesso ao app não foi criado: " : "") + (r.msg || "tente de novo."));
      });
    }).catch(function (e) { P.erro(e, "Não deu para criar o acesso ao app"); P.abrirAluno(a.id); });
  }
  function msgAcesso(a, r) {
    var link = new URL("entrar.html?app", location.href).href;
    return "Oi, " + P.first(P.kid(a.turma) && a.responsavel ? a.responsavel : a.nome) + "! Aqui é do Studio Evolution BJJ. " + (r.reenvio ? "Sua senha nova do app do Studio:" : "Seu acesso ao app do Studio está pronto:") +
      "\n\nEntre em: " + link + "\nE-mail: " + r.email + "\nSenha: " + r.senha + "\n\nNo app você confirma a vaga nas aulas, registra a presença com o código da TV e estuda os movimentos da sua faixa. Depois de entrar, dá para instalar o app na tela do celular.";
  }

  /* ---------- a ficha ---------- */
  /* frequência da ficha: os números em cartões e o calendário dos últimos 30 dias (segunda a sábado),
     com o número de cada dia; dourado quando veio, mais forte e com dois pontos quando fez duas aulas */
  var DS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], MS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  /* aviso na ficha: as aulas de antes do app ficaram fora por causa de um grau registrado depois delas */
  function foraHTML(a, g) {
    if (!P.antesFora(a, g)) return "";
    return '<div class="antes-fora"><p><b>' + a.aulas_antes + " aulas de antes do app não estão entrando em “desde o último grau”.</b> " +
      "O grau " + esc(P.beltTxt(g.faixa, g.graus).toLowerCase()) + " foi registrado em " + P.dataBR(g.data) + ", depois que essas aulas foram lançadas (" + P.dataBR(a.aulas_antes_ate) + "), então o sistema entendeu como grau novo.</p>" +
      '<p class="muted">Se ' + esc(P.first(a.nome)) + " já tinha esse grau antes de usar o app, toque abaixo e as aulas voltam para a conta.</p>" +
      '<button class="mini-btn" type="button" data-ja-tinha="' + g.id + '">Já tinha esse grau</button></div>';
  }
  /* marca a graduação como "já tinha antes do app": as aulas de antes voltam para "desde o último grau" */
  P.jaTinha = function (gid, alunoId) {
    return P.q(function (sb) { return sb.from("graduacoes").select("nota").eq("id", gid).maybeSingle(); }).then(function (g) {
      var nota = P.NOTA_CADASTRO + (g && g.nota && !P.doCadastro(g) ? " · " + g.nota : "");
      return P.q(function (sb) { return sb.from("graduacoes").update({ nota: nota }).eq("id", gid); });
    }).then(function () { return carregarGrad().catch(function () {}); }).then(function () {
      var a = P.porId[alunoId];
      P.toast("Pronto: as aulas de antes do app de " + P.first(a ? a.nome : "") + " voltaram para a conta.");
    });
  };
  function freqHTML(id, total, antes, desdeGrau) {
    var hoje = P.hoje(), d0 = P.dia(hoje), ini = P.somaDias(hoje, -29);
    var dias = {};
    P.pres.forEach(function (p) { if (p.aluno === id) dias[p.data] = (dias[p.data] || 0) + 1; });
    /* da segunda da semana do 1º dia até o sábado desta semana */
    var seg = P.dia(ini); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    var fim = new Date(d0); fim.setDate(d0.getDate() + (6 - ((d0.getDay() + 6) % 7)) - 1);
    var n30 = 0, dias30 = 0, cel = "";
    for (var x = new Date(seg); x <= fim; x.setDate(x.getDate() + 1)) {
      if (x.getDay() === 0) continue;
      var k = P.iso(x), n = dias[k] || 0, fora = k < ini || k > hoje;
      if (!fora) { n30 += n; if (n) dias30++; }
      var cls = fora ? "fora" : n >= 2 ? "l2" : n === 1 ? "l1" : "";
      cel += '<span class="cal-d ' + cls + (k === hoje ? " hj" : "") + '" title="' + DS[(x.getDay() + 6) % 7] + " " + P.dataBR(k) + (fora ? "" : ": " + (n ? n + (n === 1 ? " aula" : " aulas") : "não veio")) + '">' +
        '<b>' + x.getDate() + "</b>" + (x.getDate() === 1 ? "<small>" + MS[x.getMonth()] + "</small>" : "") + (n >= 2 && !fora ? "<i></i><i></i>" : n === 1 && !fora ? "<i></i>" : "") + "</span>";
    }
    var ult = P.ultima(id);
    return '<div class="fq-kpis">' +
        '<div class="fq-k gold"><b>' + (total + antes) + "</b><span>aulas no Studio" + (antes ? "<small>" + total + " no app + " + antes + " antes</small>" : "") + "</span></div>" +
        '<div class="fq-k"><b>' + desdeGrau + "</b><span>desde o último grau</span></div>" +
        '<div class="fq-k"><b>' + n30 + "</b><span>nos últimos 30 dias<small>em " + dias30 + (dias30 === 1 ? " dia" : " dias") + " de treino</small></span></div>" +
        '<div class="fq-k"><b class="sm">' + esc(P.quando(ult)) + "</b><span>última aula</span></div>" +
      "</div>" +
      semanas12(id);
  }
  /* as últimas 12 semanas, segunda a sábado: uma coluna por semana (a mais antiga à esquerda), dourado quando veio */
  function semanas12(id) {
    var hoje = P.hoje(), dias = {}, seg = P.dia(hoje), tot = 0, comTreino = 0;
    P.pres.forEach(function (p) { if (p.aluno === id) dias[p.data] = (dias[p.data] || 0) + 1; });
    seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7) - 7 * 11);
    var cols = [];
    for (var w = 0; w < 12; w++) {
      var col = [], nW = 0;
      for (var d = 0; d < 6; d++) {
        var x = new Date(seg); x.setDate(seg.getDate() + w * 7 + d);
        var k = P.iso(x), n = k > hoje ? -1 : dias[k] || 0;
        if (n > 0) nW += n;
        col.push({ k: k, n: n, d: d });
      }
      tot += nW; if (nW) comTreino++;
      cols.push(col);
    }
    return '<p class="cal-t">Últimas 12 semanas · ' + tot + (tot === 1 ? " aula" : " aulas") + " em " + comTreino + (comTreino === 1 ? " semana" : " semanas") + "</p>" +
      '<div class="f12" role="img" aria-label="Últimas 12 semanas: ' + tot + (tot === 1 ? " aula" : " aulas") + ", treinou em " + comTreino + " de 12 semanas" + '">' +
        DS.map(function (nome, d) {
          return "<span class=\"f12-d\">" + nome + "</span>" + cols.map(function (col) {
            var c = col[d];
            return '<i class="' + (c.n < 0 ? "fora" : c.n >= 2 ? "l2" : c.n === 1 ? "l1" : "") + (c.k === hoje ? " agora" : "") + '" title="' + nome + " " + P.dataBR(c.k) + (c.n < 0 ? "" : ": " + (c.n ? c.n + (c.n === 1 ? " aula" : " aulas") : "não veio")) + '"></i>';
          }).join("");
        }).join("") +
      "</div>" +
      '<div class="fq-leg"><span><i></i>sem treino</span><span><i class="l1"></i>1 aula</span><span><i class="l2"></i>2 aulas</span></div>';
  }
  /* semanas seguidas com pelo menos uma aula (a semana de agora conta quando já teve aula) */
  function seguidas(id) {
    var datas = {};
    P.pres.forEach(function (p) { if (p.aluno === id) datas[p.data] = 1; });
    var seg = P.dia(P.hoje()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    function teve(ini) { for (var d = 0; d < 7; d++) { var x = new Date(ini); x.setDate(ini.getDate() + d); if (datas[P.iso(x)]) return true; } return false; }
    var n = 0, w = new Date(seg);
    if (!teve(w)) w.setDate(w.getDate() - 7);
    while (n < 104 && teve(w)) { n++; w.setDate(w.getDate() - 7); }
    return n;
  }
  /* a mensalidade na ficha: em aberto, dá para receber, passar para o dia cadastrado do aluno ou editar data e valor */
  function mensLi(a, m) {
    var certo = !m.pago_em && a.vencimento ? P.vencDe(m.competencia, a.vencimento) : null;
    return '<li data-mens="' + m.id + '"><span>' + P.mesNome(m.competencia) + " · " + P.brl(m.valor) + '</span><span class="row-acts">' + statusMens(m) +
      (m.pago_em ? "" : '<button class="mini-btn" type="button" data-mens-paga>Recebi</button>' +
        (certo && certo !== m.vencimento ? '<button class="mini-btn ghost" type="button" data-mens-dia="' + certo + '">Passar para ' + P.dataBR(certo) + "</button>" : "") +
        '<button class="mini-btn ghost" type="button" data-mens-ed>Editar</button>') + "</span>" +
      (m.pago_em ? "" : '<form class="mens-ed" hidden novalidate><label class="crm-f"><span>Vencimento</span><input class="crm-in" type="date" data-mv value="' + m.vencimento + '"></label>' +
        '<label class="crm-f"><span>Valor (R$)</span><input class="crm-in" inputmode="decimal" data-mval value="' + String(m.valor).replace(".", ",") + '"></label>' +
        '<div class="msg-acts"><button class="mini-btn" type="submit">Salvar</button><button class="mini-btn ghost" type="button" data-mens-cancela>Cancelar</button></div></form>') + "</li>";
  }
  function statusMens(m) {
    if (m.pago_em) return '<span class="pill-s in">Paga ' + P.dataBR(m.pago_em) + "</span>";
    if (m.vencimento < P.hoje()) return '<span class="pill-s warn">Atrasada desde ' + P.dataBR(m.vencimento) + "</span>";
    return '<span class="pill-s">Vence ' + P.dataBR(m.vencimento) + "</span>";
  }
  /* ---------- outros valores: taxa de matrícula, produto vendido, qualquer valor avulso ---------- */
  var FORMA_C = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", boleto: "Boleto" };
  function statusC(c) {
    if (c.pago_em) return '<span class="pill-s in">Pago ' + P.dataBR(c.pago_em) + (c.forma ? " · " + FORMA_C[c.forma] : "") + "</span>";
    if (c.vencimento < P.hoje()) return '<span class="pill-s warn">Venceu ' + P.dataBR(c.vencimento) + "</span>";
    return '<span class="pill-s">Vence ' + P.dataBR(c.vencimento) + "</span>";
  }
  function outrosHTML(a, cobs) {
    if (cobs === null) return '<div class="ficha-sec"><h5>Outros valores</h5><p class="muted">Para lançar taxa de matrícula e outros valores, rode a atualização do banco (veja o aviso no topo do painel).</p></div>';
    var aberto = cobs.filter(function (c) { return !c.pago_em; }).reduce(function (t, c) { return t + Number(c.valor); }, 0);
    return '<div class="ficha-sec"><h5>Outros valores' + (aberto ? ' · <span style="color:var(--warn)">' + P.brl(aberto) + " em aberto</span>" : "") + "</h5>" +
      (cobs.length ? '<ul class="ficha-list">' + cobs.map(function (c) {
        return '<li data-cob="' + c.id + '"><span>' + esc(c.descricao) + " · " + P.brl(c.valor) + "</span><span class=\"row-acts\">" + statusC(c) +
          (c.pago_em ? "" : '<button class="mini-btn" type="button" data-cob-paga>Recebi</button>') + '<button class="mini-btn ghost" type="button" data-cob-apaga>Apagar</button></span></li>';
      }).join("") + "</ul>" : '<p class="muted">Nada além da mensalidade. Lance aqui a taxa de matrícula, um kimono, um seminário ou qualquer valor avulso.</p>') +
      '<form class="crm-form oc-form" id="frCob" novalidate><div class="crm-grid">' +
        '<label class="crm-f"><span>O que é</span><select class="sel" id="ocTipo"><option value="matricula">Taxa de matrícula</option><option value="outro" selected>Outro valor</option></select></label>' +
        '<label class="crm-f"><span>Descrição</span><input class="crm-in" id="ocDesc" maxlength="80" placeholder="Seminário, exame de faixa…" autocomplete="off"></label>' +
        '<label class="crm-f"><span>Valor (R$)</span><input class="crm-in" id="ocValor" inputmode="decimal" placeholder="100" autocomplete="off"></label>' +
        '<label class="crm-f"><span>Vencimento</span><input class="crm-in" type="date" id="ocVenc" value="' + P.hoje() + '"></label></div>' +
        '<label class="mf-pub"><input type="checkbox" id="ocPago"><span>Já recebi</span> <select class="sel" id="ocForma" style="margin-left:8px;max-width:130px">' + Object.keys(FORMA_C).map(function (k) { return '<option value="' + k + '">' + FORMA_C[k] + "</option>"; }).join("") + "</select></label>" +
        '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Lançar valor</button></div></form></div>';
  }
  function ligaOutros(a, dr) {
    var f = $("#frCob", dr);
    if (!f) return;
    $("#ocTipo", f).onchange = function () { var d = $("#ocDesc", f); if (this.value === "matricula" && !d.value) d.value = "Taxa de matrícula"; else if (this.value !== "matricula" && d.value === "Taxa de matrícula") d.value = ""; };
    f.onsubmit = function (e) {
      e.preventDefault();
      var tipo = $("#ocTipo", f).value, desc = $("#ocDesc", f).value.trim() || (tipo === "matricula" ? "Taxa de matrícula" : ""), v = P.num($("#ocValor", f).value), venc = $("#ocVenc", f).value, pago = $("#ocPago", f).checked;
      if (desc.length < 2) return P.erroForm(f, $("#ocDesc", f), "Diga o que é esse valor, como Seminário ou Exame de faixa.");
      if (!(v > 0)) return P.erroForm(f, $("#ocValor", f), "Digite o valor, como 100 ou 49,90.");
      if (!venc) return P.erroForm(f, $("#ocVenc", f), "Escolha o vencimento.");
      $('[type="submit"]', f).classList.add("loading");
      P.q(function (sb) { return sb.from("cobrancas").insert({ aluno: a.id, descricao: desc, tipo: tipo, valor: v, vencimento: venc, pago_em: pago ? P.hoje() : null, forma: pago ? $("#ocForma", f).value : null }); })
        .then(function () { P.toast(desc + " · " + P.brl(v) + " lançado para " + P.first(a.nome) + "."); P.abrirAluno(a.id); })
        .catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er); });
    };
  }

  /* ---------- plano família: o titular (com acesso ao app) e os dependentes ligados à conta dele ---------- */
  function familiaHTML(a) {
    if (!("responsavel_conta" in a)) return '<div class="ficha-sec"><h5>Plano família</h5><p class="muted">Para usar o plano família, rode a atualização do banco (veja o aviso no topo do painel).</p></div>';
    var tit = a.responsavel_conta ? P.alunos.filter(function (x) { return x.conta === a.responsavel_conta; })[0] : null;
    if (a.responsavel_conta) {
      return '<div class="ficha-sec"><h5>Plano família</h5><p>Dependente de <b>' + esc(tit ? tit.nome : "outra conta") + "</b>. A conta do app " + (tit ? "de " + esc(P.first(tit.nome)) : "do responsável") + " marca as aulas e faz o check-in.</p>" +
        '<div class="msg-acts" style="margin-top:8px">' + (tit ? '<button class="mini-btn ghost" type="button" data-ficha2="' + tit.id + '">Abrir ' + esc(P.first(tit.nome)) + "</button>" : "") +
        '<button class="mini-btn ghost" type="button" data-desfam="' + a.id + '">Tirar do plano família</button></div></div>';
    }
    if (!a.conta) return '<div class="ficha-sec"><h5>Plano família</h5><p class="muted">Para ' + esc(P.first(a.nome)) + " ser o titular de um plano família (pai ou mãe com os filhos na mesma conta), crie primeiro o acesso ao app dele no botão abaixo.</p></div>";
    var deps = P.alunos.filter(function (x) { return x.responsavel_conta === a.conta && x.id !== a.id; });
    var cand = P.ativos().filter(function (x) { return x.id !== a.id && !x.responsavel_conta && !x.conta; })
      .sort(function (x, y) { return (P.kid(y.turma) - P.kid(x.turma)) || x.nome.localeCompare(y.nome); });
    return '<div class="ficha-sec"><h5>Plano família</h5>' +
      (deps.length ? '<ul class="ficha-list">' + deps.map(function (d) {
        return '<li><span><button class="nm-btn" type="button" data-ficha2="' + d.id + '">' + esc(d.nome) + "</button> · " + esc(P.turmaTx(d)) + '</span><button class="mini-btn ghost" type="button" data-desfam="' + d.id + '">Tirar</button></li>';
      }).join("") + "</ul>" : '<p class="muted">Sem dependentes. Adicione os filhos para ' + esc(P.first(a.nome)) + " marcar as aulas e fazer o check-in deles pelo app, na mesma conta.</p>") +
      '<div class="fam-add">' +
        (cand.length ? '<label class="crm-f"><span>Aluno já cadastrado</span><select class="sel" id="famSel"><option value="">Escolha…</option>' + cand.map(function (x) { return '<option value="' + x.id + '">' + esc(x.nome) + " · " + esc(P.turmaTx(x)) + "</option>"; }).join("") + "</select></label>" +
          '<button class="mini-btn" type="button" data-addfam>Adicionar ao plano</button>' : "") +
        '<button class="mini-btn ghost" type="button" data-novodep>Cadastrar dependente novo</button>' +
      "</div></div>";
  }
  function mudaFamilia(alunoId, conta, msg, voltar) {
    return P.q(function (sb) { return sb.from("alunos").update({ responsavel_conta: conta }).eq("id", alunoId); })
      .then(P.carregarAlunos).then(function () { P.toast(msg); P.abrirAluno(voltar); })
      .catch(function (e) { P.erro(e); });
  }

  /* ---------- foto do aluno: aparece em "quem vai" e no ranking do app e nas listas do painel ---------- */
  function fotoHTML(a) {
    return '<div class="ficha-sec ficha-foto"><span class="av"' + Fotos.attr(a.foto) + ">" + P.ini(a.nome) + "</span><div><b>Foto</b>" +
      '<p class="muted">' + (a.foto ? "Aparece na lista de quem vai, no ranking e aqui no painel." : "Sem foto. Com ela, " + esc(P.first(a.nome)) + " aparece com o rosto na lista de quem vai e no ranking.") + "</p>" +
      '<div class="msg-acts"><button class="mini-btn" type="button" data-foto-poe>' + (a.foto ? "Trocar foto" : "Colocar foto") + "</button>" +
      (a.foto ? '<button class="mini-btn ghost" type="button" data-foto-tira>Tirar foto</button>' : "") +
      '</div></div><input type="file" accept="image/*" hidden data-foto-in></div>';
  }
  function ligaFoto(a, dr) {
    var box = $(".ficha-foto", dr);
    if (!box) return;
    var inp = $("[data-foto-in]", box), poe = $("[data-foto-poe]", box), tira = $("[data-foto-tira]", box);
    function erro(e) {
      var m = String((e && e.message) || "");
      P.toast(/bucket|row-level|security|foto|schema cache|not found/i.test(m) ? "As fotos ainda não estão ativadas no banco. Rode a atualização das fotos no Supabase." : "Não deu para salvar a foto. Tente de novo.");
      poe.disabled = false; poe.textContent = a.foto ? "Trocar foto" : "Colocar foto";
    }
    function grava(caminho) {
      var antiga = a.foto;
      return P.q(function (sb) { return sb.from("alunos").update({ foto: caminho }).eq("id", a.id); }).then(function () {
        if (antiga && antiga !== caminho) P.db.then(function (sb) { Fotos.apaga(sb, antiga); });
        return P.carregarAlunos();
      }).then(function () { P.abrirAluno(a.id); });
    }
    poe.addEventListener("click", function () { inp.click(); });
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      inp.value = "";
      if (!f) return;
      poe.disabled = true; poe.textContent = "Enviando…";
      P.db.then(function (sb) { return Fotos.envia(sb, a.id, f); }).then(grava).then(function () {
        P.toast("Foto de " + P.first(a.nome) + " salva.");
      }).catch(erro);
    });
    if (tira) tira.addEventListener("click", function () {
      if (!confirm("Tirar a foto de " + P.first(a.nome) + "?")) return;
      grava(null).then(function () { P.toast("Foto tirada."); }).catch(erro);
    });
  }
  var abaFicha = { id: null, aba: "resumo" };
  P.abrirAluno = function (id, cred) {
    var a = P.porId[id];
    if (!a) return;
    var dr = P.abrirFicha('<p class="muted">Carregando a ficha…</p>', a.nome, { pagina: true }), minha = P.fichaN;
    /* a faixa já vem desenhada no cabeçalho da ficha: o subtítulo fica com a turma e quem é o responsável */
    $("#drSub").textContent = P.turmaTx(a) + (a.responsavel ? " · responsável: " + a.responsavel : "") + (a.ativo ? "" : " · inativo");
    var subBase = $("#drSub").textContent;
    Promise.all([
      P.q(function (sb) { return sb.from("mensalidades").select("*").eq("aluno", id).order("competencia", { ascending: false }).limit(6); }),
      P.q(function (sb) { return sb.from("graduacoes").select("*").eq("aluno", id).order("data", { ascending: false }); }),
      /* sem a tabela (banco sem a atualização), a ficha abre do mesmo jeito */
      P.q(function (sb) { return sb.from("cobrancas").select("*").eq("aluno", id).order("vencimento", { ascending: false }); }).catch(function () { return null; })
    ]).then(function (r) {
      if (minha !== P.fichaN) return;
      var mens = r[0] || [], grads = r[1] || [], cobs = r[2], pres = P.pres.filter(function (p) { return p.aluno === id; });
      var antes = a.aulas_antes || 0, total = pres.length, desdeGrau = (grads.length ? pres.filter(function (p) { return p.data > grads[0].data; }).length : total) + P.antes(a, grads[0] || null);
      var idade = a.nascimento ? Math.floor(P.difDias(a.nascimento, P.hoje()) / 365.25) : null;
      /* ---------- cabeçalho: faixa desenhada, selos e as ações principais ---------- */
      var mAtr = mens.filter(function (m) { return !m.pago_em && m.vencimento < P.hoje(); }), mMes = mens.filter(function (m) { return m.competencia === P.mesIni(P.hoje()); })[0];
      var seloMens = !(a.mensalidade > 0) ? "" : mAtr.length ? '<span class="pill-s warn">Mensalidade atrasada há ' + P.difDias(mAtr[mAtr.length - 1].vencimento, P.hoje()) + " dias</span>"
        : mMes && mMes.pago_em ? '<span class="pill-s in">Em dia · vence dia ' + (a.vencimento || 10) + "</span>" : '<span class="pill-s">Vence dia ' + (a.vencimento || 10) + "</span>";
      var px = proxPasso(a), corF = Site.COR_FAIXA[Site.faixaBase(a.faixa)] || Site.COR_FAIXA.branca;
      var naFx = grads.filter(function (g) { return g.faixa === a.faixa; }), desdeFx = naFx.length ? naFx[naFx.length - 1].data : a.inicio;
      var mFx = desdeFx ? Math.max(0, Math.floor(P.difDias(desdeFx, P.hoje()) / 30.44)) : null;
      var sem = seguidas(id);
      $("#drSub").textContent = subBase + (a.inicio ? " · no Studio desde " + P.dataBR(a.inicio) + (a.inicio.slice(0, 4) !== P.hoje().slice(0, 4) ? "/" + a.inicio.slice(0, 4) : "") : "") +
        " · " + (total + antes) + (total + antes === 1 ? " aula" : " aulas") + (sem > 1 ? " · " + sem + " semanas seguidas" : "");
      var cab = '<div class="fp-cab">' +
        '<span class="av fp-av"' + Fotos.attr(a.foto) + ">" + P.ini(a.nome) + "</span>" +
        '<div class="fp-id"><p class="fp-belt">' + P.belt(a.faixa, a.graus, a.turma) + '</p><p class="fp-selos">' + seloMens +
          (a.conta ? '<span class="pill-s in">App ativo</span>' : '<span class="pill-s">Sem app</span>') + (a.ativo ? "" : '<span class="pill-s warn">Inativo</span>') + "</p></div>" +
        '<div class="fp-acts">' +
          (P.pode("graduacoes") ? '<button class="mini-btn fp-gold" type="button" data-grau>Registrar grau</button>' : "") +
          (a.whatsapp ? '<button class="mini-btn wa" type="button" data-wa>WhatsApp</button>' : "") +
          (a.ativo && P.avisoPara && P.podeAba("avisos") ? '<button class="mini-btn ghost" type="button" data-aviso>Mandar aviso</button>' : "") +
          (P.pode("financeiro") && cobs !== null ? '<button class="mini-btn ghost" type="button" data-lanca>Lançar valor</button>' : "") +
          (P.pode("alunos") ? '<button class="mini-btn ghost" type="button" data-edit>Editar dados</button>' : "") +
        "</div></div>";
      /* ---------- as abas ---------- */
      var ABAS = [["resumo", "Resumo"], ["fin", "Financeiro", P.pode("financeiro")], ["grad", "Graduação"], ["fam", "Família", P.pode("alunos")], ["dados", "Dados"]].filter(function (x) { return x[2] !== false; });
      var abaAtual = abaFicha.id === id && ABAS.some(function (x) { return x[0] === abaFicha.aba; }) ? abaFicha.aba : "resumo";
      if (cred) abaAtual = "resumo";
      abaFicha = { id: id, aba: abaAtual };
      var tabs = '<div class="fp-tabs" role="tablist" aria-label="Partes da ficha">' + ABAS.map(function (x) {
        return '<button type="button" role="tab" id="fpt-' + x[0] + '" aria-controls="fpp-' + x[0] + '" aria-selected="' + (x[0] === abaAtual) + '" tabindex="' + (x[0] === abaAtual ? 0 : -1) + '" data-fp-aba="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>";
      function painel(k, conteudo) { return '<section class="fp-p" role="tabpanel" id="fpp-' + k + '" aria-labelledby="fpt-' + k + '"' + (k === abaAtual ? "" : " hidden") + ">" + conteudo + "</section>"; }
      var caminho = '<div class="ficha-sec fp-cam"><h5>Caminho do grau</h5>' +
        '<p class="fp-cam-t"><b>' + esc(P.beltTxt(a.faixa, a.graus)) + "</b>" + (px ? " · próximo passo: " + esc(px.tx.toLowerCase()) : "") + "</p>" +
        '<span class="gr-bar fp-bar" style="--cor:' + corF + '"><i style="width:' + Math.min(100, Math.round(desdeGrau / 50 * 100)) + '%"></i></span>' +
        '<p class="muted fp-cam-s">' + desdeGrau + " de 50 aulas desde o último grau" + (desdeGrau < 50 ? " · faltam " + (50 - desdeGrau) : "") + (grads[0] && !P.doCadastro(grads[0]) ? " · último grau em " + P.dataBR(grads[0].data) + "/" + grads[0].data.slice(0, 4) : "") + (mFx !== null ? " · na faixa há " + (mFx < 12 ? mFx + (mFx === 1 ? " mês" : " meses") : Math.floor(mFx / 12) + (mFx < 24 ? " ano" : " anos") + (mFx % 12 ? " e " + (mFx % 12) + (mFx % 12 === 1 ? " mês" : " meses") : "")) : "") + "</p></div>";
      /* resumo: as três últimas mensalidades, a linha do tempo das graduações e a família */
      function resumoMens(l) {
        if (!P.pode("financeiro") || !(a.mensalidade > 0) && !l.length) return "";
        return '<div class="ficha-sec fp-rm"><h5>Mensalidades</h5>' + (l.length ? '<ul class="fp-mini">' + l.slice(0, 3).map(function (m) {
          return "<li><b>" + esc(P.mesNome(m.competencia).split(" ")[0]) + "</b><span>" + P.brl(m.valor) + "</span>" + statusMens(m) + "</li>";
        }).join("") + "</ul>" : '<p class="muted">Nenhuma mensalidade lançada.</p>') + '<button class="mini-btn ghost" type="button" data-fp-aba="fin">Ver o financeiro</button></div>';
      }
      function resumoLinha(a, gs) {
        var l = gs.map(function (g) { return { d: g.data, t: P.doCadastro(g) ? "Chegou com " + P.beltTxt(g.faixa, g.graus).toLowerCase() : g.graus ? g.graus + "º grau na faixa " + Site.faixaNome(g.faixa).toLowerCase() : "Faixa " + Site.faixaNome(g.faixa).toLowerCase() }; });
        if (a.inicio) l.push({ d: a.inicio, t: "Entrou no Studio" });
        l.sort(function (x, y) { return x.d < y.d ? 1 : x.d > y.d ? -1 : 0; });
        if (!l.length) return "";
        return '<div class="ficha-sec"><h5>Linha do tempo</h5><ol class="fp-tl">' + l.slice(0, 6).map(function (x) { return "<li><time>" + P.dataBR(x.d) + "/" + x.d.slice(0, 4) + "</time><span>" + esc(x.t) + "</span></li>"; }).join("") + "</ol></div>";
      }
      function resumoFamilia(a) {
        if (!("responsavel_conta" in a)) return "";
        var l = a.conta ? P.alunos.filter(function (x) { return x.responsavel_conta === a.conta && x.id !== a.id; })
          : a.responsavel_conta ? P.alunos.filter(function (x) { return x.conta === a.responsavel_conta; }) : [];
        if (!l.length) return "";
        return '<div class="ficha-sec"><h5>Família</h5><ul class="fp-fam">' + l.map(function (x) {
          return '<li><span class="av"' + Fotos.attr(x.foto) + ">" + P.ini(x.nome) + '</span><div><button class="nm-btn" type="button" data-ficha2="' + x.id + '">' + esc(x.nome) + "</button><small>" + esc(P.turmaTx(x)) + " · " + esc(P.beltTxt(x.faixa, x.graus)) + "</small></div></li>";
        }).join("") + "</ul></div>";
      }
      var obs = a.nota ? '<div class="ficha-sec fp-obs"><h5>Observações</h5><p>' + esc(a.nota) + "</p></div>" : "";
      var html =
        (cred ? '<div class="cred"><b>Acesso ao app ' + (cred.reenvio ? "com senha nova" : "criado") + "</b><p>E-mail: <code>" + esc(cred.email) + "</code><br>Senha provisória: <code>" + esc(cred.senha) + '</code></p><div class="msg-acts">' +
          (a.whatsapp ? '<button class="mini-btn wa" type="button" data-envia>Mandar pelo WhatsApp</button>' : "") + '<button class="mini-btn ghost" type="button" data-copia>Copiar mensagem</button></div><p class="muted" style="margin-top:6px;font-size:12px">A senha aparece só agora. Depois de entrar, o aluno pode trocar em "Esqueci a senha".</p></div>' : "") +
        cab + tabs +
        painel("resumo", '<div class="fp-col">' + caminho + '<div class="ficha-sec"><h5>Frequência</h5>' + freqHTML(id, total, antes, desdeGrau) + foraHTML(a, grads[0]) + "</div></div>" +
          '<div class="fp-col">' + obs + resumoMens(mens) + resumoLinha(a, grads) + resumoFamilia(a) + "</div>") +
        (!P.pode("financeiro") ? "" : painel("fin",
          '<div class="ficha-sec"><h5>Mensalidades</h5>' + (mens.length ? '<ul class="ficha-list">' + mens.map(function (m) { return mensLi(a, m); }).join("") + "</ul>" : '<p class="muted">Nenhuma mensalidade lançada.</p>') + "</div>" +
          outrosHTML(a, cobs))) +
        painel("grad",
          '<div class="ficha-sec"><h5>Graduações</h5>' + (grads.length ? '<ul class="ficha-list">' + grads.map(function (g) { return '<li data-grad="' + g.id + '"><span>' + P.beltTxt(g.faixa, g.graus) + (P.notaGrau(g) ? " · " + esc(P.notaGrau(g)) : "") + '</span><span class="row-acts">' + (P.doCadastro(g) ? "cadastro" : P.dataBRano(g.data)) + '<button class="mini-btn ghost" type="button" data-grad-apaga>Apagar</button></span></li>'; }).join("") + "</ul>" : '<p class="muted">Nenhum grau registrado.</p>') + "</div>" +
          '<div class="ficha-sec msg-acts">' + (P.pode("graduacoes") ? '<button class="mini-btn" type="button" data-grau>Registrar grau</button>' : "") +
            (!P.pode("alunos") ? "" : '<button class="mini-btn ghost" type="button" data-antes aria-expanded="false">Aulas no Studio antes do app' + (antes ? " · " + antes : "") + "</button>") + "</div>" +
          '<form class="crm-form" id="frAntes" novalidate hidden>' +
            '<p class="fin-k">Aulas no Studio antes do app</p>' +
            '<p class="muted" style="font-size:13px;margin:4px 0 10px">Quantas aulas ' + esc(P.first(a.nome)) + " fez aqui no Studio Evolution antes de usar o app, desde o último grau (na faixa e grau de hoje). Somam no total e nas aulas desde o último grau, no painel e no app do aluno.</p>" +
            '<div class="crm-grid"><label class="crm-f"><span>Número de aulas</span><input class="crm-in" id="faN" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (antes || "") + '"></label></div>' +
            '<p class="crm-err" role="alert"></p>' +
            '<div class="msg-acts"><button class="mini-btn" type="submit">Salvar</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>' +
          "</form>") +
        (P.pode("alunos") ? painel("fam", familiaHTML(a)) : "") +
        painel("dados",
          (P.pode("alunos") ? fotoHTML(a) : "") +
          '<div class="ficha-sec"><h5>Dados</h5><dl class="ficha-dl">' +
            "<dt>Turma</dt><dd>" + esc(P.turmaTx(a)) + "</dd>" +
            (a.responsavel ? "<dt>Responsável</dt><dd>" + esc(a.responsavel) + "</dd>" : "") +
            (P.kid(a.turma) ? "<dt>Autorização</dt><dd>" + (a.consentimento_em ? "do responsável, em " + P.dataBRano(a.consentimento_em) : '<span class="warn-tx">falta registrar (Editar dados)</span>') + "</dd>" : "") +
            (idade !== null ? "<dt>Idade</dt><dd>" + idade + " anos</dd>" : "") +
            "<dt>WhatsApp</dt><dd>" + (a.whatsapp ? P.fone(a.whatsapp) : "—") + "</dd>" +
            "<dt>E-mail</dt><dd>" + (a.email ? esc(a.email) : "—") + "</dd>" +
            "<dt>App</dt><dd>" + (a.conta ? '<span class="pill-s in">Com acesso</span>' : '<span class="pill-s">Sem acesso</span>') + "</dd>" +
            "<dt>Mensalidade</dt><dd>" + (a.mensalidade != null ? P.brl(a.mensalidade) + " · vence dia " + (a.vencimento || 10) : "—") + "</dd>" +
            "<dt>No Studio desde</dt><dd>" + P.dataBRano(a.inicio) + (a.saida ? " · saiu em " + P.dataBRano(a.saida) : "") + "</dd>" +
            (a.nota ? "<dt>Anotação</dt><dd>" + esc(a.nota) + "</dd>" : "") +
          "</dl></div>" +
          '<form class="crm-form" id="frEdit" novalidate hidden></form>' +
          '<div class="ficha-sec msg-acts">' +
            (P.pode("alunos") ? '<button class="mini-btn" type="button" data-edit>Editar dados</button>' : "") +
            (a.email && P.pode("alunos") ? '<button class="mini-btn ghost" type="button" data-acesso>' + (a.conta ? "Senha nova do app" : "Criar acesso ao app") + "</button>" : "") +
            (P.pode("alunos") ? '<button class="mini-btn ghost fp-perigo" type="button" data-ativo>' + (a.ativo ? "Desativar aluno" : "Reativar aluno") + "</button>" : "") +
          "</div>");
      $(".dr-body", dr).innerHTML = html;
      ligaOutros(a, dr);
      ligaFoto(a, dr);
      /* editar a data e o valor de uma mensalidade em aberto, ali mesmo na ficha */
      $$(".mens-ed", dr).forEach(function (fm) {
        fm.onsubmit = function (e) {
          e.preventDefault();
          var mid = fm.closest("[data-mens]").dataset.mens, dt = $("[data-mv]", fm).value, vl = P.num($("[data-mval]", fm).value), bt = $('[type="submit"]', fm);
          if (!dt) return P.toast("Escolha a data do vencimento.");
          if (!(vl >= 0)) return P.toast("Digite o valor, como 160 ou 149,90.");
          bt.classList.add("loading");
          P.q(function (sb) { return sb.from("mensalidades").update({ vencimento: dt, valor: vl }).eq("id", mid); })
            .then(function () { if (P.recarregarFin) P.recarregarFin(); P.toast("Mensalidade salva: " + P.brl(vl) + ", vence " + P.dataBR(dt) + "."); P.abrirAluno(a.id); })
            .catch(function (er) { bt.classList.remove("loading"); P.erro(er); });
        };
      });
      $("#frAntes", dr).onsubmit = function (e) {
        e.preventDefault();
        var f = e.target, t = $("#faN", f).value.replace(/\s/g, ""), n = t === "" ? 0 : parseInt(t, 10);
        if (!/^\d*$/.test(t) || !(n >= 0 && n <= 5000)) return P.erroForm(f, $("#faN", f), "Digite só o número de aulas, de 0 a 5000.");
        $('[type="submit"]', f).classList.add("loading");
        P.q(function (sb) { return sb.from("alunos").update({ aulas_antes: n, aulas_antes_ate: n ? P.hoje() : null }).eq("id", a.id); })
          .then(P.carregarAlunos).then(function () { P.toast(n ? P.first(a.nome) + ": " + n + (n === 1 ? " aula" : " aulas") + " antes do app lançadas." : "Aulas antes do app zeradas."); P.abrirAluno(a.id); })
          .catch(function (e2) { $('[type="submit"]', f).classList.remove("loading"); P.erro(e2); });
      };
      var w = function (r) { return msgAcesso(a, r); };
      function vaiAba(k, foco) {
        abaFicha.aba = k;
        $$(".fp-tabs [data-fp-aba]", dr).forEach(function (t) { var on = t.dataset.fpAba === k; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; if (on && foco) t.focus(); });
        $$(".fp-p", dr).forEach(function (p) { p.hidden = p.id !== "fpp-" + k; });
      }
      var tl = $(".fp-tabs", dr);
      if (tl) tl.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var l = $$("[data-fp-aba]", tl), i = l.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        vaiAba(l[(i + (e.key === "ArrowRight" ? 1 : l.length - 1)) % l.length].dataset.fpAba, true);
      });
      dr.onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.fpAba) return vaiAba(b.dataset.fpAba);
        if (b.hasAttribute("data-lanca")) { vaiAba("fin"); var oc = $("#ocDesc", dr); if (oc) { oc.scrollIntoView({ block: "center", behavior: Site.reduce ? "auto" : "smooth" }); P.focusSoft(oc); } return; }
        if (b.hasAttribute("data-edit")) vaiAba("dados");
        if (b.hasAttribute("data-envia")) P.wa(a.whatsapp, w(cred));
        else if (b.hasAttribute("data-copia")) { navigator.clipboard.writeText(w(cred)).then(function () { P.toast("Mensagem copiada."); }, function () { P.toast("Não deu para copiar."); }); }
        else if (b.hasAttribute("data-wa")) P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. ");
        else if (b.hasAttribute("data-edit")) editar(a, dr);
        else if (b.hasAttribute("data-grau")) P.registrarGrau(a.id);
        else if (b.hasAttribute("data-aviso")) P.avisoPara(a.id);
        else if (b.dataset.ficha2) P.abrirAluno(b.dataset.ficha2);
        else if (b.hasAttribute("data-ja-tinha")) {
          b.classList.add("loading");
          P.jaTinha(b.dataset.jaTinha, a.id).then(function () { P.abrirAluno(a.id); }).catch(function (er) { b.classList.remove("loading"); P.erro(er); });
        }
        else if (b.hasAttribute("data-mens-dia")) {
          var mi = b.closest("[data-mens]").dataset.mens, nd = b.dataset.mensDia;
          b.classList.add("loading");
          P.q(function (sb) { return sb.from("mensalidades").update({ vencimento: nd }).eq("id", mi); })
            .then(function () { if (P.recarregarFin) P.recarregarFin(); P.toast("Mensalidade passou para " + P.dataBR(nd) + "."); P.abrirAluno(a.id); })
            .catch(function (er) { b.classList.remove("loading"); P.erro(er); });
        }
        else if (b.hasAttribute("data-mens-ed") || b.hasAttribute("data-mens-cancela")) {
          var fm = $(".mens-ed", b.closest("[data-mens]"));
          fm.hidden = b.hasAttribute("data-mens-cancela");
          if (!fm.hidden) P.focusSoft($("[data-mv]", fm));
        }
        else if (b.hasAttribute("data-mens-paga")) {
          var mid = b.closest("[data-mens]").dataset.mens;
          b.classList.add("loading");
          P.q(function (sb) { return sb.from("mensalidades").update({ pago_em: P.hoje(), forma: "pix" }).eq("id", mid); })
            .then(function () { P.toast("Baixa feita. Entrou no Financeiro."); P.abrirAluno(a.id); })
            .catch(function (er) { b.classList.remove("loading"); P.erro(er); });
        }
        else if (b.hasAttribute("data-grad-apaga")) {
          if (b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Apagar mesmo?"; return; }
          var gid = b.closest("[data-grad]").dataset.grad;
          b.classList.add("loading");
          P.q(function (sb) { return sb.from("graduacoes").delete().eq("id", gid); })
            .then(function () { return P.recalcFaixa(a.id, grads.filter(function (g) { return g.id === gid; })[0]); })
            .then(function () { return Promise.all([P.carregarAlunos(), carregarGrad()]); })
            .then(function () { var a2 = P.porId[a.id]; P.toast("Graduação apagada. " + P.first(a.nome) + " está em " + P.beltTxt(a2.faixa, a2.graus).toLowerCase() + "."); P.abrirAluno(a.id); })
            .catch(function (er) { b.classList.remove("loading"); P.erro(er); });
        }
        else if (b.hasAttribute("data-cob-paga") || b.hasAttribute("data-cob-apaga")) {
          var cid = b.closest("[data-cob]").dataset.cob, apaga = b.hasAttribute("data-cob-apaga");
          if (apaga && b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Apagar mesmo?"; return; }
          b.classList.add("loading");
          P.q(function (sb) { return apaga ? sb.from("cobrancas").delete().eq("id", cid) : sb.from("cobrancas").update({ pago_em: P.hoje(), forma: "pix" }).eq("id", cid); })
            .then(function () { P.toast(apaga ? "Valor apagado." : "Recebido. Entrou no Financeiro."); P.abrirAluno(a.id); })
            .catch(function (er) { b.classList.remove("loading"); P.erro(er); });
        }
        else if (b.dataset.desfam) {
          var dd = P.porId[b.dataset.desfam];
          mudaFamilia(dd.id, null, P.first(dd.nome) + " saiu do plano família.", a.id);
        }
        else if (b.hasAttribute("data-addfam")) {
          var sel = $("#famSel", dr), dep = P.porId[sel.value];
          if (!dep) { P.toast("Escolha o aluno que vai entrar no plano."); P.focusSoft(sel); return; }
          mudaFamilia(dep.id, a.conta, P.first(dep.nome) + " agora está no plano família de " + P.first(a.nome) + ".", a.id);
        }
        else if (b.hasAttribute("data-novodep")) {
          P.fecharFicha();
          P.novoAluno({ turma: "kids1", responsavel: a.nome, whatsapp: a.whatsapp, email: a.email, responsavel_conta: a.conta, titular: a.nome });
        }
        else if (b.hasAttribute("data-antes")) {
          var fa = $("#frAntes", dr), abre = fa.hidden;
          fa.hidden = !abre; b.setAttribute("aria-expanded", String(abre));
          if (abre) { fa.scrollIntoView({ block: "center", behavior: "smooth" }); P.focusSoft($("#faN", fa), { preventScroll: true }); }
        }
        else if (b.hasAttribute("data-cancel") && b.closest("#frAntes")) { $("#frAntes", dr).hidden = true; }
        else if (b.hasAttribute("data-acesso")) {
          b.classList.add("loading");
          if (a.conta) Acesso.conta({ acao: "nova-senha", email: a.email }).then(function (r) { if (r.ok) { r.reenvio = true; P.abrirAluno(a.id, r); } else { b.classList.remove("loading"); P.toast(r.msg); } });
          else criarAcesso(a, false);
        } else if (b.hasAttribute("data-ativo")) {
          /* desativar pede um segundo toque: tira o aluno das listas e da cobrança */
          if (a.ativo && b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Desativar mesmo?"; return; }
          var ativo = !a.ativo;
          P.q(function (sb) { return sb.from("alunos").update({ ativo: ativo, saida: ativo ? null : P.hoje() }).eq("id", a.id); })
            .then(P.carregarAlunos).then(function () { P.toast(P.first(a.nome) + (ativo ? " voltou para os ativos." : " foi para os inativos. O histórico fica guardado.")); P.abrirAluno(a.id); })
            .catch(function (e2) { P.erro(e2); });
        }
      };
    }).catch(function (e) { if (minha === P.fichaN) P.erro(e, "Não deu para abrir a ficha"); });
  };
  /* corrige a faixa e os graus do aluno: ajusta a graduação mais recente (ou cria a do cadastro, se não houver) */
  function corrigeFaixa(a, fx, gr) {
    return P.q(function (sb) { return sb.from("graduacoes").select("id, data, criado_em").eq("aluno", a.id).order("data", { ascending: false }).order("criado_em", { ascending: false }).limit(1); })
      .then(function (l) {
        var g = l && l[0];
        if (g) return P.q(function (sb) { return sb.from("graduacoes").update({ faixa: fx, graus: gr }).eq("id", g.id); });
        return P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: a.id, faixa: fx, graus: gr, data: a.inicio || P.hoje(), nota: P.NOTA_CADASTRO }); });
      })
      .then(function () { return P.q(function (sb) { return sb.from("alunos").update({ faixa: fx, graus: gr }).eq("id", a.id); }); });
  }
  function editar(a, dr) {
    var f = $("#frEdit", dr);
    f.innerHTML = formHTML(a);
    f.dataset.editando = "1";
    formSync(f, a);
    f.hidden = false;
    f.onchange = function (e) { if (e.target.dataset.k === "turma" || e.target.dataset.k === "faixa") formSync(f); };
    f.onclick = function (e) { if (e.target.closest("[data-cancel]")) { f.hidden = true; } };
    f.onsubmit = function (e) {
      e.preventDefault();
      var x = ler(f);
      if (!validar(f, x)) return;
      var d = x.d;
      /* faixa e graus aqui são CORREÇÃO do cadastro: ajustam a graduação atual, sem criar grau novo nem zerar as aulas.
         Promoção de verdade continua em Registrar grau (fica o histórico com a data) */
      var fx = d.faixa, gr = d.graus, corrige = fx && (fx !== a.faixa || gr !== (a.graus || 0));
      delete d.faixa; delete d.graus;
      if (corrige) { var av = P.avisoIdade(fx, d.nascimento || a.nascimento); if (av && !confirm(av)) return; }
      delete d.responsavel_conta;  /* a família muda na seção Plano família */
      if (d.aulas_antes !== (a.aulas_antes || 0)) d.aulas_antes_ate = d.aulas_antes ? P.hoje() : null;
      else delete d.aulas_antes;
      $('[type="submit"]', f).classList.add("loading");
      var novoDia = d.vencimento && d.vencimento !== (a.vencimento || 10) ? d.vencimento : 0, mudou = [];
      if (P.kid(d.turma) && x.consent && !a.consentimento_em) { d.consentimento_em = new Date().toISOString(); d.consentimento_por = d.responsavel; }
      P.q(function (sb) { return sb.from("alunos").update(d).eq("id", a.id); }).catch(function (er) {
        if (!d.consentimento_em || !P.semColuna(er)) throw er;
        delete d.consentimento_em; delete d.consentimento_por;
        return P.q(function (sb) { return sb.from("alunos").update(d).eq("id", a.id); });
      })
        .then(function () { return novoDia ? P.moverVencimento(a.id, novoDia).then(function (m) { mudou = m; }) : null; })
        .then(function () { return corrige ? corrigeFaixa(a, fx, gr) : null; })
        .then(P.carregarAlunos).then(function () { P.toast("Dados de " + P.first(d.nome) + " salvos." + (corrige ? " Faixa corrigida: " + P.beltTxt(fx, gr).toLowerCase() + "." : "") + (mudou.length ? " A mensalidade em aberto passou para " + mudou.join(" e ") + "." : "")); P.abrirAluno(a.id); })
        .catch(function (e2) { $('[type="submit"]', f).classList.remove("loading"); P.erro(e2); });
    };
    var lf = $('[data-k="faixa"]', f).closest("label");
    lf.title = "Corrige a faixa do cadastro. Grau novo (promoção) é em Registrar grau";
    $("span", lf).innerHTML = 'Faixa <small>(correção; grau novo é em Registrar grau)</small>';
    f.scrollIntoView({ block: "start", behavior: "smooth" });
    P.focusSoft($('[data-k="nome"]', f), { preventScroll: true });
  }

  /* ---------- Graduações: Prontos (50 aulas desde o último grau), A caminho e Histórico ---------- */
  var ultGrau = {}, GRADS = [], aba = "prontos", marcados = {};
  /* tempo mínimo da IBJJF (adulto, a partir de 18 anos) para trocar de faixa, em meses; na preta, entre um grau e outro */
  var MIN_FAIXA = { azul: 24, roxa: 18, marrom: 12 };
  function carregarGrad() {
    return P.todos(function (sb) { return sb.from("graduacoes").select("id, aluno, faixa, graus, data, nota").order("data", { ascending: false }); }).then(function (l) {
      GRADS = l || [];
      ultGrau = {};
      GRADS.forEach(function (g) { if (!ultGrau[g.aluno]) ultGrau[g.aluno] = g; });
      paintGrad();
    });
  }
  function desde(a) { var g = ultGrau[a.id], ref = g ? g.data : null; return P.pres.filter(function (p) { return p.aluno === a.id && (!ref || p.data > ref); }).length + P.antes(a, g || null); }
  /* desde quando o aluno está na faixa atual: a graduação mais antiga com esta faixa; sem registro, a data de início */
  function naFaixaDesde(a) {
    var l = GRADS.filter(function (g) { return g.aluno === a.id && g.faixa === a.faixa; });
    return l.length ? l[l.length - 1].data : a.inicio || null;
  }
  function meses(iso) { if (!iso) return null; var d = P.dia(iso), h = P.dia(P.hoje()); return Math.max(0, (h.getFullYear() - d.getFullYear()) * 12 + h.getMonth() - d.getMonth() - (h.getDate() < d.getDate() ? 1 : 0)); }
  function tempoTx(m) { if (m === null) return "—"; if (m < 1) return "menos de 1 mês"; var an = Math.floor(m / 12), r = m % 12; return (an ? an + (an === 1 ? " ano" : " anos") : "") + (an && r ? " e " : "") + (r ? r + (r === 1 ? " mês" : " meses") : ""); }
  function proxPasso(a) {
    var kid = P.kid(a.turma), fxs = kid ? P.FX_KD : P.FX_AD, gMax = Site.maxGraus(a.faixa, kid), i = fxs.indexOf(a.faixa);
    if ((a.graus || 0) < gMax) return { f: a.faixa, g: (a.graus || 0) + 1, tx: ((a.graus || 0) + 1) + "º grau", troca: false };
    if (i < 0 || i >= fxs.length - 1) return null;
    return { f: fxs[i + 1], g: 0, tx: "Faixa " + P.FAIXAS[fxs[i + 1]].toLowerCase(), troca: true };
  }
  /* o que falta de tempo mínimo para o próximo passo (só adulto; Kids segue a idade) */
  function minimo(a, px) {
    if (!px || P.kid(a.turma)) return null;
    var m = null, ref = null;
    if (px.troca && MIN_FAIXA[a.faixa]) { m = MIN_FAIXA[a.faixa]; ref = naFaixaDesde(a); }
    else if (a.faixa === "preta" && !px.troca) { m = (a.graus || 0) < 3 ? 36 : 60; ref = ultGrau[a.id] && ultGrau[a.id].faixa === "preta" ? ultGrau[a.id].data : naFaixaDesde(a); }
    if (!m || !ref) return null;
    var feito = meses(ref);
    return feito >= m ? null : { pede: m, falta: m - feito };
  }
  function linhaGrad() {
    var prontos = {};
    (P.prontosGrau ? P.prontosGrau() : []).forEach(function (x) { prontos[x.a.id] = 1; });
    return P.alunosDeVerdade().map(function (a) {
      var n = desde(a), px = proxPasso(a);
      return { a: a, n: n, px: px, min: minimo(a, px), pronto: !!prontos[a.id], m: meses(naFaixaDesde(a)) };
    });
  }
  function paintGrad() {
    var todas = linhaGrad(), pr = todas.filter(function (x) { return x.pronto; }), cam = todas.filter(function (x) { return !x.pronto; });
    var hist = GRADS.filter(function (g) { return !P.doCadastro(g); });
    $("#grAbas").innerHTML = [["prontos", "Prontos", pr.length], ["caminho", "A caminho", cam.length], ["hist", "Histórico", hist.length]].map(function (t) {
      return '<button type="button" data-aba="' + t[0] + '" aria-pressed="' + (aba === t[0]) + '">' + t[1] + " · " + t[2] + "</button>";
    }).join("");
    var l = aba === "prontos" ? pr.sort(function (x, y) { return y.n - x.n; }) : cam.sort(function (x, y) { return y.n - x.n || x.a.nome.localeCompare(y.a.nome); });
    Object.keys(marcados).forEach(function (id) { if (!pr.some(function (x) { return x.a.id === id && !x.min; })) delete marcados[id]; });
    var tbl = $("#grTbl");
    tbl.classList.toggle("com-ck", aba === "prontos");
    tbl.hidden = aba === "hist" || !l.length;
    $("#grHist").hidden = aba !== "hist";
    $("#grTbl tbody").innerHTML = aba === "hist" ? "" : l.map(function (x) {
      var cor = Site.COR_FAIXA[Site.faixaBase(x.a.faixa)] || Site.COR_FAIXA.branca, pct = Math.min(100, Math.round(x.n / 50 * 100));
      var ck = aba === "prontos" ? '<input type="checkbox" data-ck="' + x.a.id + '"' + (marcados[x.a.id] ? " checked" : "") + (x.min ? ' disabled title="Tempo mínimo da IBJJF ainda não fechou"' : "") + ' aria-label="Selecionar ' + esc(x.a.nome) + '">' : "";
      return '<tr><td class="gr-ck">' + ck + '</td><td><div class="nm"><span class="av"' + Fotos.attr(x.a.foto) + '>' + P.ini(x.a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button><small>" + esc(P.turmaTx(x.a)) + "</small></div></div></td>" +
        "<td>" + P.belt(x.a.faixa, x.a.graus, x.a.turma) + "</td>" +
        '<td><span class="gr-bar" style="--cor:' + cor + '"><i style="width:' + pct + '%"></i></span><span class="gr-n">' + x.n + " de 50</span></td>" +
        "<td>" + tempoTx(x.m) + "</td>" +
        "<td>" + (x.px ? "<b>" + esc(x.px.tx) + "</b>" : "—") + (x.min ? '<small class="gr-min">IBJJF pede ' + tempoTx(x.min.pede) + (x.px && x.px.troca ? " na " + P.FAIXAS[x.a.faixa].toLowerCase() : " entre os graus") + ": faltam " + tempoTx(x.min.falta) + "</small>" : "") + "</td>" +
        '<td class="act"><button class="mini-btn' + (x.pronto ? "" : " ghost") + '" type="button" data-grau="' + x.a.id + '">Registrar</button>' + (x.pronto ? '<button class="mini-btn ghost" type="button" data-adia="' + x.a.id + '">Avaliar depois</button>' : "") + "</td></tr>";
    }).join("");
    $("#grHist").innerHTML = hist.slice(0, 60).map(function (g) {
      var a = P.porId[g.aluno];
      return "<li><span>" + esc(a ? a.nome : "Aluno removido") + " · " + P.beltTxt(g.faixa, g.graus) + (g.nota ? ' <small class="muted">· ' + esc(g.nota) + "</small>" : "") + "</span><span>" + P.dataBRano(g.data) + "</span></li>";
    }).join("") || '<li class="muted">Nenhum grau registrado ainda.</li>';
    paintLote();
    /* quem está com as aulas de antes do app fora da conta por causa de um grau registrado depois delas */
    var fora = P.alunosDeVerdade().filter(function (a) { return P.antesFora(a, ultGrau[a.id]); }), box = $("#grFora");
    box.hidden = !fora.length;
    box.innerHTML = fora.length ? '<p><b>' + fora.length + (fora.length === 1 ? " aluno está" : " alunos estão") + " com as aulas de antes do app fora de “desde o último grau”.</b> " +
      "Um grau foi registrado depois que essas aulas foram lançadas, e o sistema entendeu como grau novo. Se o aluno já tinha esse grau antes do app, toque em “Já tinha”.</p><ul>" +
      fora.map(function (a) {
        var g = ultGrau[a.id];
        return '<li><span><b>' + esc(a.nome) + "</b> · " + esc(P.beltTxt(g.faixa, g.graus).toLowerCase()) + " registrado em " + P.dataBR(g.data) + " · " + a.aulas_antes + ' aulas de antes fora</span><button class="mini-btn" type="button" data-ja-tinha="' + g.id + '" data-aluno="' + a.id + '">Já tinha</button></li>';
      }).join("") + "</ul>" : "";
    var e = $("#grEmpty");
    e.hidden = aba === "hist" || !!l.length;
    e.innerHTML = !P.alunosDeVerdade().length ? "<b>Nenhum aluno ativo.</b>Cadastre os alunos em Alunos para acompanhar os graus." :
      aba === "prontos" ? "<b>Ninguém pronto para o grau agora.</b>O aluno entra aqui quando completa 50 aulas desde o último grau." : "<b>Todos os alunos estão prontos.</b>Veja a aba Prontos.";
  }
  function paintLote() {
    var ids = Object.keys(marcados), box = $("#grLote");
    box.hidden = aba !== "prontos" || !ids.length;
    $("#grLoteN").textContent = ids.length === 1 ? "1 selecionado" : ids.length + " selecionados";
    var d = $("#grLoteD"); if (!d.value) d.value = P.hoje(); d.max = P.hoje();
  }
  $("#grAbas").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-aba]");
    if (!b) return;
    aba = b.dataset.aba;
    paintGrad();
  });
  $("#grTbl").addEventListener("change", function (e) {
    var c = e.target.closest("[data-ck]");
    if (!c) return;
    if (c.checked) marcados[c.dataset.ck] = 1; else delete marcados[c.dataset.ck];
    paintLote();
  });
  $("#grTbl").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ficha) P.abrirAluno(b.dataset.ficha);
    if (b.dataset.grau) P.registrarGrau(b.dataset.grau);
    if (b.dataset.adia && P.adiarGrau) { P.adiarGrau(b.dataset.adia); delete marcados[b.dataset.adia]; paintGrad(); }
  });
  /* registrar de uma vez: cada aluno marcado ganha o próximo passo (grau ou faixa) com a mesma data */
  $("#grLoteBtn").addEventListener("click", function () {
    var ids = Object.keys(marcados), d = $("#grLoteD").value || P.hoje(), b = this;
    if (!ids.length) return;
    if (d > P.hoje()) return P.toast("A data da graduação não pode ser no futuro.");
    var l = ids.map(function (id) { var a = P.porId[id]; return { a: a, px: proxPasso(a) }; }).filter(function (x) { return x.a && x.px; });
    if (!confirm("Registrar em " + P.dataBR(d) + ":\n\n" + l.map(function (x) { return "· " + x.a.nome + ": " + x.px.tx.toLowerCase(); }).join("\n"))) return;
    b.classList.add("loading");
    l.reduce(function (pr, x) {
      return pr.then(function () {
        return P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: x.a.id, faixa: x.px.f, graus: x.px.g, data: d, nota: null }); }).then(function () { return P.recalcFaixa(x.a.id); });
      });
    }, Promise.resolve()).then(function () {
      marcados = {};
      return Promise.all([P.carregarAlunos(), carregarGrad()]);
    }).then(function () {
      b.classList.remove("loading");
      if (P.atualizarGrau) P.atualizarGrau();
      P.toast(l.length === 1 ? P.first(l[0].a.nome) + ": " + l[0].px.tx.toLowerCase() + ". Parabéns!" : l.length + " graduações registradas. Parabéns à turma!");
    }).catch(function (e2) { b.classList.remove("loading"); P.erro(e2, "Não deu para registrar todas. Confira a lista"); carregarGrad().catch(function () {}); });
  });
  /* a faixa e os graus do aluno vêm da graduação mais recente (pela data e, no mesmo dia, pela ordem do registro).
     Uma graduação com data no futuro (digitada errada) volta para o dia em que foi registrada: antes ela travava
     o aluno no grau antigo, porque nenhuma graduação nova ficava "mais recente" que ela */
  /* apagada: a graduação que acabou de sair (se não sobrar nenhuma, o aluno fica na faixa dela, com um grau a menos) */
  P.recalcFaixa = function (id, apagada) {
    return P.q(function (sb) { return sb.from("graduacoes").select("id, faixa, graus, data, criado_em").eq("aluno", id); }).then(function (l) {
      l = l || [];
      var hoje = P.hoje(), passos = [];
      l.forEach(function (g) {
        if (g.data > hoje) {
          var certo = P.iso(new Date(g.criado_em));
          if (certo > hoje) certo = hoje;
          g.data = certo;
          passos.push(P.q(function (sb) { return sb.from("graduacoes").update({ data: certo }).eq("id", g.id); }));
        }
      });
      l.sort(function (x, y) { return x.data < y.data ? 1 : x.data > y.data ? -1 : String(y.criado_em).localeCompare(String(x.criado_em)); });
      if (l[0]) passos.push(P.q(function (sb) { return sb.from("alunos").update({ faixa: l[0].faixa, graus: l[0].graus }).eq("id", id); }));
      else if (apagada) passos.push(P.q(function (sb) { return sb.from("alunos").update({ faixa: apagada.faixa, graus: Math.max(0, (apagada.graus || 0) - 1) }).eq("id", id); }));
      return Promise.all(passos);
    });
  };
  P.registrarGrau = function (id) {
    var a = P.porId[id];
    var fxs = P.kid(a.turma) ? P.FX_KD : P.FX_AD;
    if (fxs.indexOf(a.faixa) < 0) fxs = fxs.concat([a.faixa]);
    /* a sugestão: o próximo grau; no limite da faixa (adulto 4, preta 6, kids 11), a próxima faixa */
    var kid = P.kid(a.turma), gMax = Site.maxGraus(a.faixa, kid);
    var prox = a.graus < gMax ? { f: a.faixa, g: a.graus + 1 } : { f: fxs[Math.min(fxs.indexOf(a.faixa) + 1, fxs.length - 1)], g: 0 };
    var dr = P.abrirFicha('<form class="crm-form" id="grForm" novalidate><p class="fin-k">Hoje: ' + P.beltTxt(a.faixa, a.graus) + '</p><div class="crm-grid">' +
      '<label class="crm-f"><span>Faixa</span><select class="sel" id="gfF">' + fxs.map(function (f) { return '<option value="' + f + '"' + (f === prox.f ? " selected" : "") + ">" + P.FAIXAS[f] + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Graus</span><select class="sel" id="gfG"></select></label>' +
      '<label class="crm-f"><span>Data</span><input class="crm-in" type="date" id="gfD" max="' + P.hoje() + '" value="' + P.hoje() + '"></label>' +
      '<label class="crm-f wide"><span>Anotação <small>(opcional)</small></span><input class="crm-in" id="gfN" autocomplete="off" placeholder="Ex.: entregue no treino de sexta"></label></div>' +
      '<label class="mf-pub"><input type="checkbox" id="gfJa"><span>' + esc(P.first(a.nome)) + ' já tinha esse grau antes do app (não zera as aulas desde o último grau)</span></label>' +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Registrar</button><button class="mini-btn ghost" type="button" data-dr-x>Cancelar</button></div></form>', "Grau de " + a.nome);
    $("#drSub").textContent = P.turmaTx(a);
    /* os graus possíveis seguem a faixa escolhida; a prévia mostra as fitas nas cores da IBJJF */
    var gSel = $("#gfG", dr), fSel = $("#gfF", dr), prev = document.createElement("p");
    prev.className = "gr-prev muted";
    $(".crm-grid", dr).after(prev);
    function grausSync(manter) {
      var m = Site.maxGraus(fSel.value, kid), v = manter ? Math.min(+gSel.value || 0, m) : (fSel.value === prox.f ? prox.g : 0);
      gSel.innerHTML = Array.apply(null, Array(m + 1)).map(function (_, i) { return "<option>" + i + "</option>"; }).join("");
      gSel.value = String(v);
      pinta();
    }
    function pinta() {
      prev.innerHTML = Site.miniFaixa(fSel.value, +gSel.value, kid).replace('width="44" height="10"', 'width="132" height="30"') +
        (kid ? ' <span>Kids (IBJJF): graus 1 a 4 brancos, 5 a 8 vermelhos, 9 a 11 da cor da próxima faixa. A escola pode usar só parte deles.</span>' : "");
    }
    fSel.onchange = function () { grausSync(false); };
    gSel.onchange = pinta;
    grausSync(false);
    $("#grForm", dr).onsubmit = function (e) {
      e.preventDefault();
      var f = $("#gfF").value, g = +$("#gfG").value, d = $("#gfD").value || P.hoje(), n = $("#gfN").value.trim(), ja = $("#gfJa").checked;
      if (ja) n = P.NOTA_CADASTRO + (n ? " · " + n : "");
      if (f === a.faixa && g === a.graus) return P.erroForm(e.target, $("#gfG"), "Escolha um grau ou faixa diferente do atual.");
      if (d > P.hoje()) return P.erroForm(e.target, $("#gfD"), "A data do grau não pode ser no futuro.");
      var aviso = f !== a.faixa ? P.avisoIdade(f, a.nascimento) : "";
      if (aviso && !confirm(aviso)) return;
      $('[type="submit"]', e.target).classList.add("loading");
      P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: a.id, faixa: f, graus: g, data: d, nota: n || null }); })
        .then(function () { return P.recalcFaixa(a.id); })
        .then(function () { return Promise.all([P.carregarAlunos(), carregarGrad()]); })
        .then(function () {
          P.fecharFicha();
          P.toast(P.first(a.nome) + ": " + P.beltTxt(f, g).toLowerCase() + ". Parabéns!");
          if (a.whatsapp) setTimeout(function () { P.toast("Quer avisar a família ou o aluno? Abra a ficha e use o WhatsApp."); }, 3800);
        })
        .catch(function (e2) { $('[type="submit"]', e.target).classList.remove("loading"); P.erro(e2, "Não deu para registrar o grau"); });
    };
  };
  $("#grFora").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ja-tinha]");
    if (!b) return;
    b.classList.add("loading");
    P.jaTinha(b.dataset.jaTinha, b.dataset.aluno).catch(function (er) { b.classList.remove("loading"); P.erro(er); });
  });
  P.aoAbrir("grad", function () { carregarGrad().catch(function (e) { P.erro(e, "Não deu para carregar as graduações"); }); });
  P.aoMudarAlunos(function () { if (P.atual() === "grad") paintGrad(); });
})();

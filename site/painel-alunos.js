/* Painel · Alunos e Graduações: a lista com filtros, o cadastro (novo e editar), a ficha de cada aluno
   (dados, frequência, mensalidades, graus, acesso ao app) e o registro de grau. */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var filtro = "ativos";

  /* ---------- a lista ---------- */
  var FILTROS = [["ativos", "Ativos"], ["sumidos", "Sem treinar"], ["kids", "Kids"], ["inativos", "Inativos"], ["todos", "Todos"]];
  function passa(a, f) {
    return f === "ativos" ? a.ativo : f === "sumidos" ? P.sumido(a) : f === "kids" ? a.ativo && P.kid(a.turma) : f === "inativos" ? !a.ativo : true;
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
      return '<tr data-id="' + a.id + '"' + (a.ativo ? "" : ' class="off"') + '><td><div class="nm"><span class="av">' + P.ini(a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + a.id + '">' + esc(a.nome) + "</button><small>" +
        esc(P.turmaTx(a)) + (a.responsavel ? " · resp. " + esc(P.first(a.responsavel)) : "") + (a.ativo ? "" : " · inativo") + "</small></div></div></td>" +
        "<td>" + P.belt(a.faixa, a.graus) + "</td>" +
        "<td>" + (sum && a.ativo ? '<span class="pill-s warn">' + (u ? "há " + dias + " dias" : "nunca veio") + "</span>" : P.quando(u)) + "</td>" +
        '<td class="num hide-s">' + P.noMes(a.id, mes) + "</td>" +
        '<td class="act"><div class="row-acts">' + (a.whatsapp ? '<button class="mini-btn wa" type="button" data-wa="' + a.id + '">WhatsApp</button>' : "") + "</div></td></tr>";
    }).join("");
    var vazio = $("#alEmpty");
    vazio.hidden = l.length > 0;
    vazio.innerHTML = !P.alunos.length ? "<b>Nenhum aluno cadastrado ainda.</b>Toque em Adicionar aluno para começar. O aluno entra na lista, ganha a mensalidade do mês e, se quiser, o acesso ao app."
      : q ? "Nenhum aluno com “" + esc($("#alQ").value.trim()) + "”." : "Ninguém neste filtro.";
    $("#alTbl").hidden = !l.length;
  }
  $("#alChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-f]"); if (b) { filtro = b.dataset.f; paintLista(); } });
  $("#alQ").addEventListener("input", paintLista);
  $("#alTbl").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ficha) P.abrirAluno(b.dataset.ficha);
    else if (b.dataset.wa) { var a = P.porId[b.dataset.wa]; P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. "); }
  });
  P.aoMudarAlunos(function () { paintLista(); paintGrad(); });
  P.aoAbrir("alunos", function () { P.carregarPresencas().then(paintLista).catch(function () {}); paintLista(); });

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
      '<label class="crm-f f-kid"><span>Nascimento <small>(opcional)</small></span><input class="crm-in" type="date" data-k="nascimento" value="' + v("nascimento") + '"></label>' +
      '<label class="crm-f"><span class="f-fone">WhatsApp</span><input class="crm-in" data-k="whatsapp" inputmode="tel" placeholder="(15) 99999-9999" autocomplete="off" value="' + esc(a.whatsapp ? P.fone(a.whatsapp) : pre.whatsapp ? P.fone(pre.whatsapp) : "") + '"></label>' +
      '<label class="crm-f"><span class="f-mail">E-mail <small>(o login do app)</small></span><input class="crm-in" type="email" data-k="email" autocomplete="off" spellcheck="false" value="' + v("email") + '"></label>' +
      '<label class="crm-f"><span>Faixa</span><select class="sel" data-k="faixa"></select></label>' +
      '<label class="crm-f"><span>Graus</span><select class="sel" data-k="graus">' + [0, 1, 2, 3, 4, 5, 6].map(function (g) { return "<option" + ((a.graus || 0) === g ? " selected" : "") + ">" + g + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Mensalidade (R$)</span><input class="crm-in" data-k="mensalidade" inputmode="decimal" autocomplete="off" value="' + (a.mensalidade != null ? String(a.mensalidade).replace(".", ",") : "") + '"></label>' +
      '<label class="crm-f"><span>Vencimento</span><select class="sel" data-k="vencimento">' + Array.apply(null, Array(28)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + ((a.vencimento || 10) === i + 1 ? " selected" : "") + ">dia " + (i + 1) + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Início no Studio</span><input class="crm-in" type="date" data-k="inicio" value="' + (a.inicio || P.hoje()) + '"></label>' +
      '<label class="crm-f wide"><span>Anotação <small>(opcional)</small></span><textarea class="crm-in" data-k="nota" rows="2">' + v("nota") + "</textarea></label>" +
      "</div>" +
      (a.id ? "" : '<label class="mf-pub"><input type="checkbox" data-k="mens1" checked><span>Lançar a mensalidade deste mês no Financeiro</span></label>' +
        '<label class="mf-pub"><input type="checkbox" data-k="app"' + (pre.email ? " checked" : "") + '><span>Criar o acesso ao app <small>(precisa do e-mail; no Kids, a conta é do responsável)</small></span></label>') +
      '<p class="crm-err" role="alert"></p>' +
      '<div class="msg-acts"><button class="mini-btn" type="submit">' + (a.id ? "Salvar" : "Cadastrar aluno") + '</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>';
  }
  function formSync(f, a) {
    var t = $('[data-k="turma"]', f).value, kid = P.kid(t), hs = P.HORAS[t], h = $('[data-k="horario"]', f), fx = $('[data-k="faixa"]', f), cur = h.value || (a && a.horario) || "", cf = fx.value || (a && a.faixa) || "branca";
    h.innerHTML = '<option value="">Sem horário fixo</option>' + hs.map(function (x) { return '<option value="' + x + '">' + (P.TURMAS[t]) + " " + Site.hora(x) + "</option>"; }).join("");
    h.value = hs.indexOf(cur) >= 0 ? cur : "";
    var fxs = kid ? P.FX_KD : P.FX_AD;
    if (fxs.indexOf(cf) < 0) fxs = fxs.concat([cf]);
    fx.innerHTML = fxs.map(function (x) { return '<option value="' + x + '">' + P.FAIXAS[x] + "</option>"; }).join("");
    fx.value = cf;
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
        responsavel: kid ? (g("responsavel") || null) : null, nascimento: kid ? (g("nascimento") || null) : null,
        whatsapp: P.foneBanco(g("whatsapp")), email: (g("email") || "").toLowerCase() || null,
        faixa: g("faixa"), graus: +g("graus"), mensalidade: val ? P.num(val) : null, vencimento: +g("vencimento"), inicio: g("inicio") || P.hoje(),
        nota: g("nota") || null
      },
      foneTxt: g("whatsapp"), mens1: g("mens1"), app: g("app")
    };
  }
  function validar(f, x) {
    var d = x.d, el = function (k) { return $('[data-k="' + k + '"]', f); };
    if (d.nome.length < 3) return P.erroForm(f, el("nome"), "Digite o nome completo.");
    if (P.kid(d.turma) && (!d.responsavel || d.responsavel.length < 3)) return P.erroForm(f, el("responsavel"), "No Kids, digite o nome do responsável.");
    if (x.foneTxt && !d.whatsapp) return P.erroForm(f, el("whatsapp"), "Confira o WhatsApp: DDD e número, como (15) 99999-9999.");
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return P.erroForm(f, el("email"), "Confira o e-mail.");
    if (x.app && !d.email) return P.erroForm(f, el("email"), "Para criar o acesso ao app, digite o e-mail.");
    if (d.mensalidade !== null && !(d.mensalidade >= 0)) return P.erroForm(f, el("mensalidade"), "Valor da mensalidade em reais, como 200.");
    return true;
  }
  /* a 1ª mensalidade: este mês, no dia do vencimento (se o dia já passou, vence no mês que vem) */
  function primeiraParcela(d) {
    var hoje = P.hoje(), mes = P.mesIni(hoje), venc = mes.slice(0, 8) + P.two(d.vencimento || 10);
    if (venc < hoje) { mes = P.somaMes(mes, 1); venc = mes.slice(0, 8) + P.two(d.vencimento || 10); }
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
  form.addEventListener("change", function (e) { if (e.target.dataset.k === "turma") formSync(form); });
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { form.hidden = true; addBtn.setAttribute("aria-expanded", "false"); P.focusSoft(addBtn); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var x = ler(form);
    if (!validar(form, x)) return;
    var btn = $('[type="submit"]', form);
    btn.classList.add("loading");
    P.q(function (sb) { return sb.from("alunos").insert(x.d).select().single(); }).then(function (novo) {
      var passos = [];
      if (x.mens1 && x.d.mensalidade > 0) {
        var p = primeiraParcela(x.d);
        passos.push(P.q(function (sb) { return sb.from("mensalidades").insert({ aluno: novo.id, competencia: p.competencia, valor: x.d.mensalidade, vencimento: p.vencimento }); }));
      }
      if (x.d.graus || x.d.faixa !== "branca") passos.push(P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: novo.id, faixa: x.d.faixa, graus: x.d.graus, data: x.d.inicio, nota: "Faixa ao entrar no Studio" }); }));
      if (preLead) passos.push(P.q(function (sb) { return sb.from("leads").update({ etapa: "matriculado" }).eq("id", preLead); }), P.q(function (sb) { return sb.from("lead_eventos").insert({ lead: preLead, texto: "Matriculado: cadastro de aluno criado" }); }));
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
    }).catch(function (e) { btn.classList.remove("loading"); P.erro(e, "Não deu para cadastrar"); });
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
    });
  }
  function msgAcesso(a, r) {
    var link = new URL("entrar.html?app", location.href).href;
    return "Oi, " + P.first(P.kid(a.turma) && a.responsavel ? a.responsavel : a.nome) + "! Aqui é do Studio Evolution BJJ. " + (r.reenvio ? "Sua senha nova do app do Studio:" : "Seu acesso ao app do Studio está pronto:") +
      "\n\nEntre em: " + link + "\nE-mail: " + r.email + "\nSenha: " + r.senha + "\n\nNo app você confirma a vaga nas aulas, registra a presença com o código da TV e estuda os movimentos da sua faixa. Depois de entrar, dá para instalar o app na tela do celular.";
  }

  /* ---------- a ficha ---------- */
  function heat(id) {
    /* 12 semanas, de segunda a sábado; a coluna é a semana e a linha o dia */
    var hoje = P.hoje(), d0 = P.dia(hoje), seg = new Date(d0); seg.setDate(d0.getDate() - ((d0.getDay() + 6) % 7) - 7 * 11);
    var dias = {}, h = "";
    P.pres.forEach(function (p) { if (p.aluno === id) dias[p.data] = 1; });
    for (var dd = 0; dd < 6; dd++) for (var w = 0; w < 12; w++) {
      var x = new Date(seg); x.setDate(seg.getDate() + w * 7 + dd);
      var k = P.iso(x);
      h += '<i class="' + (k > hoje ? "f" : dias[k] ? "y" : "") + '" title="' + P.dataBR(k) + (dias[k] ? ": veio" : "") + '"></i>';
    }
    return '<div class="heat-w" role="img" aria-label="Frequência das últimas 12 semanas: ' + Object.keys(dias).filter(function (k) { return k >= P.iso(seg); }).length + ' aulas">' + h + "</div>";
  }
  function statusMens(m) {
    if (m.pago_em) return '<span class="pill-s in">Paga ' + P.dataBR(m.pago_em) + "</span>";
    if (m.vencimento < P.hoje()) return '<span class="pill-s warn">Atrasada desde ' + P.dataBR(m.vencimento) + "</span>";
    return '<span class="pill-s">Vence ' + P.dataBR(m.vencimento) + "</span>";
  }
  P.abrirAluno = function (id, cred) {
    var a = P.porId[id];
    if (!a) return;
    var dr = P.abrirFicha('<p class="muted">Carregando a ficha…</p>', a.nome);
    $("#drSub").textContent = P.turmaTx(a) + " · " + P.beltTxt(a.faixa, a.graus) + (a.ativo ? "" : " · inativo");
    Promise.all([
      P.q(function (sb) { return sb.from("mensalidades").select("*").eq("aluno", id).order("competencia", { ascending: false }).limit(6); }),
      P.q(function (sb) { return sb.from("graduacoes").select("*").eq("aluno", id).order("data", { ascending: false }); })
    ]).then(function (r) {
      var mens = r[0] || [], grads = r[1] || [], pres = P.pres.filter(function (p) { return p.aluno === id; });
      var total = pres.length, desdeGrau = grads.length ? pres.filter(function (p) { return p.data > grads[0].data; }).length : total;
      var idade = a.nascimento ? Math.floor(P.difDias(a.nascimento, P.hoje()) / 365.25) : null;
      var html =
        (cred ? '<div class="cred"><b>Acesso ao app ' + (cred.reenvio ? "com senha nova" : "criado") + "</b><p>E-mail: <code>" + esc(cred.email) + "</code><br>Senha provisória: <code>" + esc(cred.senha) + '</code></p><div class="msg-acts">' +
          (a.whatsapp ? '<button class="mini-btn wa" type="button" data-envia>Mandar pelo WhatsApp</button>' : "") + '<button class="mini-btn ghost" type="button" data-copia>Copiar mensagem</button></div><p class="muted" style="margin-top:6px;font-size:12px">A senha aparece só agora. Depois de entrar, o aluno pode trocar em "Esqueci a senha".</p></div>' : "") +
        '<div class="ficha-sec"><h5>Dados</h5><dl class="ficha-dl">' +
          (a.responsavel ? "<dt>Responsável</dt><dd>" + esc(a.responsavel) + "</dd>" : "") +
          (idade !== null ? "<dt>Idade</dt><dd>" + idade + " anos</dd>" : "") +
          "<dt>WhatsApp</dt><dd>" + (a.whatsapp ? P.fone(a.whatsapp) : "—") + "</dd>" +
          "<dt>E-mail</dt><dd>" + (a.email ? esc(a.email) : "—") + "</dd>" +
          "<dt>App</dt><dd>" + (a.conta ? '<span class="pill-s in">Com acesso</span>' : '<span class="pill-s">Sem acesso</span>') + "</dd>" +
          "<dt>Mensalidade</dt><dd>" + (a.mensalidade != null ? P.brl(a.mensalidade) + " · vence dia " + (a.vencimento || 10) : "—") + "</dd>" +
          "<dt>No Studio desde</dt><dd>" + P.dataBRano(a.inicio) + (a.saida ? " · saiu em " + P.dataBRano(a.saida) : "") + "</dd>" +
          (a.nota ? "<dt>Anotação</dt><dd>" + esc(a.nota) + "</dd>" : "") +
        "</dl></div>" +
        '<div class="ficha-sec"><h5>Frequência · 12 semanas</h5>' + heat(id) + '<p class="muted" style="margin-top:8px;font-size:12px">' + total + (total === 1 ? " aula" : " aulas") + " no último ano · " + desdeGrau + " desde o último grau · última: " + P.quando(P.ultima(id)) + "</p></div>" +
        '<div class="ficha-sec"><h5>Mensalidades</h5>' + (mens.length ? '<ul class="ficha-list">' + mens.map(function (m) { return "<li><span>" + P.mesNome(m.competencia) + " · " + P.brl(m.valor) + "</span>" + statusMens(m) + "</li>"; }).join("") + "</ul>" : '<p class="muted">Nenhuma mensalidade lançada.</p>') + "</div>" +
        '<div class="ficha-sec"><h5>Graduações</h5>' + (grads.length ? '<ul class="ficha-list">' + grads.map(function (g) { return "<li><span>" + P.beltTxt(g.faixa, g.graus) + (g.nota ? " · " + esc(g.nota) : "") + "</span><span>" + P.dataBRano(g.data) + "</span></li>"; }).join("") + "</ul>" : '<p class="muted">Nenhum grau registrado.</p>') + "</div>" +
        '<form class="crm-form" id="frEdit" novalidate hidden></form>' +
        '<div class="ficha-sec msg-acts">' +
          '<button class="mini-btn" type="button" data-edit>Editar dados</button>' +
          '<button class="mini-btn ghost" type="button" data-grau>Registrar grau</button>' +
          (a.whatsapp ? '<button class="mini-btn wa" type="button" data-wa>WhatsApp</button>' : "") +
          (a.email ? '<button class="mini-btn ghost" type="button" data-acesso>' + (a.conta ? "Senha nova do app" : "Criar acesso ao app") + "</button>" : "") +
          '<button class="mini-btn ghost" type="button" data-ativo>' + (a.ativo ? "Desativar aluno" : "Reativar aluno") + "</button>" +
        "</div>";
      $(".dr-body", dr).innerHTML = html;
      var w = function (r) { return msgAcesso(a, r); };
      dr.onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-envia")) P.wa(a.whatsapp, w(cred));
        else if (b.hasAttribute("data-copia")) { navigator.clipboard.writeText(w(cred)).then(function () { P.toast("Mensagem copiada."); }, function () { P.toast("Não deu para copiar."); }); }
        else if (b.hasAttribute("data-wa")) P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. ");
        else if (b.hasAttribute("data-edit")) editar(a, dr);
        else if (b.hasAttribute("data-grau")) P.registrarGrau(a.id);
        else if (b.hasAttribute("data-acesso")) {
          b.classList.add("loading");
          if (a.conta) Acesso.conta({ acao: "nova-senha", email: a.email }).then(function (r) { if (r.ok) { r.reenvio = true; P.abrirAluno(a.id, r); } else { b.classList.remove("loading"); P.toast(r.msg); } });
          else criarAcesso(a, false);
        } else if (b.hasAttribute("data-ativo")) {
          var ativo = !a.ativo;
          P.q(function (sb) { return sb.from("alunos").update({ ativo: ativo, saida: ativo ? null : P.hoje() }).eq("id", a.id); })
            .then(P.carregarAlunos).then(function () { P.toast(P.first(a.nome) + (ativo ? " voltou para os ativos." : " foi para os inativos. O histórico fica guardado.")); P.abrirAluno(a.id); })
            .catch(function (e2) { P.erro(e2); });
        }
      };
    }).catch(function (e) { P.erro(e, "Não deu para abrir a ficha"); });
  };
  function editar(a, dr) {
    var f = $("#frEdit", dr);
    f.innerHTML = formHTML(a);
    formSync(f, a);
    f.hidden = false;
    f.onchange = function (e) { if (e.target.dataset.k === "turma") formSync(f); };
    f.onclick = function (e) { if (e.target.closest("[data-cancel]")) { f.hidden = true; } };
    f.onsubmit = function (e) {
      e.preventDefault();
      var x = ler(f);
      if (!validar(f, x)) return;
      var d = x.d;
      delete d.faixa; delete d.graus;  /* faixa e graus mudam pelo registro de grau (fica o histórico) */
      $('[type="submit"]', f).classList.add("loading");
      P.q(function (sb) { return sb.from("alunos").update(d).eq("id", a.id); }).then(P.carregarAlunos).then(function () { P.toast("Dados de " + P.first(d.nome) + " salvos."); P.abrirAluno(a.id); })
        .catch(function (e2) { $('[type="submit"]', f).classList.remove("loading"); P.erro(e2); });
    };
    $('[data-k="faixa"]', f).disabled = true;
    $('[data-k="graus"]', f).disabled = true;
    $('[data-k="faixa"]', f).closest("label").title = "A faixa muda em Registrar grau";
    f.scrollIntoView({ block: "start", behavior: "smooth" });
    P.focusSoft($('[data-k="nome"]', f), { preventScroll: true });
  }

  /* ---------- Graduações ---------- */
  var ultGrau = {};
  function carregarGrad() {
    return P.todos(function (sb) { return sb.from("graduacoes").select("id, aluno, faixa, graus, data, nota").order("data", { ascending: false }); }).then(function (l) {
      ultGrau = {};
      l.forEach(function (g) { if (!ultGrau[g.aluno]) ultGrau[g.aluno] = g; });
      $("#grHist").innerHTML = l.slice(0, 15).map(function (g) {
        var a = P.porId[g.aluno];
        return "<li><span>" + esc(a ? a.nome : "Aluno removido") + " · " + P.beltTxt(g.faixa, g.graus) + "</span><span>" + P.dataBRano(g.data) + "</span></li>";
      }).join("") || '<li class="muted">Nenhum grau registrado ainda.</li>';
      paintGrad();
    });
  }
  function desde(a) { var g = ultGrau[a.id], ref = g ? g.data : null; return P.pres.filter(function (p) { return p.aluno === a.id && (!ref || p.data > ref); }).length; }
  function paintGrad() {
    var l = P.ativos().map(function (a) { return { a: a, n: desde(a) }; }).sort(function (x, y) { return y.n - x.n; });
    $("#grTbl tbody").innerHTML = l.map(function (x) {
      var g = ultGrau[x.a.id];
      return '<tr><td><div class="nm"><span class="av">' + P.ini(x.a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button><small>" + esc(P.turmaTx(x.a)) + (g ? " · último grau em " + P.dataBRano(g.data) : "") + "</small></div></div></td>" +
        "<td>" + P.belt(x.a.faixa, x.a.graus) + '</td><td class="num">' + x.n + '</td><td class="act"><button class="mini-btn" type="button" data-grau="' + x.a.id + '">Registrar grau</button></td></tr>';
    }).join("");
    $("#grTbl").hidden = !l.length;
    var e = $("#grEmpty");
    e.hidden = !!l.length;
    e.innerHTML = "<b>Nenhum aluno ativo.</b>Cadastre os alunos em Alunos para acompanhar os graus.";
  }
  $("#grTbl").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ficha) P.abrirAluno(b.dataset.ficha);
    if (b.dataset.grau) P.registrarGrau(b.dataset.grau);
  });
  P.registrarGrau = function (id) {
    var a = P.porId[id];
    var fxs = P.kid(a.turma) ? P.FX_KD : P.FX_AD;
    if (fxs.indexOf(a.faixa) < 0) fxs = fxs.concat([a.faixa]);
    var prox = a.graus < 4 ? { f: a.faixa, g: a.graus + 1 } : { f: fxs[Math.min(fxs.indexOf(a.faixa) + 1, fxs.length - 1)], g: 0 };
    var dr = P.abrirFicha('<form class="crm-form" id="grForm" novalidate><p class="fin-k">Hoje: ' + P.beltTxt(a.faixa, a.graus) + '</p><div class="crm-grid">' +
      '<label class="crm-f"><span>Faixa</span><select class="sel" id="gfF">' + fxs.map(function (f) { return '<option value="' + f + '"' + (f === prox.f ? " selected" : "") + ">" + P.FAIXAS[f] + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Graus</span><select class="sel" id="gfG">' + [0, 1, 2, 3, 4, 5, 6].map(function (g) { return "<option" + (g === prox.g ? " selected" : "") + ">" + g + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Data</span><input class="crm-in" type="date" id="gfD" value="' + P.hoje() + '"></label>' +
      '<label class="crm-f wide"><span>Anotação <small>(opcional)</small></span><input class="crm-in" id="gfN" autocomplete="off" placeholder="Ex.: entregue no treino de sexta"></label></div>' +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Registrar</button><button class="mini-btn ghost" type="button" data-dr-x>Cancelar</button></div></form>', "Grau de " + a.nome);
    $("#drSub").textContent = P.turmaTx(a);
    $("#grForm", dr).onsubmit = function (e) {
      e.preventDefault();
      var f = $("#gfF").value, g = +$("#gfG").value, d = $("#gfD").value || P.hoje(), n = $("#gfN").value.trim();
      if (f === a.faixa && g === a.graus) return P.erroForm(e.target, $("#gfG"), "Escolha um grau ou faixa diferente do atual.");
      $('[type="submit"]', e.target).classList.add("loading");
      P.q(function (sb) { return sb.from("graduacoes").insert({ aluno: a.id, faixa: f, graus: g, data: d, nota: n || null }); })
        .then(function () { return Promise.all([P.carregarAlunos(), carregarGrad()]); })
        .then(function () {
          P.fecharFicha();
          P.toast(P.first(a.nome) + ": " + P.beltTxt(f, g).toLowerCase() + ". Parabéns!");
          if (a.whatsapp) setTimeout(function () { P.toast("Quer avisar a família ou o aluno? Abra a ficha e use o WhatsApp."); }, 3800);
        })
        .catch(function (e2) { $('[type="submit"]', e.target).classList.remove("loading"); P.erro(e2, "Não deu para registrar o grau"); });
    };
  };
  P.aoAbrir("grad", function () { carregarGrad().catch(function (e) { P.erro(e, "Não deu para carregar as graduações"); }); });
  P.aoMudarAlunos(function () { if (P.atual() === "grad") paintGrad(); });
})();

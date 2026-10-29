/* Painel · Financeiro: Visão geral (números do mês, meta e gráficos dos últimos 12 meses), Mensalidades (gerar o mês,
   dar baixa, cobrar pelo WhatsApp) e Despesas (lançar, pagar, repetir as fixas). Tudo sai das tabelas mensalidades,
   despesas, metas e alunos; nada é exemplo. */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var MENS = [], DESP = [], METAS = {}, mes = P.mesIni(P.hoje()), aba = "geral", mF = "todas", dF = "todas", ok = false;
  var DCAT = { aluguel: "Aluguel", contas: "Contas (luz, água, internet)", pessoal: "Pessoal", servicos: "Serviços", taxas: "Taxas", marketing: "Marketing", material: "Material", manutencao: "Manutenção", outros: "Outros" };
  var FORMA = { pix: "Pix", boleto: "Boleto", cartao: "Cartão", dinheiro: "Dinheiro" };

  function carregar() {
    return Promise.all([
      P.todos(function (sb) { return sb.from("mensalidades").select("*").order("vencimento"); }),
      P.todos(function (sb) { return sb.from("despesas").select("*").order("data"); }),
      P.q(function (sb) { return sb.from("metas").select("*"); })
    ]).then(function (r) {
      MENS = r[0]; DESP = r[1]; METAS = {};
      (r[2] || []).forEach(function (m) { METAS[m.mes] = m; });
      ok = true;
      paintMeses(); paint();
    });
  }
  function fimMes(m) { return P.somaDias(P.somaMes(m, 1), -1); }
  function doMes(m) { return MENS.filter(function (x) { return x.competencia === m; }); }
  function despMes(m) { return DESP.filter(function (x) { return P.mesIni(x.data) === m; }); }
  function soma(l, f) { return l.reduce(function (a, x) { return a + Number(f ? f(x) : x.valor); }, 0); }
  function atrasada(x) { return !x.pago_em && x.vencimento < P.hoje(); }
  function ativosEm(fim) { return P.alunos.filter(function (a) { return a.inicio <= fim && (!a.saida || a.saida > fim) && (a.ativo || a.saida); }).length; }
  function nome(id) { var a = P.porId[id]; return a ? a.nome : "Aluno removido"; }

  /* o seletor de mês: dos últimos 12 meses até o próximo */
  function paintMeses() {
    var s = $("#fnMes"), l = [];
    for (var i = -11; i <= 1; i++) l.push(P.somaMes(P.mesIni(P.hoje()), i));
    s.innerHTML = l.reverse().map(function (m) { return '<option value="' + m + '"' + (m === mes ? " selected" : "") + ">" + P.mesNome(m) + "</option>"; }).join("");
  }
  $("#fnMes").addEventListener("change", function () { mes = this.value; paint(); });
  /* as três partes */
  var tabs = [["geral", "#ftGeral", "#fpGeral"], ["mens", "#ftMens", "#fpMens"], ["desp", "#ftDesp", "#fpDesp"]];
  function abrirParte(k, foco) {
    aba = k;
    tabs.forEach(function (t) { var on = t[0] === k; $(t[1]).setAttribute("aria-selected", on); $(t[1]).tabIndex = on ? 0 : -1; $(t[2]).hidden = !on; if (on && foco) P.focusSoft($(t[1])); });
    paint();
  }
  tabs.forEach(function (t, i) {
    $(t[1]).addEventListener("click", function () { abrirParte(t[0]); });
    $(t[1]).addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      abrirParte(tabs[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3][0], true);
    });
  });
  function paint() {
    if (!ok) return;
    var atr = MENS.filter(atrasada).length;
    P.selo("bFin", atr);
    $("#fnK").textContent = P.mesNome(mes);
    if (aba === "geral") paintGeral(); else if (aba === "mens") paintMens(); else paintDesp();
  }

  /* ---------- Mensalidades ---------- */
  function statusM(x) {
    if (x.pago_em) return '<span class="pill-s in">Paga ' + P.dataBR(x.pago_em) + (x.forma ? " · " + FORMA[x.forma] : "") + "</span>";
    if (atrasada(x)) return '<span class="pill-s warn">Atrasada há ' + P.difDias(x.vencimento, P.hoje()) + (P.difDias(x.vencimento, P.hoje()) === 1 ? " dia" : " dias") + "</span>";
    return '<span class="pill-s">Vence ' + P.dataBR(x.vencimento) + "</span>";
  }
  function faltam() { return P.ativos().filter(function (a) { return a.mensalidade > 0 && !MENS.some(function (x) { return x.aluno === a.id && x.competencia === mes; }); }); }
  function paintMens() {
    var l = doMes(mes), prev = soma(l), rec = soma(l.filter(function (x) { return x.pago_em; })), atr = soma(l.filter(atrasada)), fal = faltam();
    var vis = l.filter(function (x) { return mF === "todas" || (mF === "pagas" ? x.pago_em : mF === "atrasadas" ? atrasada(x) : !x.pago_em && !atrasada(x)); });
    $("#fpMens").innerHTML =
      '<div class="kpis"><div class="kpi"><b>' + P.brl(prev) + "</b><span>previsto em " + P.mesNome(mes) + "</span></div>" +
      '<div class="kpi"><b>' + P.brl(rec) + "</b><span>recebido</span></div>" +
      '<div class="kpi"><b>' + P.brl(prev - rec - atr) + "</b><span>a receber, no prazo</span></div>" +
      '<div class="kpi warn"><b>' + P.brl(atr) + "</b><span>em atraso</span></div></div>" +
      (fal.length ? '<div class="bi-meta"><div class="head"><p><b>' + fal.length + (fal.length === 1 ? " aluno ativo ainda sem a mensalidade" : " alunos ativos ainda sem a mensalidade") + " de " + P.mesNome(mes) + ".</b> O valor e o dia vêm do cadastro de cada um.</p>" +
        '<button class="mini-btn" type="button" id="mGerar">Lançar as de ' + P.MESES[P.dia(mes).getMonth()] + "</button></div></div>" : "") +
      '<div class="chips" id="mChips">' + [["todas", "Todas"], ["abertas", "A receber"], ["atrasadas", "Atrasadas"], ["pagas", "Pagas"]].map(function (c) { return '<button type="button" data-f="' + c[0] + '" aria-pressed="' + (mF === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div>" +
      (vis.length ? '<table class="tbl"><thead><tr><th scope="col">Aluno</th><th scope="col" class="num">Valor</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        vis.map(function (x) {
          var a = P.porId[x.aluno];
          return '<tr data-id="' + x.id + '"><td><div class="nm"><span class="av">' + P.ini(nome(x.aluno)) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.aluno + '">' + esc(nome(x.aluno)) + "</button><small>vence " + P.dataBRano(x.vencimento) + "</small></div></div></td>" +
            '<td class="num">' + P.brl(x.valor) + "</td><td>" + statusM(x) + '</td><td class="act"><div class="row-acts">' +
            (x.pago_em ? '<button class="mini-btn ghost" type="button" data-desfaz>Desfazer</button>'
              : '<select class="sel" data-forma aria-label="Forma de pagamento">' + Object.keys(FORMA).map(function (k) { return '<option value="' + k + '">' + FORMA[k] + "</option>"; }).join("") + '</select><button class="mini-btn" type="button" data-paga>Recebi</button>' +
                (a && a.whatsapp ? '<button class="mini-btn wa" type="button" data-cobra>WhatsApp</button>' : "")) +
            "</div></td></tr>";
        }).join("") + "</tbody></table>"
        : '<div class="empty-big">' + (l.length ? "Nada neste filtro." : "<b>Nenhuma mensalidade em " + P.mesNome(mes) + ".</b>" + (P.ativos().some(function (a) { return a.mensalidade > 0; }) ? "Toque em Lançar para criar as do mês." : "Cadastre o valor da mensalidade em cada aluno (Alunos → ficha → Editar dados).")) + "</div>") +
      '<p class="fin-how"><b>Como cobrar:</b> as mensalidades saem pelo seu WhatsApp, com a mensagem pronta e a chave Pix do Studio. Quando o aluno pagar, toque em Recebi. A cobrança automática (boleto, Pix e cartão pelo Asaas) é ligada em Configurações quando o Studio tiver a conta.</p>';
  }
  $("#fpMens").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.f) { mF = b.dataset.f; return paintMens(); }
    if (b.id === "mGerar") return gerar(b);
    if (b.dataset.ficha) return P.abrirAluno(b.dataset.ficha);
    var tr = b.closest("tr"), x = tr && MENS.filter(function (m) { return m.id === tr.dataset.id; })[0];
    if (!x) return;
    if (b.hasAttribute("data-paga")) salvarM(x, { pago_em: P.hoje(), forma: $("[data-forma]", tr).value }, b, "Baixa feita: " + P.first(nome(x.aluno)) + ", " + P.brl(x.valor) + ".");
    else if (b.hasAttribute("data-desfaz")) salvarM(x, { pago_em: null, forma: null }, b, "Baixa desfeita.");
    else if (b.hasAttribute("data-cobra")) {
      var a = P.porId[x.aluno], cfg = P.cfg || {};
      P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. " + (atrasada(x) ? "A mensalidade de " + P.mesNome(x.competencia) + " (" + P.brl(x.valor) + ") venceu em " + P.dataBR(x.vencimento) + "." : "Lembrete: a mensalidade de " + P.mesNome(x.competencia) + " (" + P.brl(x.valor) + ") vence em " + P.dataBR(x.vencimento) + ".") +
        (cfg.pix ? " A chave Pix do Studio é " + cfg.pix + "." : "") + " Se já pagou, me manda o comprovante que eu dou baixa. Obrigado!");
    }
  });
  function salvarM(x, d, b, msg) {
    b.classList.add("loading");
    P.q(function (sb) { return sb.from("mensalidades").update(d).eq("id", x.id); }).then(carregar).then(function () { P.toast(msg); }).catch(function (e) { b.classList.remove("loading"); P.erro(e); });
  }
  function gerar(b) {
    var l = faltam().map(function (a) { return { aluno: a.id, competencia: mes, valor: a.mensalidade, vencimento: mes.slice(0, 8) + P.two(a.vencimento || 10) }; });
    b.classList.add("loading");
    P.q(function (sb) { return sb.from("mensalidades").insert(l); }).then(carregar).then(function () { P.toast(l.length + (l.length === 1 ? " mensalidade lançada" : " mensalidades lançadas") + " em " + P.mesNome(mes) + "."); })
      .catch(function (e) { b.classList.remove("loading"); P.erro(e, "Não deu para lançar"); });
  }

  /* ---------- Despesas ---------- */
  function paintDesp() {
    var l = despMes(mes), tot = soma(l), fix = soma(l.filter(function (x) { return x.recorrente; })), pg = soma(l.filter(function (x) { return x.paga; }));
    var ant = P.somaMes(mes, -1), rep = despMes(ant).filter(function (x) { return x.recorrente && !l.some(function (y) { return y.recorrente && y.descricao === x.descricao; }); });
    var vis = l.filter(function (x) { return dF === "todas" || (dF === "pagar" ? !x.paga : x.categoria === dF); });
    $("#fpDesp").innerHTML =
      '<div class="kpis"><div class="kpi"><b>' + P.brl(tot) + "</b><span>despesas em " + P.mesNome(mes) + "</span></div>" +
      '<div class="kpi"><b>' + P.brl(fix) + "</b><span>fixas (todo mês)</span></div>" +
      '<div class="kpi"><b>' + P.brl(pg) + "</b><span>pagas</span></div>" +
      '<div class="kpi warn"><b>' + P.brl(tot - pg) + "</b><span>a pagar</span></div></div>" +
      (rep.length ? '<div class="bi-meta"><div class="head"><p><b>' + rep.length + (rep.length === 1 ? " despesa fixa" : " despesas fixas") + " de " + P.mesNome(ant) + "</b> ainda não lançada" + (rep.length === 1 ? "" : "s") + " em " + P.mesNome(mes) + " (" + P.brl(soma(rep)) + ").</p>" +
        '<button class="mini-btn" type="button" id="dRepete">Repetir as fixas</button></div></div>' : "") +
      '<div class="crm-bar"><div class="chips" id="dChips">' + [["todas", "Todas"], ["pagar", "A pagar"]].concat(Object.keys(DCAT).filter(function (k) { return l.some(function (x) { return x.categoria === k; }); }).map(function (k) { return [k, DCAT[k].split(" (")[0]]; }))
        .map(function (c) { return '<button type="button" data-f="' + c[0] + '" aria-pressed="' + (dF === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div>" +
      '<button class="mini-btn crm-add" type="button" id="dAdd" aria-expanded="false"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Lançar despesa</button></div>' +
      '<form class="crm-form" id="dForm" novalidate hidden><p class="fin-k">Nova despesa</p><div class="crm-grid">' +
        '<label class="crm-f"><span>Descrição</span><input class="crm-in" id="dfDesc" autocomplete="off" placeholder="Ex.: Aluguel da sala"></label>' +
        '<label class="crm-f"><span>Categoria</span><select class="sel" id="dfCat">' + Object.keys(DCAT).map(function (k) { return '<option value="' + k + '">' + DCAT[k] + "</option>"; }).join("") + "</select></label>" +
        '<label class="crm-f"><span>Valor (R$)</span><input class="crm-in" id="dfValor" inputmode="decimal" autocomplete="off" placeholder="0,00"></label>' +
        '<label class="crm-f"><span>Vencimento</span><input class="crm-in" id="dfData" type="date" value="' + (mes === P.mesIni(P.hoje()) ? P.hoje() : mes) + '"></label></div>' +
        '<label class="mf-pub"><input type="checkbox" id="dfRec"><span>Despesa fixa <small>(se repete todo mês)</small></span></label>' +
        '<label class="mf-pub"><input type="checkbox" id="dfPaga"><span>Já está paga</span></label>' +
        '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar despesa</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div></form>' +
      (vis.length ? '<table class="tbl"><thead><tr><th scope="col">Despesa</th><th scope="col" class="num">Valor</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        vis.map(function (x) {
          return '<tr data-id="' + x.id + '"><td>' + esc(x.descricao) + "<small>" + DCAT[x.categoria] + (x.recorrente ? " · fixa" : "") + "</small></td>" +
            '<td class="num">' + P.brl(x.valor) + "</td><td>" + (x.paga ? '<span class="pill-s in">Paga</span>' : x.data < P.hoje() ? '<span class="pill-s warn">Venceu ' + P.dataBR(x.data) + "</span>" : '<span class="pill-s">Vence ' + P.dataBR(x.data) + "</span>") + "</td>" +
            '<td class="act"><div class="row-acts">' + (x.paga ? '<button class="mini-btn ghost" type="button" data-npaga>Desfazer</button>' : '<button class="mini-btn" type="button" data-paga>Paguei</button>') +
            '<button class="mini-btn ghost" type="button" data-apaga>Apagar</button></div></td></tr>';
        }).join("") + "</tbody></table>" : '<div class="empty-big">' + (l.length ? "Nada neste filtro." : "<b>Nenhuma despesa em " + P.mesNome(mes) + ".</b>Lance aluguel, contas, salários e o resto: o resultado do mês e os gráficos usam esses valores.") + "</div>");
  }
  $("#fpDesp").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var f = $("#dForm");
    if (b.dataset.f) { dF = b.dataset.f; return paintDesp(); }
    if (b.id === "dAdd") { f.hidden = !f.hidden; b.setAttribute("aria-expanded", !f.hidden); if (!f.hidden) { P.aparece(f); P.focusSoft($("#dfDesc")); } return; }
    if (b.hasAttribute("data-cancel")) { f.hidden = true; $("#dAdd").setAttribute("aria-expanded", "false"); return; }
    if (b.id === "dRepete") {
      var ant = P.somaMes(mes, -1), l = despMes(mes), rep = despMes(ant).filter(function (x) { return x.recorrente && !l.some(function (y) { return y.recorrente && y.descricao === x.descricao; }); });
      b.classList.add("loading");
      return P.q(function (sb) { return sb.from("despesas").insert(rep.map(function (x) { var d = P.dia(x.data).getDate(), ult = P.dia(fimMes(mes)).getDate(); return { descricao: x.descricao, categoria: x.categoria, valor: x.valor, recorrente: true, paga: false, data: mes.slice(0, 8) + P.two(Math.min(d, ult)) }; })); })
        .then(carregar).then(function () { P.toast(rep.length + (rep.length === 1 ? " despesa fixa repetida." : " despesas fixas repetidas.")); }).catch(function (er) { b.classList.remove("loading"); P.erro(er); });
    }
    var tr = b.closest("tr"), x = tr && DESP.filter(function (d) { return d.id === tr.dataset.id; })[0];
    if (!x) return;
    if (b.hasAttribute("data-paga") || b.hasAttribute("data-npaga")) {
      var pg = b.hasAttribute("data-paga");
      b.classList.add("loading");
      P.q(function (sb) { return sb.from("despesas").update({ paga: pg }).eq("id", x.id); }).then(carregar).then(function () { P.toast(pg ? "Despesa paga: " + x.descricao + "." : "Voltou para a pagar."); }).catch(function (er) { b.classList.remove("loading"); P.erro(er); });
    } else if (b.hasAttribute("data-apaga")) {
      if (b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Apagar mesmo?"; setTimeout(function () { if (document.contains(b)) { b.dataset.certo = ""; b.textContent = "Apagar"; } }, 4000); return; }
      P.q(function (sb) { return sb.from("despesas").delete().eq("id", x.id); }).then(carregar).then(function () { P.toast("Despesa apagada."); }).catch(function (er) { P.erro(er); });
    }
  });
  $("#fpDesp").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, desc = $("#dfDesc").value.trim(), v = P.num($("#dfValor").value), dt = $("#dfData").value;
    if (desc.length < 2) return P.erroForm(f, $("#dfDesc"), "Digite a descrição.");
    if (!(v > 0)) return P.erroForm(f, $("#dfValor"), "Digite o valor, como 1.250,00.");
    if (!dt) return P.erroForm(f, $("#dfData"), "Escolha a data de vencimento.");
    $('[type="submit"]', f).classList.add("loading");
    P.q(function (sb) { return sb.from("despesas").insert({ descricao: desc, categoria: $("#dfCat").value, valor: v, data: dt, recorrente: $("#dfRec").checked, paga: $("#dfPaga").checked }); })
      .then(function () { if (P.mesIni(dt) !== mes) { mes = P.mesIni(dt); paintMeses(); } return carregar(); })
      .then(function () { P.toast("Despesa lançada: " + desc + ", " + P.brl(v) + "."); })
      .catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er); });
  });

  /* ---------- Visão geral ---------- */
  function paintGeral() {
    var l = doMes(mes), prev = soma(l), rec = soma(l.filter(function (x) { return x.pago_em; })), atr = soma(l.filter(atrasada));
    var dl = despMes(mes), desp = soma(dl), dpg = soma(dl.filter(function (x) { return x.paga; }));
    var fim = fimMes(mes), ati = ativosEm(fim), ent = P.alunos.filter(function (a) { return P.mesIni(a.inicio) === mes; }).length, sai = P.alunos.filter(function (a) { return a.saida && P.mesIni(a.saida) === mes; }).length;
    var pag = l.length, tic = pag ? prev / pag : 0, res = rec - desp, meta = METAS[mes] || null, mNome = P.MESES[P.dia(mes).getMonth()];
    var g = $("#fpGeral");
    g.classList.add("viz");
    g.innerHTML =
      '<div class="kpis bi-kpis">' +
        '<div class="kpi"><span class="bi-l">Recebido em ' + mNome + "</span><b>" + P.brl(rec) + "</b><span>de " + P.brl(prev) + " previstos</span></div>" +
        '<div class="kpi"><span class="bi-l">Despesas de ' + mNome + "</span><b>" + P.brl(desp) + "</b><span>" + P.brl(dpg) + " pagas · " + P.brl(desp - dpg) + " a pagar</span></div>" +
        '<div class="kpi"><span class="bi-l">Resultado</span><b>' + P.brl(res) + "</b><span>recebido menos despesas" + (rec ? " · margem de " + Math.round(res / rec * 100) + "%" : "") + "</span></div>" +
        '<div class="kpi"><span class="bi-l">Alunos ativos</span><b>' + ati + "</b><span>+" + ent + (ent === 1 ? " entrou" : " entraram") + " · " + sai + (sai === 1 ? " saiu" : " saíram") + "</span></div>" +
        '<div class="kpi"><span class="bi-l">Ticket médio</span><b>' + P.brl(Math.round(tic)) + "</b><span>por mensalidade, no mês</span></div>" +
        '<button class="kpi" type="button" id="biInad"><span class="bi-l">Inadimplência</span><b>' + (prev ? (atr / prev * 100).toFixed(1).replace(".", ",") + "%" : "0%") + "</b><span>" + P.brl(atr) + " em atraso</span></button>" +
      "</div>" +
      '<div class="bi-meta" id="biMeta"></div>' +
      '<div class="bi-grid">' +
        '<figure class="bi-card wide"><figcaption><h4>Receita e despesas</h4><p>Recebido por mês (pela competência) e despesas lançadas, nos últimos 12 meses.</p></figcaption><div class="viz-leg"><span><i class="ln in"></i>Receita</span><span><i class="ln out"></i>Despesas</span>' + (meta && meta.receita ? '<span><i class="ln meta"></i>Meta</span>' : "") + '</div><div class="viz-plot" id="vRec" tabindex="0" role="img"></div><details class="viz-tab"><summary>Ver em tabela</summary><div class="tbl-wrap" id="tRec"></div></details></figure>' +
        '<figure class="bi-card"><figcaption><h4>Alunos que entraram e saíram</h4><p>Pelo início no Studio e pela data em que o aluno saiu.</p></figcaption><div class="viz-leg"><span><i class="sw in"></i>Entraram</span><span><i class="sw out"></i>Saíram</span></div><div class="viz-plot" id="vAlu" tabindex="0" role="img"></div><details class="viz-tab"><summary>Ver em tabela</summary><div class="tbl-wrap" id="tAlu"></div></details></figure>' +
        '<figure class="bi-card"><figcaption><h4>Alunos ativos</h4><p>No fim de cada mês.</p></figcaption><div class="viz-leg"><span><i class="ln in"></i>Alunos ativos</span>' + (meta && meta.alunos ? '<span><i class="ln meta"></i>Meta</span>' : "") + '</div><div class="viz-plot" id="vAti" tabindex="0" role="img"></div><details class="viz-tab"><summary>Ver em tabela</summary><div class="tbl-wrap" id="tAti"></div></details></figure>' +
        '<figure class="bi-card wide"><figcaption><h4>Despesas de ' + mNome + ' por categoria</h4><p>De onde sai o dinheiro do Studio.</p></figcaption><ul class="hbars" id="vCat"></ul></figure>' +
      "</div>";
    paintMeta(meta, rec, prev, ati);
    graficos(meta);
  }
  function paintMeta(meta, rec, prev, ati) {
    var box = $("#biMeta"), mNome = P.MESES[P.dia(mes).getMonth()];
    if (!meta || (!meta.receita && !meta.alunos)) {
      box.innerHTML = '<div class="head"><p><b>Meta de ' + mNome + ":</b> ainda não definida. Diga quanto o Studio quer faturar e quantos alunos quer ter; o painel acompanha e mostra a linha da meta nos gráficos.</p>" +
        '<button class="mini-btn" type="button" id="metaEd">Definir meta</button></div>';
    } else {
      var pr = meta.receita ? Math.min(100, rec / meta.receita * 100) : 0, pa = meta.alunos ? Math.min(100, ati / meta.alunos * 100) : 0;
      box.innerHTML = '<div class="head"><p><b>Meta de ' + mNome + "</b></p>" + '<button class="mini-btn ghost" type="button" id="metaEd">Mudar</button></div>' +
        '<div class="meters">' +
        (meta.receita ? '<div class="meter"><div class="meter-h"><span>Receita recebida</span><b>' + P.brl(rec) + " de " + P.brl(meta.receita) + '</b></div><div class="meter-t"><i style="width:' + pr + '%"></i></div><p class="muted" style="font-size:12px;margin-top:6px">' + (rec >= meta.receita ? "Meta batida!" : "Faltam " + P.brl(meta.receita - rec) + ". Com o que ainda vai entrar (" + P.brl(prev - rec) + "), chega a " + Math.round(prev / meta.receita * 100) + "% da meta.") + "</p></div>" : "") +
        (meta.alunos ? '<div class="meter"><div class="meter-h"><span>Alunos ativos</span><b>' + ati + " de " + meta.alunos + '</b></div><div class="meter-t"><i style="width:' + pa + '%"></i></div><p class="muted" style="font-size:12px;margin-top:6px">' + (ati >= meta.alunos ? "Meta batida!" : "Faltam " + (meta.alunos - ati) + (meta.alunos - ati === 1 ? " aluno." : " alunos.")) + "</p></div>" : "") +
        "</div>";
    }
  }
  $("#fpGeral").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.id === "biInad") { mF = "atrasadas"; abrirParte("mens"); return; }
    if (b.id === "metaEd") {
      var m = METAS[mes] || {}, box = $("#biMeta");
      box.innerHTML = '<form class="crm-form" id="metaF" novalidate style="margin:0;padding:0;background:none"><p class="fin-k">Meta de ' + P.mesNome(mes) + '</p><div class="crm-grid">' +
        '<label class="crm-f"><span>Receita (R$)</span><input class="crm-in" id="mtR" inputmode="decimal" value="' + (m.receita ? String(m.receita).replace(".", ",") : "") + '"></label>' +
        '<label class="crm-f"><span>Alunos ativos</span><input class="crm-in" id="mtA" inputmode="numeric" value="' + (m.alunos || "") + '"></label></div>' +
        '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar meta</button><button class="mini-btn ghost" type="button" id="metaX">Cancelar</button>' + (m.mes ? '<button class="mini-btn ghost" type="button" id="metaDel">Tirar a meta</button>' : "") + "</div></form>";
      P.focusSoft($("#mtR"));
      return;
    }
    if (b.id === "metaX") return paint();
    if (b.id === "metaDel") return P.q(function (sb) { return sb.from("metas").delete().eq("mes", mes); }).then(carregar).then(function () { P.toast("Meta removida."); }).catch(function (er) { P.erro(er); });
  });
  $("#fpGeral").addEventListener("submit", function (e) {
    e.preventDefault();
    var r = $("#mtR").value.trim() ? P.num($("#mtR").value) : null, a = $("#mtA").value.trim() ? parseInt(P.digitos($("#mtA").value), 10) : null;
    if (r !== null && !(r > 0)) return P.erroForm(e.target, $("#mtR"), "Digite a receita em reais, como 12.000.");
    if (r === null && !a) return P.erroForm(e.target, $("#mtR"), "Preencha a receita, os alunos ou os dois.");
    P.q(function (sb) { return sb.from("metas").upsert({ mes: mes, receita: r, alunos: a }); }).then(carregar).then(function () { P.toast("Meta de " + P.mesNome(mes) + " salva."); }).catch(function (er) { P.erro(er); });
  });

  /* ---------- gráficos: SVG na largura real, com dica (mouse, dedo e setas) e tabela ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function passo(max, nTicks, inteiro) {
    var e = Math.pow(10, Math.floor(Math.log10(Math.max(max, 1) / nTicks))), c = inteiro && e < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
    if (inteiro) e = Math.max(1, e);  /* contagem de pessoas: o passo nunca é menor que 1 */
    for (var i = 0; i < c.length; i++) if (Math.ceil(max / (c[i] * e)) <= nTicks) return c[i] * e;
    return 10 * e;
  }
  function el(tag, at, txt) { var x = document.createElementNS(NS, tag); for (var k in at) x.setAttribute(k, at[k]); if (txt !== undefined) x.textContent = txt; return x; }
  function dica(box) { var t = $(".viz-tip", box); if (!t) { t = document.createElement("div"); t.className = "viz-tip"; t.hidden = true; box.appendChild(t); } return t; }
  function dicaShow(box, x, titulo, linhas) {
    var t = dica(box);
    t.textContent = "";
    var h = document.createElement("span"); h.className = "t"; h.textContent = titulo; t.appendChild(h);
    linhas.forEach(function (l) {
      var r = document.createElement("span"), k = document.createElement("i"), b = document.createElement("b"), n = document.createElement("span");
      r.className = "r"; b.textContent = l.v; n.textContent = l.n;
      if (l.c) { k.style.borderColor = "var(--s-" + l.c + ")"; r.appendChild(k); }
      r.appendChild(b); r.appendChild(n); t.appendChild(r);
    });
    t.hidden = false;
    var w = t.offsetWidth, bw = box.clientWidth;
    t.style.left = Math.max(0, Math.min(bw - w, x + 14 > bw - w ? x - w - 14 : x + 14)) + "px";
    t.style.top = "6px";
  }
  function semDados(box, txt) { box.innerHTML = '<p class="muted" style="padding:26px 0;text-align:center;font-size:13px">' + txt + "</p>"; box.removeAttribute("tabindex"); }
  function vizLinha(box, c) {
    var W = box.clientWidth;
    if (!W) return;
    var curto = W < 520, H = curto ? 200 : 230, m = { l: curto ? 46 : 54, r: 14, t: 22, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = c.rot.length;
    var todos = [].concat.apply([], c.series.map(function (s) { return s.v; })).concat(c.ref ? [c.ref.v] : []);
    var mx = Math.max.apply(null, todos);
    if (!(mx > 0)) return semDados(box, c.vazio);
    var st = passo(mx * 1.04, 4, c.inteiro), top = st * Math.ceil(mx * 1.04 / st);
    var X = function (i) { return m.l + i * iw / (n - 1); }, Y = function (v) { return m.t + ih - v / top * ih; };
    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    for (var v = 0; v <= top + 0.001; v += st) {
      svg.appendChild(el("line", { class: v ? "grid" : "base", x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
      svg.appendChild(el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, c.tick(v)));
    }
    var cada = curto ? 2 : 1;
    c.rot.forEach(function (r, i) { if (i % cada === (n - 1) % cada || i === n - 1) svg.appendChild(el("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, r.split("/")[0])); });
    if (c.ref) {
      svg.appendChild(el("line", { class: "ref", x1: m.l, x2: W - m.r, y1: Y(c.ref.v), y2: Y(c.ref.v) }));
      svg.appendChild(el("text", { x: m.l + 6, y: Y(c.ref.v) - 6 }, c.ref.n));
    }
    var u = n - 1;
    c.series.forEach(function (s, k) {
      svg.appendChild(el("polyline", { class: "ln " + s.c, points: s.v.map(function (v2, i) { return X(i) + "," + Y(v2); }).join(" ") }));
      svg.appendChild(el("circle", { class: "dot " + s.c, cx: X(u), cy: Y(s.v[u]), r: 4 }));
      var acima = k === 0 || s.v[u] >= c.series[0].v[u];
      svg.appendChild(el("text", { class: "val", x: X(u), y: Y(s.v[u]) + (acima ? -10 : 18), "text-anchor": "middle" }, c.fmt(s.v[u])));
    });
    var cruz = el("line", { class: "cross", x1: 0, x2: 0, y1: m.t - 14, y2: m.t + ih, visibility: "hidden" });
    svg.appendChild(cruz);
    box.textContent = "";
    box.appendChild(svg);
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-label", c.resumo);
    var at = -1;
    function mostra(i) {
      at = Math.max(0, Math.min(n - 1, i));
      cruz.setAttribute("x1", X(at)); cruz.setAttribute("x2", X(at)); cruz.setAttribute("visibility", "visible");
      dicaShow(box, X(at), c.rotLongo[at], c.series.map(function (s) { return { c: s.c, v: c.fmt(s.v[at]), n: s.n }; }));
    }
    function some() { at = -1; cruz.setAttribute("visibility", "hidden"); dica(box).hidden = true; }
    svg.addEventListener("pointermove", function (e) { var r = svg.getBoundingClientRect(); mostra(Math.round((e.clientX - r.left - m.l) / iw * (n - 1))); });
    svg.addEventListener("pointerleave", some);
    box.onkeydown = function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); mostra(at < 0 ? n - 1 : at + (e.key === "ArrowRight" ? 1 : -1)); }
      else if (e.key === "Escape") some();
    };
    box.onblur = some;
  }
  function barra(x, y0, y1, w, cima) {
    var h = Math.abs(y1 - y0), r = Math.min(4, h, w / 2);
    if (h < 0.5) return "";
    return cima ? "M" + x + "," + y0 + "V" + (y1 + r) + "Q" + x + "," + y1 + " " + (x + r) + "," + y1 + "H" + (x + w - r) + "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 + r) + "V" + y0 + "Z"
      : "M" + x + "," + y0 + "V" + (y1 - r) + "Q" + x + "," + y1 + " " + (x + r) + "," + y1 + "H" + (x + w - r) + "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 - r) + "V" + y0 + "Z";
  }
  function vizDiv(box, c) {
    var W = box.clientWidth;
    if (!W) return;
    var up = Math.max.apply(null, c.up), dn = Math.max.apply(null, c.dn);
    if (!(up + dn > 0)) return semDados(box, c.vazio);
    var curto = W < 520, H = curto ? 200 : 230, m = { l: 34, r: 10, t: 18, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = c.rot.length;
    var st = passo(up + dn, 4, true), tu = Math.max(st, st * Math.ceil(up / st)), td = Math.max(st, st * Math.ceil(dn / st));
    var Y = function (v) { return m.t + (tu - v) / (tu + td) * ih; }, slot = iw / n, bw = Math.min(24, slot * 0.56), y0 = Y(0);
    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    for (var v = -td; v <= tu + 0.001; v += st) {
      svg.appendChild(el("line", { class: v ? "grid" : "base", x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
      svg.appendChild(el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"));
    }
    var cols = c.rot.map(function (r, i) {
      var x = m.l + i * slot + (slot - bw) / 2, g = el("g", {});
      var pu = barra(x, y0 - 1, Y(c.up[i]), bw, true), pd = barra(x, y0 + 1, Y(-c.dn[i]), bw, false);
      if (pu) g.appendChild(el("path", { class: "bar in", d: pu }));
      if (pd) g.appendChild(el("path", { class: "bar out", d: pd }));
      if ((curto ? i % 2 === (n - 1) % 2 : true) || i === n - 1) svg.appendChild(el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle" }, r.split("/")[0]));
      svg.appendChild(g);
      return { g: g, x: x + bw / 2 };
    });
    box.textContent = "";
    box.appendChild(svg);
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-label", c.resumo);
    var at = -1;
    function mostra(i) {
      at = Math.max(0, Math.min(n - 1, i));
      box.classList.add("hov");
      cols.forEach(function (k, j) { $$(".bar", k.g).forEach(function (b) { b.classList.toggle("on", j === at); }); });
      var sd = c.up[at] - c.dn[at];
      dicaShow(box, cols[at].x, c.rotLongo[at], [{ c: "in", v: String(c.up[at]), n: c.up[at] === 1 ? "entrou" : "entraram" }, { c: "out", v: String(c.dn[at]), n: c.dn[at] === 1 ? "saiu" : "saíram" }, { v: (sd > 0 ? "+" : sd < 0 ? "−" : "") + Math.abs(sd), n: "saldo do mês" }]);
    }
    function some() { at = -1; box.classList.remove("hov"); cols.forEach(function (k) { $$(".bar", k.g).forEach(function (b) { b.classList.remove("on"); }); }); dica(box).hidden = true; }
    svg.addEventListener("pointermove", function (e) { var r = svg.getBoundingClientRect(); mostra(Math.floor((e.clientX - r.left - m.l) / slot)); });
    svg.addEventListener("pointerleave", some);
    box.onkeydown = function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); mostra(at < 0 ? n - 1 : at + (e.key === "ArrowRight" ? 1 : -1)); }
      else if (e.key === "Escape") some();
    };
    box.onblur = some;
  }
  function tabela(cab, linhas) {
    return '<table class="tbl"><thead><tr>' + cab.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (l) { return "<tr>" + l.map(function (x, i) { return "<td" + (i ? ' class="num"' : "") + ">" + x + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }
  function mil(v) { return v >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : "R$ " + Math.round(v); }
  function graficos(meta) {
    var meses = [];
    for (var i = 11; i >= 0; i--) meses.push(P.somaMes(mes, -i));
    var rot = meses.map(P.mesCurto), rotL = meses.map(P.mesNome);
    var R = meses.map(function (m) { return soma(doMes(m).filter(function (x) { return x.pago_em; })); }), D = meses.map(function (m) { return soma(despMes(m)); });
    var E = meses.map(function (m) { return P.alunos.filter(function (a) { return P.mesIni(a.inicio) === m; }).length; }), S = meses.map(function (m) { return P.alunos.filter(function (a) { return a.saida && P.mesIni(a.saida) === m; }).length; });
    var A = meses.map(function (m) { return ativosEm(fimMes(m)); });
    vizLinha($("#vRec"), { rot: rot, rotLongo: rotL, series: [{ n: "receita", c: "in", v: R }, { n: "despesas", c: "out", v: D }], fmt: mil, tick: mil, ref: meta && meta.receita ? { v: +meta.receita, n: "meta " + mil(+meta.receita) } : null,
      resumo: "Receita e despesas dos últimos 12 meses. Em " + rotL[11] + ": receita " + P.brl(R[11]) + ", despesas " + P.brl(D[11]) + ".", vazio: "Os valores aparecem aqui quando houver mensalidades pagas ou despesas lançadas." });
    $("#tRec").innerHTML = tabela(["Mês", "Receita", "Despesas", "Resultado"], meses.map(function (m, i) { return [rotL[i], P.brl(R[i]), P.brl(D[i]), P.brl(R[i] - D[i])]; }));
    vizDiv($("#vAlu"), { rot: rot, rotLongo: rotL, up: E, dn: S, resumo: "Alunos que entraram e saíram por mês. Em " + rotL[11] + ": " + E[11] + " entraram, " + S[11] + " saíram.", vazio: "Aparece quando houver alunos cadastrados." });
    $("#tAlu").innerHTML = tabela(["Mês", "Entraram", "Saíram", "Saldo"], meses.map(function (m, i) { return [rotL[i], E[i], S[i], E[i] - S[i]]; }));
    vizLinha($("#vAti"), { rot: rot, rotLongo: rotL, series: [{ n: "alunos ativos", c: "in", v: A }], inteiro: true, fmt: String, tick: function (v) { return String(v); }, ref: meta && meta.alunos ? { v: meta.alunos, n: "meta " + meta.alunos } : null,
      resumo: "Alunos ativos no fim de cada mês. Em " + rotL[11] + ": " + A[11] + ".", vazio: "Aparece quando houver alunos cadastrados." });
    $("#tAti").innerHTML = tabela(["Mês", "Alunos ativos"], meses.map(function (m, i) { return [rotL[i], A[i]]; }));
    var dl = despMes(mes), tot = soma(dl), cats = Object.keys(DCAT).map(function (k) { return [k, soma(dl.filter(function (x) { return x.categoria === k; }))]; }).filter(function (c) { return c[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    $("#vCat").innerHTML = cats.length ? cats.map(function (c) { return "<li><span>" + DCAT[c[0]] + " · " + Math.round(c[1] / tot * 100) + '%</span><span class="tr"><i style="width:' + Math.max(1, c[1] / cats[0][1] * 100) * 0.82 + '%"></i><b>' + P.brl(c[1]) + "</b></span></li>"; }).join("")
      : '<li class="muted">Nenhuma despesa lançada neste mês.</li>';
  }
  var rz;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (P.atual() === "fin" && aba === "geral" && ok) paintGeral(); }, 200); });

  P.aoAbrir("fin", function () { carregar().catch(function (e) { P.erro(e, "Não deu para carregar o Financeiro"); }); });
  P.aoMudarAlunos(function () { if (P.atual() === "fin") paint(); });
  window.addEventListener("load", function () {
    P.q(function (sb) { return sb.from("mensalidades").select("id, vencimento, pago_em").is("pago_em", null).lt("vencimento", P.hoje()); }).then(function (l) { P.selo("bFin", (l || []).length); }).catch(function () {});
  });
})();

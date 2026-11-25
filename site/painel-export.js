/* Painel · Exportar dados: planilhas (CSV) de alunos, mensalidades, presenças, graduações, interessados e despesas,
   para o contador, para conferir no Excel/Google Planilhas ou para levar a outro sistema. Separador ";" e acentos
   em UTF-8 (com BOM), como o Excel em português abre direto. Só o professor dono exporta: é uma ação sensível. */
(function () {
  var $ = P.$, esc = P.esc;
  var box = $("#expBox");
  if (!box) return;

  /* ---------- montar o CSV ---------- */
  function celula(v) {
    if (v === null || v === undefined) return "";
    var s = String(v);
    /* texto que começa com = + - @ vira fórmula no Excel: um apóstrofo na frente mantém como texto */
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(cab, linhas) {
    return "﻿" + [cab].concat(linhas).map(function (l) { return l.map(celula).join(";"); }).join("\r\n") + "\r\n";
  }
  function baixar(nome, texto) {
    var url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var dt = function (iso) { return iso ? P.dataBRano(iso) : ""; };
  var reais = function (v) { return v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2).replace(".", ","); };
  var hora = function (ts) { return ts ? P.hm(ts) : ""; };
  var nome = function (id) { var a = P.porId[id]; return a ? a.nome : "Aluno removido"; };
  var turma = function (a) { return (P.TURMAS[a.turma] || a.turma || "") + (a.horario ? " " + Site.hora(a.horario) : ""); };

  var TIPOS = {
    alunos: { tx: "Alunos", f: function () {
      return P.carregarAlunos().then(function () {
        return csv(["Nome", "Turma", "Faixa", "Graus", "Nascimento", "WhatsApp", "E-mail", "Responsável", "Mensalidade (R$)", "Vence no dia", "Início", "Situação", "Última aula", "Autorização do responsável"],
          P.alunos.map(function (a) {
            return [a.nome, turma(a), P.FAIXAS[a.faixa] || a.faixa, a.graus || 0, dt(a.nascimento), a.whatsapp ? P.fone(a.whatsapp) : "", a.email || "", a.responsavel || "",
              reais(a.mensalidade), a.vencimento || "", dt(a.inicio), a.ativo ? "Ativo" : "Inativo", dt(P.ultima(a.id)), a.consentimento_em ? dt(a.consentimento_em) : ""];
          }));
      });
    } },
    mensalidades: { tx: "Mensalidades", f: function () {
      var hoje = P.hoje();
      return P.todos(function (sb) { return sb.from("mensalidades").select("*").order("competencia").order("vencimento"); }).then(function (l) {
        return csv(["Aluno", "Mês", "Valor (R$)", "Vencimento", "Pago em", "Forma", "Situação", "Anotação"],
          l.map(function (m) {
            var c = String(m.competencia || "").split("-");
            return [nome(m.aluno), c.length > 1 ? c[1] + "/" + c[0] : "", reais(m.valor), dt(m.vencimento), dt(m.pago_em), m.forma || "",
              m.pago_em ? "Paga" : m.vencimento < hoje ? "Atrasada" : "A vencer", m.nota || ""];
          }));
      });
    } },
    presencas: { tx: "Presenças", f: function () {
      return P.todos(function (sb) { return sb.from("presencas").select("aluno, data, hora, turma, como, chegou_em").order("data").order("hora"); }).then(function (l) {
        var T = { adulto: "Adulto", kids1: "Kids 1", kids2: "Kids 2", openmat: "Open Mat" };
        return csv(["Data", "Aula", "Turma", "Aluno", "Chegou às", "Como"],
          l.map(function (p) { return [dt(p.data), p.hora ? Site.hora(p.hora) : "", T[p.turma] || p.turma || "", nome(p.aluno), hora(p.chegou_em), p.como === "professor" ? "Marcado pelo professor" : "App"]; }));
      });
    } },
    graduacoes: { tx: "Graduações", f: function () {
      return P.todos(function (sb) { return sb.from("graduacoes").select("aluno, faixa, graus, data, nota").order("data"); }).then(function (l) {
        return csv(["Data", "Aluno", "Faixa", "Graus", "Anotação"], l.map(function (g) { return [dt(g.data), nome(g.aluno), P.FAIXAS[g.faixa] || g.faixa, g.graus || 0, g.nota || ""]; }));
      });
    } },
    interessados: { tx: "Interessados", f: function () {
      var ET = { novo: "Novo", atendimento: "Em atendimento", agendado: "Aula agendada", matriculado: "Matriculado", perdido: "Sem interesse" };
      var OR = { site: "Site", instagram: "Instagram", indicacao: "Indicação", visita: "Passou no Studio", whatsapp: "WhatsApp", google: "Google", outro: "Outro" };
      return P.todos(function (sb) { return sb.from("leads").select("*").order("criado_em"); }).then(function (l) {
        return csv(["Chegou em", "Nome", "WhatsApp", "Interesse", "Criança", "Idade", "Origem", "Etapa", "Aula", "Anotação"],
          l.map(function (x) {
            return [dt(x.criado_em), x.nome, x.whatsapp ? P.fone(x.whatsapp) : "", x.turma_aula || ({ adulto: "Adulto", feminino: "Feminino", kids: "Kids" })[x.programa] || "", x.crianca || "", x.idade || "",
              OR[x.origem] || x.origem, ET[x.etapa] || x.etapa, x.aula_data ? dt(x.aula_data) + (x.aula_hora ? " " + Site.hora(x.aula_hora) : "") : "", x.nota || ""];
          }));
      });
    } },
    despesas: { tx: "Despesas", f: function () {
      return P.todos(function (sb) { return sb.from("despesas").select("*").order("data"); }).then(function (l) {
        return csv(["Data", "Descrição", "Categoria", "Valor (R$)", "Fixa", "Paga"],
          l.map(function (d) { return [dt(d.data), d.descricao, d.categoria, reais(d.valor), d.recorrente ? "Sim" : "Não", d.paga ? "Sim" : "Não"]; }));
      });
    } }
  };

  function paint() {
    if (!P.ehDono()) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="fin-k">Exportar dados</p>' +
      '<p class="muted" style="font-size:12.5px;margin-top:4px">Planilhas para o contador, para conferir no Excel ou no Google Planilhas e para levar os dados a outro sistema. Tem dados pessoais: guarde em lugar seguro.</p>' +
      '<div class="exp-l">' + Object.keys(TIPOS).map(function (k) {
        return '<button class="mini-btn ghost" type="button" data-exp="' + k + '"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-down"/></svg>' + esc(TIPOS[k].tx) + "</button>";
      }).join("") + "</div>";
  }
  box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-exp]");
    if (!b || b.classList.contains("loading")) return;
    var k = b.dataset.exp;
    b.classList.add("loading");
    TIPOS[k].f().then(function (texto) {
      b.classList.remove("loading");
      baixar("evolution-" + k + "-" + P.hoje() + ".csv", texto);
      var n = texto.split("\r\n").length - 2;
      P.toast(TIPOS[k].tx + ": " + n + (n === 1 ? " linha exportada." : " linhas exportadas."));
    }).catch(function (er) { b.classList.remove("loading"); P.erro(er, "Não deu para exportar"); });
  });
  P.exportarCSV = function (k) { return TIPOS[k] ? TIPOS[k].f() : Promise.reject(new Error("tipo")); };
  P.aoAbrir("config", paint);
})();

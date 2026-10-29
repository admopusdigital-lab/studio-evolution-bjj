/* Studio Evolution BJJ · movimentos: a biblioteca de vídeos e quizzes da academia e o progresso de cada aluno.
   Usado pelo app do aluno (app.html) e pelo painel do professor (area-do-professor.html). Dois modos, como o login:
   - demonstração (supabase-config.js vazio): a biblioteca de exemplo da faixa azul. O que o professor cadastra fica
     neste navegador (localStorage) e o progresso do aluno, nesta aba (sessionStorage);
   - Supabase: tabelas movimentos e estudos (supabase/migrations/20261021120000_movimentos.sql).
   Tudo devolve Promise: as telas não mudam quando o banco for ligado. Carregado depois de acesso.js. */
(function () {
  var REAL = !!(window.Acesso && Acesso.real);
  var FAIXAS = { branca: "Branca", cinza: "Cinza", amarela: "Amarela", laranja: "Laranja", verde: "Verde", azul: "Azul", roxa: "Roxa", marrom: "Marrom", preta: "Preta" };
  var ORDEM = Object.keys(FAIXAS);
  var CATS = { raspagem: "Raspagem", passagem: "Passagem", finalizacao: "Finalização", fuga: "Fuga", defesa: "Defesa", queda: "Queda", outro: "Outro" };
  var CAT_K = "evo-mov-catalogo-v1", PROG_K = "evo-mov-progresso-v1";

  /* vídeo de exemplo: as cenas gravadas no Studio (img/takes), até as aulas de verdade serem publicadas */
  function ex(take, dur) { return { tipo: "arquivo", ref: "img/takes/" + take + ".mp4", alt: "img/takes/" + take + ".webm", poster: "img/takes/" + take + ".jpg", exemplo: true, dur: dur }; }
  function q(pergunta, alts, certa, dica) { return { q: pergunta, a: alts, r: certa, dica: dica || "" }; }
  /* a faixa azul da Marina: 12 movimentos, 7 com vídeo e 5 ainda em gravação. estudaram: quem já fez o quiz (exemplo) */
  var SEED = [
    { id: "raspagem-gancho", nome: "Raspagem de gancho", faixa: "azul", cat: "raspagem", video: ex("guarda", "0:04"),
      pontos: ["Sentado, com os pés por dentro das coxas do parceiro: são os ganchos.", "Segure um braço do parceiro e caia de lado, para o lado desse braço: ele não consegue apoiar.", "Levante com o gancho do outro lado e termine por cima."],
      quiz: [q("Para a raspagem funcionar, o que vem primeiro?", ["Fazer força com os braços", "Desequilibrar o parceiro", "Esperar o parceiro cair"], 1, "Ainda não. Pense no que tira o parceiro da base."),
        q("Onde fica o pé que faz o gancho?", ["Apoiado no chão, longe do parceiro", "Por fora do joelho do parceiro", "Por dentro da coxa do parceiro"], 2, "Ainda não. O gancho levanta o parceiro por dentro da perna.")],
      estudaram: ["Thiago Moreira", "Felipe Antunes"] },
    { id: "passagem-toreando", nome: "Passagem toreando", faixa: "azul", cat: "passagem", video: ex("tecnica", "0:04"),
      pontos: ["Em pé, segure as calças do parceiro na altura dos joelhos.", "Leve as pernas dele juntas para um lado e dê a volta pelo outro.", "Chegue ao lado com o peito pesado e estabilize na lateral."],
      quiz: [q("Na passagem toreando, onde você segura?", ["Na gola do parceiro", "Nas calças, na altura dos joelhos", "Nos punhos do parceiro"], 1, "Ainda não. A pegada controla as pernas."),
        q("Depois de levar as pernas para um lado, o que você faz?", ["Volta para dentro da guarda", "Senta no chão", "Contorna as pernas e estabiliza na lateral"], 2, "Ainda não. A passagem termina do lado de fora das pernas.")],
      estudaram: ["Thiago Moreira"] },
    { id: "fuga-montada", nome: "Fuga de montada", faixa: "azul", cat: "fuga", video: ex("aquecimento", "0:03"),
      pontos: ["Prenda o braço e o pé do mesmo lado do parceiro.", "Faça a ponte com o quadril, para cima e na diagonal.", "Role para o lado preso e termine dentro da guarda dele."],
      quiz: [q("Antes da ponte, o que você prende?", ["As duas pernas do parceiro", "O braço e o pé do mesmo lado do parceiro", "A gola do parceiro"], 1, "Ainda não. Prenda o lado para onde ele vai cair."),
        q("Para que lado você rola?", ["Para o lado do braço e do pé que você prendeu", "Para o lado contrário", "Para trás, por cima da cabeça"], 0, "Ainda não. Do lado preso, ele não tem como apoiar.")],
      estudaram: ["Marina Alves", "Thiago Moreira", "Caio Fernandes", "Felipe Antunes"] },
    { id: "fuga-lateral", nome: "Fuga de lateral", faixa: "azul", cat: "fuga", video: ex("adulto", "0:02"),
      pontos: ["Antebraços como moldura: um no pescoço, outro no quadril do parceiro.", "Fuga de quadril (camarão) para criar espaço.", "Coloque o joelho no espaço e recupere a guarda."],
      quiz: [q("Que movimento cria espaço para recuperar a guarda?", ["Empurrar com os braços esticados", "A fuga de quadril (camarão)", "Ficar parado esperando"], 1, "Ainda não. Quem se mexe é o quadril, não os braços."),
        q("Onde ficam os seus antebraços?", ["Como moldura no pescoço e no quadril do parceiro", "Abraçando as costas do parceiro", "Soltos ao lado do corpo"], 0, "Ainda não. Os antebraços seguram a distância.")],
      estudaram: ["Marina Alves", "Thiago Moreira", "Caio Fernandes"] },
    { id: "defesa-estrangulamento", nome: "Defesa do estrangulamento", faixa: "azul", cat: "defesa", video: ex("abertura-3", "0:05"),
      pontos: ["Queixo baixo e mãos protegendo o pescoço.", "Tire a pegada antes de o estrangulamento encaixar.", "Encaixou e não saiu? Bata: três tapinhas no parceiro ou no chão."],
      quiz: [q("O que você protege primeiro?", ["O pescoço, com as mãos e o queixo baixo", "As pernas", "A faixa"], 0, "Ainda não. O estrangulamento começa no pescoço."),
        q("O estrangulamento encaixou e você não consegue sair. E agora?", ["Aguenta até o professor parar", "Bate: três tapinhas no parceiro ou no chão", "Faz força para levantar"], 1, "Ainda não. No treino, bater é o certo: ninguém se machuca.")],
      estudaram: ["Marina Alves", "Thiago Moreira", "Caio Fernandes", "Felipe Antunes", "Larissa Mendes"] },
    { id: "estrangulamento-cruzado", nome: "Estrangulamento cruzado da guarda", faixa: "azul", cat: "finalizacao", video: ex("abertura-2", "0:06"),
      pontos: ["Da guarda fechada, a primeira mão entra fundo na gola, perto da nuca.", "A segunda mão entra cruzada, do outro lado da gola.", "Abra os cotovelos e traga o parceiro para perto. Solte assim que ele bater."],
      quiz: [q("Onde entra a primeira mão?", ["Na manga do parceiro", "Fundo na gola, perto da nuca", "Na faixa do parceiro"], 1, "Ainda não. Quanto mais fundo na gola, melhor."),
        q("O que aperta o estrangulamento?", ["Empurrar o parceiro para longe", "Soltar uma das mãos", "Abrir os cotovelos e trazer o parceiro para perto"], 2, "Ainda não. O parceiro vem para perto, não para longe.")],
      estudaram: ["Marina Alves", "Thiago Moreira"] },
    { id: "raspagem-tesoura", nome: "Raspagem tesoura", faixa: "azul", cat: "raspagem", video: ex("abertura-1", "0:04"),
      pontos: ["Segure a gola e a manga do mesmo lado do parceiro.", "Canela de cima atravessada na barriga do parceiro.", "A perna de baixo varre na altura do joelho enquanto você puxa a gola e a manga."],
      quiz: [q("Onde fica a canela de cima?", ["Atravessada na barriga do parceiro", "Nas costas do parceiro", "No chão, ao lado do parceiro"], 0, "Ainda não. A canela de cima segura o peso dele."),
        q("O que a perna de baixo faz?", ["Fica parada no chão", "Empurra o peito do parceiro", "Varre a perna do parceiro na altura do joelho"], 2, "Ainda não. É a perna de baixo que corta a base.")],
      estudaram: ["Marina Alves", "Thiago Moreira", "Caio Fernandes"] },
    { id: "armlock-guarda", nome: "Armlock da guarda fechada", faixa: "azul", cat: "finalizacao", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "triangulo-guarda", nome: "Triângulo da guarda", faixa: "azul", cat: "finalizacao", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "passagem-joelho", nome: "Passagem de joelho", faixa: "azul", cat: "passagem", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "kimura-meia", nome: "Kimura da meia-guarda", faixa: "azul", cat: "finalizacao", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "raspagem-pendulo", nome: "Raspagem de pêndulo", faixa: "azul", cat: "raspagem", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "fuga-quadril", nome: "Fuga de quadril (camarão)", faixa: "branca", cat: "fuga", video: null, pontos: [], quiz: [], estudaram: [] },
    { id: "postura-guarda", nome: "Postura dentro da guarda fechada", faixa: "branca", cat: "defesa", video: null, pontos: [], quiz: [], estudaram: [] }
  ].map(function (m, i) { m.publicado = true; m.ordem = i + 1; return m; });
  /* o progresso da Marina na demonstração: 5 estudados e a raspagem de gancho em 62% (o "Continue assistindo") */
  var PROG0 = {
    "fuga-montada": { visto: 1, quiz: true, em: "2026-09-02" }, "fuga-lateral": { visto: 1, quiz: true, em: "2026-09-10" },
    "defesa-estrangulamento": { visto: 1, quiz: true, em: "2026-09-18" }, "estrangulamento-cruzado": { visto: 1, quiz: true, em: "2026-09-29" },
    "raspagem-tesoura": { visto: 1, quiz: true, em: "2026-10-06" }, "raspagem-gancho": { visto: 0.62, quiz: false, em: "2026-10-14" }
  };
  var ALUNA_DEMO = "Marina Alves";

  function store(n) { try { var s = window[n]; s.getItem("x"); return s; } catch (e) { return null; } }
  function ler(n, k, padrao) { var s = store(n); try { var v = s && s.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } }
  function gravar(n, k, v) { var s = store(n); try { if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function catalogo() { return ler("localStorage", CAT_K, null) || copia(SEED); }
  function ordenar(l) {
    return l.sort(function (a, b) { return (ORDEM.indexOf(a.faixa) - ORDEM.indexOf(b.faixa)) || (a.ordem - b.ordem); });
  }

  /* ---------- vídeos: link do YouTube (pode ser não listado) ou de um arquivo de vídeo ---------- */
  function youtube(url) {
    var m = String(url || "").trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/);
    return m ? m[1] : null;
  }
  /* devolve { tipo, ref }, null (sem vídeo: o movimento fica "em gravação") ou false (link que o app não toca) */
  function video(texto) {
    var t = String(texto || "").trim();
    if (!t) return null;
    var y = youtube(t);
    if (y) return { tipo: "youtube", ref: y };
    if (/^(https:\/\/\S+|img\/\S+)\.(mp4|webm|m4v)(\?\S*)?$/i.test(t)) return { tipo: "arquivo", ref: t };
    return false;
  }
  function videoTexto(v) { return !v ? "" : v.tipo === "youtube" ? "https://youtu.be/" + v.ref : v.ref; }
  function duracao(seg) { seg = Math.max(0, Math.round(seg || 0)); return Math.floor(seg / 60) + ":" + ("0" + (seg % 60)).slice(-2); }

  /* ---------- modo Supabase: as linhas das tabelas viram os mesmos objetos da demonstração ---------- */
  function cli() { return Acesso.cliente(); }
  function deLinha(r) {
    return { id: r.id, nome: r.nome, faixa: r.faixa, cat: r.categoria, video: r.video_tipo ? { tipo: r.video_tipo, ref: r.video_ref, dur: r.duracao || "" } : null,
      pontos: r.pontos || [], quiz: r.quiz || [], publicado: r.publicado, ordem: r.ordem };
  }
  function paraLinha(m) {
    return { nome: m.nome, faixa: m.faixa, categoria: m.cat, video_tipo: m.video ? m.video.tipo : null, video_ref: m.video ? m.video.ref : null,
      duracao: m.video && m.video.dur ? m.video.dur : null, pontos: m.pontos || [], quiz: m.quiz || [], publicado: !!m.publicado, ordem: m.ordem || 0 };
  }
  function eu(c) { return c.auth.getSession().then(function (r) { var s = r.data && r.data.session; if (!s) throw new Error("sem-sessao"); return s.user.id; }); }
  function ok(r) { if (r.error) throw r.error; return r.data; }

  var Mov = {
    real: REAL, FAIXAS: FAIXAS, CATS: CATS, ORDEM: ORDEM,
    youtube: youtube, video: video, videoTexto: videoTexto, duracao: duracao,

    /* opts.faixa: só uma faixa; opts.todos: inclui os rascunhos (painel do professor) */
    lista: function (opts) {
      opts = opts || {};
      var filtra = function (l) { return ordenar(l.filter(function (m) { return (opts.todos || m.publicado) && (!opts.faixa || m.faixa === opts.faixa); })); };
      if (!REAL) return Promise.resolve(filtra(catalogo()));
      return cli().then(function (c) {
        var qy = c.from("movimentos").select("*");
        if (opts.faixa) qy = qy.eq("faixa", opts.faixa);
        if (!opts.todos) qy = qy.eq("publicado", true);
        return qy.then(ok);
      }).then(function (rs) { return filtra(rs.map(deLinha)); });
    },
    salvar: function (m) {
      m = copia(m);
      if (!REAL) {
        var l = catalogo(), i = l.map(function (x) { return x.id; }).indexOf(m.id);
        /* movimento novo, ou que mudou de faixa, vai para o fim da faixa */
        var fim = l.filter(function (x) { return x.faixa === m.faixa && x.id !== m.id; }).reduce(function (a, x) { return Math.max(a, x.ordem); }, 0) + 1;
        if (!m.id) m.id = "m-" + Date.now().toString(36);
        if (i < 0) { m.ordem = fim; m.estudaram = []; l.push(m); }
        else { m.estudaram = l[i].estudaram || []; m.ordem = l[i].faixa === m.faixa ? l[i].ordem : fim; l[i] = m; }
        gravar("localStorage", CAT_K, l);
        return Promise.resolve(m);
      }
      return cli().then(function (c) {
        var row = paraLinha(m);
        if (m.id) return c.from("movimentos").update(row).eq("id", m.id).select().single().then(ok);
        return c.from("movimentos").select("ordem").eq("faixa", m.faixa).order("ordem", { ascending: false }).limit(1).then(ok).then(function (u) {
          row.ordem = (u[0] ? u[0].ordem : 0) + 1;
          return c.from("movimentos").insert(row).select().single().then(ok);
        });
      }).then(deLinha);
    },
    apagar: function (id) {
      if (!REAL) { gravar("localStorage", CAT_K, catalogo().filter(function (m) { return m.id !== id; })); return Promise.resolve(); }
      return cli().then(function (c) { return c.from("movimentos").delete().eq("id", id).then(ok); });
    },
    /* o progresso de quem está usando: { id: { visto: 0 a 1, quiz: estudado, em } } */
    progresso: function () {
      if (!REAL) return Promise.resolve(ler("sessionStorage", PROG_K, null) || copia(PROG0));
      return cli().then(function (c) { return eu(c).then(function (id) { return c.from("estudos").select("movimento, visto, quiz_ok, atualizado_em").eq("aluno", id).then(ok); }); })
        .then(function (rs) { var p = {}; rs.forEach(function (r) { p[r.movimento] = { visto: r.visto, quiz: r.quiz_ok, em: r.atualizado_em }; }); return p; });
    },
    /* visto só cresce; quiz, uma vez feito, fica feito */
    registrar: function (id, d) {
      if (!REAL) {
        var p = ler("sessionStorage", PROG_K, null) || copia(PROG0), a = p[id] || { visto: 0, quiz: false };
        p[id] = { visto: Math.max(a.visto, d.visto || 0), quiz: a.quiz || !!d.quiz, em: new Date().toISOString() };
        gravar("sessionStorage", PROG_K, p);
        return Promise.resolve(p[id]);
      }
      return cli().then(function (c) {
        return eu(c).then(function (aluno) {
          return c.from("estudos").select("visto, quiz_ok").eq("aluno", aluno).eq("movimento", id).maybeSingle().then(ok).then(function (a) {
            a = a || { visto: 0, quiz_ok: false };
            return c.from("estudos").upsert({ aluno: aluno, movimento: id, visto: Math.max(a.visto, d.visto || 0), quiz_ok: a.quiz_ok || !!d.quiz }).then(ok);
          });
        });
      });
    },
    /* quem já estudou (fez o quiz): para o painel do professor */
    estudaram: function (id) {
      if (!REAL) {
        var m = catalogo().filter(function (x) { return x.id === id; })[0], n = m ? (m.estudaram || []).slice() : [];
        var p = ler("sessionStorage", PROG_K, null) || PROG0;
        if (p[id] && p[id].quiz && n.indexOf(ALUNA_DEMO) < 0) n.unshift(ALUNA_DEMO);
        return Promise.resolve(n);
      }
      return cli().then(function (c) { return c.from("estudos").select("perfis(nome)").eq("movimento", id).eq("quiz_ok", true).then(ok); })
        .then(function (rs) { return rs.map(function (r) { return r.perfis ? r.perfis.nome : ""; }).filter(Boolean); });
    },
    /* a faixa de quem está usando: na demonstração, a da Marina */
    minhaFaixa: function () {
      if (!REAL) return Promise.resolve("azul");
      /* a faixa mora no cadastro do aluno (alunos, ligado à conta); sem cadastro, a do perfil */
      return cli().then(function (c) {
        return c.from("alunos").select("faixa").maybeSingle().then(function (r) {
          if (r.data && r.data.faixa) return r.data.faixa;
          return eu(c).then(function (id) { return c.from("perfis").select("faixa").eq("id", id).single().then(ok); }).then(function (x) { return x.faixa || "branca"; });
        });
      });
    },
    /* demonstração: volta a biblioteca e o progresso ao começo */
    recomecar: function () { var a = store("localStorage"), b = store("sessionStorage"); try { if (a) a.removeItem(CAT_K); if (b) b.removeItem(PROG_K); } catch (e) {} }
  };
  window.Mov = Mov;
})();

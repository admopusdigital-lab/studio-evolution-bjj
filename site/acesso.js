/* Studio Evolution BJJ · acesso às áreas do aluno e do professor.
   Dois modos, escolhidos por supabase-config.js:
   - demonstração (url e chave vazias): contas fixas aluno / evolution e professor / evolution, conferidas aqui mesmo;
   - Supabase: e-mail e senha de verdade (Supabase Auth), com o papel (aluno ou professor) lido da tabela perfis.
   O papel fica guardado em "evo-sessao" para as áreas decidirem antes da primeira pintura (Acesso.portao);
   no modo Supabase, a conferência com o servidor vem logo depois e expulsa quem não tiver sessão válida.
   Carregado no <head>, antes do site.js: não depende de nada além do navegador. */
(function () {
  var C = window.EVO_SUPABASE || {};
  var REAL = !!(C.url && C.chave);
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
  var TOKEN = "evo-auth";          /* onde o Supabase guarda a sessão (storageKey) */
  var SESSAO = "evo-sessao";       /* { papel, nome }: o que as páginas precisam saber na hora */
  var MANTER = "evo-manter";       /* "1": a sessão fica no localStorage (sobrevive ao fechar o navegador) */
  /* depois de entrar, cada um cai no seu app: o do aluno (app.html) ou o painel em tela cheia (a área do professor com ?painel).
     As vitrines (area-do-aluno.html e area-do-professor.html) continuam abertas para quem tem login */
  var AREA = { aluno: "app.html", professor: "area-do-professor.html?painel" };
  var DEMO_SENHA = "evolution";

  /* armazenamento: sessionStorage por padrão, localStorage com "Manter conectado"; aba privada sem nenhum dos dois não quebra */
  function st(n) { try { var s = window[n]; s.getItem("x"); return s; } catch (e) { return null; } }
  function ler(k) {
    var v = null;
    ["sessionStorage", "localStorage"].forEach(function (n) { var s = st(n); if (v === null && s) { try { v = s.getItem(k); } catch (e) {} } });
    return v;
  }
  function apagar(k) { ["sessionStorage", "localStorage"].forEach(function (n) { var s = st(n); if (s) { try { s.removeItem(k); } catch (e) {} } }); }
  function gravar(k, v) {
    apagar(k);
    var s = st(ler(MANTER) === "1" ? "localStorage" : "sessionStorage") || st("localStorage");
    if (!s) return false;
    try { s.setItem(k, v); return true; } catch (e) { return false; }
  }
  function manter(sim) { var s = st("localStorage"); if (s) { try { s.setItem(MANTER, sim ? "1" : "0"); } catch (e) {} } }
  var armazem = { getItem: ler, setItem: gravar, removeItem: apagar };

  function sessao() {
    var s = null;
    try { s = JSON.parse(ler(SESSAO) || "null"); } catch (e) {}
    if (!s || !AREA[s.papel]) return null;
    /* no modo Supabase, o papel só vale junto com o token da sessão */
    if (REAL && !ler(TOKEN)) return null;
    return s;
  }
  function permite(papel, area) { return papel === area || (area === "aluno" && papel === "professor"); }

  /* a biblioteca do Supabase só baixa no modo Supabase, e uma vez só */
  var cliente = null, carregando = null;
  function sb() {
    if (cliente) return Promise.resolve(cliente);
    if (!carregando) carregando = new Promise(function (ok, falha) {
      if (window.supabase && window.supabase.createClient) return ok();
      var s = document.createElement("script");
      s.src = LIB; s.async = true;
      s.onload = ok; s.onerror = function () { carregando = null; falha(new Error("sem-biblioteca")); };
      document.head.appendChild(s);
    });
    return carregando.then(function () {
      if (!cliente) cliente = window.supabase.createClient(C.url, C.chave, {
        auth: { storage: armazem, storageKey: TOKEN, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return cliente;
    });
  }
  /* erro de rede (sem internet, servidor fora, página que bloqueia conexões) não é o mesmo que "senha errada" */
  function semRede(err) { return !err || !err.status || err.name === "AuthRetryableFetchError" || /fetch|network|sem-biblioteca/i.test(err.message || ""); }
  var MSG_REDE = "Não deu para falar com o servidor. Confira a internet e tente de novo.";

  function perfil(c, id) {
    return c.from("perfis").select("papel, nome, ativo").eq("id", id).single().then(function (r) { return r.data || null; });
  }

  var Acesso = {
    real: REAL,
    area: function (papel) { return AREA[papel] || AREA.aluno; },
    sessao: sessao,
    permite: permite,
    precarregar: function () { if (REAL) sb().catch(function () {}); },

    /* entrar: resolve { ok, papel, destino } ou { ok: false, msg, campo: "usuario" | "senha" } */
    entrar: function (usuario, senha, papel, manterConectado) {
      var u = String(usuario || "").trim(), outro = papel === "aluno" ? "professor" : "aluno";
      var trocado = 'Esse acesso é da Área do ' + (outro === "aluno" ? "Aluno" : "Professor") + '. Escolha "Sou ' + outro + '" acima.';
      if (!u) return Promise.resolve({ ok: false, campo: "usuario", msg: REAL ? "Digite o e-mail cadastrado no Studio." : "Digite seu e-mail ou usuário." });
      if (!senha) return Promise.resolve({ ok: false, campo: "senha", msg: "Digite sua senha." });
      manter(!!manterConectado);

      if (!REAL) {
        var n = u.toLowerCase();
        if (senha === DEMO_SENHA && n === outro && !permite(outro, papel)) return Promise.resolve({ ok: false, campo: "usuario", msg: trocado });
        if (senha !== DEMO_SENHA || (n !== papel && !(n === "professor" && permite(n, papel)))) return Promise.resolve({ ok: false, campo: "senha", msg: "Usuário ou senha não conferem. Confira e tente de novo." });
        var salvo = gravar(SESSAO, JSON.stringify({ papel: n, nome: n === "professor" ? "Professor" : "Aluno", desde: new Date().toISOString() }));
        return Promise.resolve({ ok: true, papel: n, destino: AREA[papel] + (salvo ? "" : (AREA[papel].indexOf("?") < 0 ? "?" : "&") + "acesso=" + n) });
      }

      if (u.indexOf("@") < 0) return Promise.resolve({ ok: false, campo: "usuario", msg: "Digite o e-mail cadastrado no Studio." });
      var c;
      return sb().then(function (cli) {
        c = cli;
        return c.auth.signInWithPassword({ email: u, password: senha });
      }).then(function (r) {
        if (r.error) {
          if (semRede(r.error)) return { ok: false, campo: "senha", msg: MSG_REDE };
          if (r.error.code === "email_not_confirmed") return { ok: false, campo: "usuario", msg: "Esse e-mail ainda não foi confirmado. Fale com o Studio no WhatsApp." };
          return { ok: false, campo: "senha", msg: "E-mail ou senha não conferem. Confira e tente de novo." };
        }
        return perfil(c, r.data.user.id).then(function (p) {
          if (!p || p.ativo === false) {
            return c.auth.signOut().then(function () { return { ok: false, campo: "usuario", msg: "Sua conta ainda não foi liberada pelo Studio. Fale com a gente no WhatsApp." }; });
          }
          if (!permite(p.papel, papel)) return c.auth.signOut().then(function () { return { ok: false, campo: "usuario", msg: trocado }; });
          gravar(SESSAO, JSON.stringify({ papel: p.papel, nome: p.nome, desde: new Date().toISOString() }));
          return { ok: true, papel: p.papel, destino: AREA[papel] };
        });
      }).catch(function () { return { ok: false, campo: "senha", msg: MSG_REDE }; });
    },

    sair: function () {
      apagar(SESSAO);
      if (!REAL) return Promise.resolve();
      /* sai mesmo sem rede: o token local é apagado de qualquer jeito */
      var fim = function () { apagar(TOKEN); };
      return sb().then(function (c) { return c.auth.signOut(); }).then(fim, fim);
    },

    /* portão das áreas: chamado no <head>, antes da primeira pintura. Sem sessão para esta área, volta para a entrada */
    portao: function (area) {
      var volta = function () {
        document.documentElement.style.display = "none";
        location.replace("entrar.html" + (area === "professor" ? "#professor" : ""));
      };
      var s = sessao(), q = /[?&]acesso=(aluno|professor)/.exec(location.search);
      if (!s && q && !REAL) s = { papel: q[1] };
      if (!s || !permite(s.papel, area)) { volta(); return false; }
      /* "Sair" (data-sair): apaga a sessão e só então troca de página */
      document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest("[data-sair]");
        if (!a) return;
        e.preventDefault();
        var href = a.getAttribute("href") || "entrar.html";
        Acesso.sair().then(function () { if (window.Site && Site.leave) Site.leave(href); else location.href = href; });
      }, true);
      /* modo Supabase: confirma a sessão com o servidor; token vencido ou conta desativada voltam para a entrada.
         Sem rede, a pessoa continua: a próxima ação que precisar do servidor confere de novo */
      if (REAL) sb().then(function (c) {
        return c.auth.getUser().then(function (r) {
          if (r.error && semRede(r.error)) return;
          if (r.error || !r.data.user) { apagar(SESSAO); apagar(TOKEN); return volta(); }
          return perfil(c, r.data.user.id).then(function (p) {
            if (!p || p.ativo === false || !permite(p.papel, area)) { Acesso.sair().then(volta); return; }
            gravar(SESSAO, JSON.stringify({ papel: p.papel, nome: p.nome, desde: s.desde }));
          });
        });
      }).catch(function () {});
      return true;
    },

    /* esqueci a senha: no modo Supabase, manda o link por e-mail (precisa do SMTP configurado; ver docs/supabase.md) */
    esqueci: function (email) {
      if (!REAL) return Promise.resolve({ ok: false, demo: true });
      var e = String(email || "").trim();
      if (e.indexOf("@") < 0) return Promise.resolve({ ok: false, msg: "Digite seu e-mail no campo acima e toque de novo em Esqueci a senha." });
      return sb().then(function (c) { return c.auth.resetPasswordForEmail(e, { redirectTo: new URL("nova-senha.html", location.href).href }); })
        .then(function (r) {
          if (r.error && semRede(r.error)) return { ok: false, msg: MSG_REDE };
          /* mesma resposta com ou sem conta: não dá para descobrir quem é aluno digitando e-mails */
          return { ok: true, msg: "Se esse e-mail estiver cadastrado, o link para criar uma senha nova chega em alguns minutos." };
        }, function () { return { ok: false, msg: MSG_REDE }; });
    },

    /* nova senha: a página nova-senha.html recebe a sessão de recuperação pelo link do e-mail */
    recuperacao: function () {
      if (!REAL) return Promise.resolve(false);
      return sb().then(function (c) {
        return new Promise(function (ok) {
          var feito = false, fim = function (v) { if (!feito) { feito = true; ok(v); } };
          c.auth.onAuthStateChange(function (ev, sess) { if (ev === "PASSWORD_RECOVERY" || (ev === "SIGNED_IN" && sess)) fim(true); });
          c.auth.getSession().then(function (r) { if (r.data && r.data.session) fim(true); });
          setTimeout(function () { fim(false); }, 4000);
        });
      }).catch(function () { return false; });
    },
    novaSenha: function (senha) {
      if (!REAL) return Promise.resolve({ ok: false, msg: "No modo de demonstração não há senha para trocar." });
      return sb().then(function (c) {
        return c.auth.updateUser({ password: senha }).then(function (r) {
          if (r.error) return { ok: false, msg: semRede(r.error) ? MSG_REDE : r.error.code === "same_password" ? "A senha nova precisa ser diferente da anterior." : r.error.code === "weak_password" ? "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." : "Não deu para salvar a senha. Peça um link novo." };
          return c.auth.signOut().then(function () { apagar(SESSAO); return { ok: true }; });
        });
      }).catch(function () { return { ok: false, msg: MSG_REDE }; });
    },

    /* acessos (só professor): cria a conta de um aluno ou professor, ou gera uma senha provisória nova.
       Roda na função criar-conta (supabase/functions), que tem a chave secreta e confere se quem pede é professor */
    conta: function (dados) {
      if (!REAL) {
        var letras = "abcdefghjkmnpqrstuvwxyz23456789", senha = "";
        for (var i = 0; i < 10; i++) senha += letras[Math.floor(Math.random() * letras.length)];
        return Promise.resolve({ ok: true, demo: true, email: dados.email, nome: dados.nome, senha: senha });
      }
      return sb().then(function (c) { return c.functions.invoke("criar-conta", { body: dados }); }).then(function (r) {
        if (r.error) {
          var ctx = r.error.context;
          var lerErro = ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
          return lerErro.then(function (b) { return { ok: false, msg: (b && b.erro) || MSG_REDE }; });
        }
        return { ok: true, email: r.data.email, nome: r.data.nome, senha: r.data.senha };
      }, function () { return { ok: false, msg: MSG_REDE }; });
    }
  };
  window.Acesso = Acesso;
})();

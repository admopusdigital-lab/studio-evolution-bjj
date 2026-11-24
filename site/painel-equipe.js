/* Painel · Equipe (só o professor): usuários de gestão com as áreas do painel que cada um pode ver e mexer.
   Criar a conta e gerar senha nova passam pela função criar-conta (com a chave secreta); as permissões e o
   ativo/inativo ficam em perfis, que só o professor muda (regra no banco). */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var box = $("#eqBox");
  if (!box) return;
  var EQ = [], busy = false;

  function semBanco(e) { return /permissoes|42703|perfis_papel_check|23514/.test(((e && e.message) || "") + " " + ((e && e.code) || "")); }
  function carregar() {
    if (!P.ehDono()) return Promise.resolve();
    return P.q(function (sb) { return sb.from("perfis").select("id, nome, whatsapp, email, permissoes, ativo, criado_em").eq("papel", "gestao").order("nome"); })
      .then(function (l) { EQ = l || []; paint(); })
      .catch(function (e) {
        if (semBanco(e)) { $("#eqL").innerHTML = '<li class="muted">A equipe precisa da atualização do banco de 24/11 (veja o aviso no topo do painel).</li>'; P.avisoBanco(); return; }
        P.erro(e, "Não deu para carregar a equipe");
      });
  }
  function caixas(sel, nome) {
    return '<div class="eq-areas" role="group" aria-label="O que pode ver">' + P.AREAS.map(function (a) {
      return '<label class="eq-area"><input type="checkbox" ' + (nome ? 'name="' + nome + '" ' : "") + 'value="' + a[0] + '"' + (sel.indexOf(a[0]) >= 0 ? " checked" : "") + "><span>" + a[1] + "</span></label>";
    }).join("") + "</div>";
  }
  function paint() {
    $("#eqK").textContent = EQ.length ? EQ.filter(function (x) { return x.ativo; }).length + " ativos" : "";
    $("#eqL").innerHTML = EQ.length ? EQ.map(function (x) {
      return '<li class="eq-p' + (x.ativo ? "" : " off") + '" data-eq="' + x.id + '"><div class="eq-top"><span class="av">' + P.ini(x.nome) + "</span><div><b>" + esc(x.nome) + "</b><small>" +
        esc(x.email || "e-mail não guardado") + (x.whatsapp ? " · " + P.fone(x.whatsapp) : "") + (x.ativo ? "" : " · desativado") + '</small></div><span class="row-acts">' +
        (x.email ? '<button class="mini-btn ghost" type="button" data-eq-senha>Senha nova</button>' : "") +
        '<button class="mini-btn ghost" type="button" data-eq-ativo>' + (x.ativo ? "Desativar" : "Reativar") + "</button></span></div>" +
        caixas(x.permissoes || []) + '<p class="eq-salvo muted" aria-live="polite"></p></li>';
    }).join("") : '<li class="muted">Ninguém na equipe ainda. Toque em Adicionar pessoa para criar o primeiro acesso de gestão.</li>';
  }

  /* credencial para mandar pelo WhatsApp (a mesma ideia do acesso dos alunos) */
  function mostraCred(r, whatsapp) {
    var msg = "Oi, " + P.first(r.nome) + "! Seu acesso ao painel do Studio Evolution BJJ:\n\nEntre em " + location.origin + "/entrar, escolha \"Sou professor\" e use:\nE-mail: " + r.email + "\nSenha: " + r.senha + "\n\nDepois de entrar, troque a senha se quiser. Oss!";
    $("#eqCred").hidden = false;
    $("#eqCred").innerHTML = '<b>Acesso ' + (r.reenvio ? "com senha nova" : "criado") + " para " + esc(r.nome || r.email) + "</b><p>E-mail: <code>" + esc(r.email) + "</code><br>Senha provisória: <code>" + esc(r.senha) + "</code></p>" +
      '<div class="msg-acts">' + (whatsapp ? '<button class="mini-btn wa" type="button" data-cred-wa>Mandar pelo WhatsApp</button>' : "") + '<button class="mini-btn ghost" type="button" data-cred-copia>Copiar mensagem</button></div>' +
      '<p class="muted">A senha aparece só agora. Se perder, gere uma nova.</p>';
    $("#eqCred").onclick = function (e) {
      if (e.target.closest("[data-cred-wa]")) P.wa(whatsapp, msg);
      if (e.target.closest("[data-cred-copia]")) { try { navigator.clipboard.writeText(msg).then(function () { P.toast("Mensagem copiada."); }); } catch (er) { P.toast("Não deu para copiar."); } }
    };
    P.aparece($("#eqCred"));
  }

  /* novo usuário de gestão */
  var form = $("#eqForm"), add = $("#eqAdd");
  add.addEventListener("click", function () {
    var abre = form.hidden;
    form.hidden = !abre; add.setAttribute("aria-expanded", String(abre));
    if (abre) {
      form.innerHTML = '<p class="fin-k">Nova pessoa na equipe</p><div class="crm-grid">' +
        '<label class="crm-f"><span>Nome</span><input class="crm-in" data-e="nome" autocomplete="off"></label>' +
        '<label class="crm-f"><span>E-mail (o login)</span><input class="crm-in" type="email" data-e="email" autocomplete="off" spellcheck="false"></label>' +
        '<label class="crm-f"><span>WhatsApp <small>(para mandar a senha)</small></span><input class="crm-in" data-e="whatsapp" inputmode="tel" placeholder="(15) 99999-9999" autocomplete="off"></label></div>' +
        '<p class="fin-k" style="margin-top:14px">O que pode ver e mexer</p>' + caixas(["hoje"], "novo") +
        '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Criar acesso</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>';
      P.focusSoft($('[data-e="nome"]', form));
    }
  });
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { form.hidden = true; add.setAttribute("aria-expanded", "false"); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var g = function (k) { return $('[data-e="' + k + '"]', form).value.trim(); };
    var nome = g("nome").replace(/\s+/g, " "), email = g("email").toLowerCase(), zapTxt = g("whatsapp"), zap = zapTxt.replace(/\D/g, "");
    var areas = $$('input[name="novo"]:checked', form).map(function (i) { return i.value; });
    if (nome.length < 3) return P.erroForm(form, $('[data-e="nome"]', form), "Digite o nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return P.erroForm(form, $('[data-e="email"]', form), "Digite um e-mail válido: é o login da pessoa.");
    if (zapTxt && !(zap.length === 10 || zap.length === 11 || zap.length === 12 || zap.length === 13)) return P.erroForm(form, $('[data-e="whatsapp"]', form), "Confira o WhatsApp: DDD e número.");
    if (!areas.length) return P.erroForm(form, $('input[name="novo"]', form), "Marque pelo menos uma área.");
    var bt = $('[type="submit"]', form);
    bt.classList.add("loading");
    Acesso.conta({ acao: "criar", nome: nome, email: email, whatsapp: zap, papel: "gestao", permissoes: areas }).then(function (r) {
      bt.classList.remove("loading");
      if (!r.ok) return P.erroForm(form, null, r.msg || "Não deu para criar o acesso.");
      form.hidden = true; add.setAttribute("aria-expanded", "false");
      mostraCred({ nome: nome, email: email, senha: r.senha }, zap);
      /* garante o papel e as áreas (a função criar-conta antiga, antes de ser atualizada, criaria como aluno) */
      /* só a conta com esse nome criada agora há pouco, e nunca a de um professor */
      var agora = new Date(Date.now() - 2 * 60000).toISOString();
      return P.q(function (sb) { return sb.from("perfis").select("id, papel, permissoes, criado_em").eq("nome", nome).neq("papel", "professor").gte("criado_em", agora).order("criado_em", { ascending: false }).limit(1); }).then(function (l) {
        var p = (l || [])[0];
        if (p && p.papel !== "professor" && (p.papel !== "gestao" || !(p.permissoes || []).length)) return P.q(function (sb) { return sb.from("perfis").update({ papel: "gestao", permissoes: areas, email: email }).eq("id", p.id).neq("papel", "professor"); });
      }).catch(function () {}).then(carregar);
    });
  });

  /* marcar e desmarcar áreas: salva na hora */
  $("#eqL").addEventListener("change", function (e) {
    var li = e.target.closest("[data-eq]");
    if (!li || e.target.type !== "checkbox") return;
    var id = li.dataset.eq, areas = $$('input[type="checkbox"]:checked', li).map(function (i) { return i.value; }), ok = $(".eq-salvo", li);
    ok.textContent = "Salvando…";
    P.q(function (sb) { return sb.from("perfis").update({ permissoes: areas }).eq("id", id); }).then(function () {
      var x = EQ.filter(function (q) { return q.id === id; })[0];
      if (x) x.permissoes = areas;
      ok.textContent = areas.length ? "Salvo. Vale na próxima vez que a pessoa abrir o painel." : "Salvo. Sem nenhuma área, a pessoa entra mas não vê nada.";
    }).catch(function (er) { ok.textContent = ""; P.erro(er, "Não deu para salvar"); carregar(); });
  });
  $("#eqL").addEventListener("click", function (e) {
    var b = e.target.closest("button"), li = e.target.closest("[data-eq]");
    if (!b || !li || busy) return;
    var x = EQ.filter(function (q) { return q.id === li.dataset.eq; })[0];
    if (b.hasAttribute("data-eq-ativo")) {
      if (x.ativo && !confirm("Desativar o acesso de " + x.nome + "? A pessoa não consegue mais entrar no painel.")) return;
      busy = true; b.classList.add("loading");
      P.q(function (sb) { return sb.from("perfis").update({ ativo: !x.ativo }).eq("id", x.id); })
        .then(function () { P.toast(x.nome + (x.ativo ? " foi desativado." : " foi reativado.")); return carregar(); })
        .catch(function (er) { P.erro(er); }).then(function () { busy = false; });
    } else if (b.hasAttribute("data-eq-senha")) {
      busy = true; b.classList.add("loading");
      Acesso.conta({ acao: "nova-senha", email: x.email }).then(function (r) {
        busy = false; b.classList.remove("loading");
        if (!r.ok) return P.toast(r.msg || "Não deu para gerar a senha.");
        mostraCred({ nome: x.nome, email: x.email, senha: r.senha, reenvio: true }, x.whatsapp);
      });
    }
  });
  P.aoAbrir("equipe", function () { carregar(); });
})();

/* App · Ao vivo (piloto): a câmera do tatame, só para quem o professor liberou no painel (Câmeras).
   O app pergunta ao banco pela função camera_ao_vivo(). Quem não está na lista recebe "nada" e não vê cartão nenhum.
   Quem está vê um cartão no Início: fora do ar, com a próxima transmissão; no ar, com o botão Assistir.
   O vídeo toca sem som, com o nome de quem assiste por cima. O endereço do vídeo só chega enquanto a câmera está no ar.
   O que toca o vídeo está em vivo.js. */
(function () {
  "use strict";
  if (!window.Acesso || !Acesso.real || !window.Vivo) return;   /* na demonstração não há câmera */
  var hero = document.getElementById("apHero");
  if (!hero) return;
  var TURMA_DE = { "Kids 1": "kids1", "Kids 2": "kids2", "Adulto": "adulto" };
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var D = null, card = null, tela = null, sess = null, tentando = false, parou = false, pollT = null, trava = null, antes = null, msgFim = "";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hora(ts) { var d = new Date(ts); return d.getHours() + "h" + (d.getMinutes() ? two(d.getMinutes()) : ""); }

  /* a próxima aula com câmera, pela grade do Studio e pelas turmas que o professor escolheu */
  function proxima() {
    var grade = (window.Site && Site.GRADE) || [], tur = (D && D.turmas) || {}, agora = new Date(), ab = D && D.abre5 === false ? 0 : 5 * 60000, melhor = null;
    for (var k = 0; k < 8; k++) {
      var d = new Date(agora); d.setDate(d.getDate() + k);
      grade.forEach(function (c) {
        var tk = TURMA_DE[c.n];
        if (!tk || !tur[tk] || c.d.indexOf(d.getDay()) < 0) return;
        var p = c.t.split(":"), ini = new Date(d); ini.setHours(+p[0], +p[1], 0, 0);
        var abre = ini.getTime() - ab;
        if (abre <= agora.getTime()) return;
        if (!melhor || abre < melhor.abre) melhor = { n: c.n, abre: abre, k: k };
        else if (abre === melhor.abre && melhor.n.indexOf(c.n) < 0) melhor.n += " e " + c.n;
      });
      if (melhor) break;
    }
    return melhor;
  }
  function quando(x) { return (x.k === 0 ? "hoje" : x.k === 1 ? "amanhã" : DIAS[new Date(x.abre).getDay()]) + " às " + hora(x.abre); }

  /* ---------- o cartão no Início ---------- */
  function pintaCartao() {
    if (!D) { if (card) { card.remove(); card = null; } return; }
    if (!card) {
      card = document.createElement("div");
      card.className = "ap-card ap-cam"; card.id = "apCam";
      card.innerHTML = '<p class="ap-lb gold"><span>Câmera do tatame</span><span class="ap-cam-vivo" id="apCamVivo" hidden>ao vivo</span></p>' +
        '<p class="ap-cam-t" id="apCamT"></p><p class="ap-sub" id="apCamS"></p>' +
        '<button class="ap-btn" type="button" id="apCamVer" hidden><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"/></svg><span>Assistir ao vivo</span></button>';
      hero.insertAdjacentElement("afterend", card);
      card.querySelector("#apCamVer").addEventListener("click", abrir);
    }
    var t, s;
    if (D.ao_vivo) { t = (D.turma || "Aula") + " no ar agora"; s = "Sem som e sem gravação. Só quem o professor liberou assiste."; }
    else if (D.pausada) { t = "Transmissão pausada"; s = "O professor pausou a câmera. Ela volta quando ele retomar."; }
    else { var px = proxima(); t = "Fora do ar"; s = px ? "Próxima transmissão: " + px.n + ", " + quando(px) + "." : "Sem transmissão prevista na grade."; }
    card.classList.toggle("on", !!D.ao_vivo);
    card.querySelector("#apCamVivo").hidden = !D.ao_vivo;
    card.querySelector("#apCamT").textContent = t;
    card.querySelector("#apCamS").textContent = s;
    card.querySelector("#apCamVer").hidden = !D.ao_vivo;
  }

  /* ---------- a tela do vídeo ---------- */
  function monta() {
    if (tela) return;
    tela = document.createElement("div");
    tela.className = "ap-vivo"; tela.id = "apVivo"; tela.hidden = true;
    tela.setAttribute("role", "dialog"); tela.setAttribute("aria-modal", "true"); tela.setAttribute("aria-labelledby", "apVivoT");
    tela.innerHTML = '<div class="ap-vivo-in">' +
      '<div class="ap-vivo-top"><div><p class="ap-lb gold">Ao vivo</p><h2 class="ap-vivo-t" id="apVivoT"></h2></div><button class="ap-vivo-x" type="button" id="apVivoX" aria-label="Fechar o vídeo">Fechar</button></div>' +
      '<div class="ap-vivo-v" id="apVivoV"><video id="apVivoVideo" muted playsinline aria-label="Imagem ao vivo do tatame"></video><span class="ap-vivo-marca" id="apVivoMarca" aria-hidden="true"></span><p class="ap-vivo-msg" id="apVivoMsg" role="status"></p></div>' +
      '<button class="ap-btn ghost" type="button" id="apVivoCheia" hidden>Ver em tela cheia</button>' +
      '<p class="ap-vivo-n"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-lock"/></svg><span>Só quem o professor liberou vê esta câmera, e só enquanto a aula acontece. Sem som e sem gravação.</span></p></div>';
    document.body.appendChild(tela);
    tela.querySelector("#apVivoX").addEventListener("click", function () { fechar(); });
    tela.addEventListener("keydown", function (e) { if (e.key === "Escape") fechar(); });
    var caixa = tela.querySelector("#apVivoV"), cheia = tela.querySelector("#apVivoCheia");
    /* tela cheia da caixa inteira (o nome de quem assiste vai junto); o iPhone não tem, então o botão nem aparece */
    if (caixa.requestFullscreen) { cheia.hidden = false; cheia.addEventListener("click", function () { var p = caixa.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }); }
  }
  function msg(t) { var m = tela.querySelector("#apVivoMsg"); m.textContent = t || ""; m.hidden = !t; }
  function acorda() { if (navigator.wakeLock && !trava) navigator.wakeLock.request("screen").then(function (w) { trava = w; w.addEventListener("release", function () { if (trava === w) trava = null; }); }).catch(function () {}); }
  function conectar() {
    if (!tela || tela.hidden || sess || tentando || !D || !D.ao_vivo || !D.assistir_url) return;
    var video = tela.querySelector("#apVivoVideo");
    tentando = true; msg("Conectando…");
    Vivo.assistir(D.assistir_url, video, { aoCair: function () { sess = null; msg("A transmissão caiu. Tentando voltar…"); setTimeout(consulta, 3000); } }).then(function (s) {
      tentando = false;
      if (!tela || tela.hidden) { s.parar(); return; }
      sess = s;
      var some = function () { video.removeEventListener("playing", some); if (sess === s) msg(""); };
      video.addEventListener("playing", some);
      if (video.videoWidth > 0) some();
    }, function (e) {
      tentando = false;
      msg(e.tipo === "fora-do-ar" ? "A câmera saiu do ar." : e.tipo === "sem-rede" ? "Sem internet. Tentando de novo…" : "Não deu para abrir o vídeo. Tentando de novo…");
    });
  }
  function abrir() {
    if (!D || !D.ao_vivo) return;
    monta();
    antes = document.activeElement;
    var nome = (Acesso.sessao() || {}).nome || "";
    tela.querySelector("#apVivoT").textContent = (D.turma || "Aula") + " · " + (D.nome || "Tatame");
    var marca = tela.querySelector("#apVivoMarca"); marca.textContent = nome; marca.hidden = !D.marca || !nome;
    tela.hidden = false; document.documentElement.classList.add("ap-vivo-on");
    tela.querySelector("#apVivoX").focus();
    msgFim = ""; acorda(); conectar(); ritmo();
  }
  function fechar() {
    if (!tela || tela.hidden) return;
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    var s = sess; sess = null; if (s) s.parar();
    tela.hidden = true; document.documentElement.classList.remove("ap-vivo-on");
    var w = trava; trava = null; if (w) { try { w.release(); } catch (e) {} }
    if (antes && antes.focus && document.contains(antes)) antes.focus();
    ritmo();
  }

  /* ---------- a consulta ao banco ---------- */
  function consulta() {
    if (parou) return;
    Acesso.cliente().then(function (sb) { return sb.rpc("camera_ao_vivo"); }).then(function (r) {
      if (r.error) {
        /* banco sem a função (atualização pendente): não insiste nesta visita */
        if (/PGRST202|42883|404/.test((r.error.code || "") + " " + (r.status || "")) || /camera_ao_vivo/.test(r.error.message || "")) parou = true;
        return;
      }
      D = r.data && typeof r.data.ao_vivo === "boolean" ? r.data : null;
      pintaCartao();
      if (tela && !tela.hidden) {
        if (!D || !D.ao_vivo) { var s = sess; sess = null; if (s) s.parar(); msg(D && D.pausada ? "O professor pausou a transmissão." : "A transmissão terminou."); }
        else if (!sess) conectar();
      }
      ritmo();
    }).catch(function () {});
  }
  /* quem está na lista é consultado a cada 20 segundos (10 com o vídeo aberto) enquanto o app está na frente;
     quem não está só é consultado ao abrir o app e ao voltar para ele */
  function ritmo() {
    clearInterval(pollT); pollT = null;
    if (!D || parou || document.hidden) return;
    pollT = setInterval(consulta, tela && !tela.hidden ? 10000 : 20000);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { clearInterval(pollT); pollT = null; return; }
    if (tela && !tela.hidden) acorda();
    consulta();
  });
  document.addEventListener("evo-grade", pintaCartao);
  window.addEventListener("pagehide", function () { if (sess) { try { sess.parar(); } catch (e) {} } });
  consulta();
})();

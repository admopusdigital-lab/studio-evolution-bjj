/* Studio Evolution BJJ · a câmera do tatame, fase 1: este aparelho (um celular preso à parede) filma e envia a aula.
   - Só o professor usa. Os links da transmissão vêm do painel (Câmeras) e ficam na tabela camera_links.
   - Depois de "Ligar", a tela fica acesa e a transmissão abre e fecha sozinha pelos horários das turmas com câmera
     (5 min antes da aula até o fim), sem som e sem gravação.
   - Se a internet cair, tenta de novo sozinha. A cada 30 segundos manda um sinal de vida para o painel e lê de volta
     se o professor pausou ou trocou o link.
   O envio do vídeo em si está em vivo.js. */
(function () {
  "use strict";
  if (!window.Acesso || !Acesso.real || !Acesso.sessao()) return;
  var $ = function (s) { return document.querySelector(s); };
  var ID = "tatame1";
  var DUR = 60;                 /* minutos de cada aula, como no resto do sistema */
  var TURMA_DE = { "Kids 1": "kids1", "Kids 2": "kids2", "Adulto": "adulto" };
  var NOMES = { kids1: "Kids 1", kids2: "Kids 2", adulto: "Adulto" };
  /* a grade padrão, igual à do site.js (tests/fumaca.js confere que as duas continuam iguais) */
  var GRADE_PADRAO = [
    { t: "08:00", n: "Adulto", d: [1, 2, 3, 4, 5] },
    { t: "09:00", n: "Kids 2", d: [1, 3] },
    { t: "09:00", n: "Kids 1", d: [2, 4] },
    { t: "10:30", n: "Open Mat", d: [6] },
    { t: "11:00", n: "Adulto", d: [1, 2, 3, 4, 5] },
    { t: "18:00", n: "Kids 2", d: [1, 3] },
    { t: "18:00", n: "Kids 1", d: [2, 4] },
    { t: "19:00", n: "Adulto", d: [1, 2, 3, 4, 5] },
    { t: "20:30", n: "Adulto", d: [1, 2, 3, 4, 5] }
  ];
  var TURMAS_PADRAO = { kids1: true, kids2: true, adulto: false };   /* o mesmo ponto de partida do painel */
  /* jeitos de enviar, do preferido ao último recurso; o que funcionar fica guardado no aparelho.
     O primeiro segue o formato do exemplo oficial da Cloudflare (vídeo e uma faixa de áudio); a faixa de áudio vai em
     silêncio, gerada pela página, sem usar o microfone: nenhum som do tatame sai do aparelho. */
  var MODOS = [{ h264: true, audio: true }, { h264: true, audio: false }, { h264: false, audio: true }, { h264: false, audio: false }];
  var K_ARMADA = "evo-cam-armada", K_CAMERA = "evo-cam-aparelho", K_MODO = "evo-cam-modo";
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  var el = { aviso: $("#txAviso"), main: $("#txMain"), modo: $("#txModo"), estado: $("#txEstado"), linha: $("#txLinha"), det: $("#txDet"), erro: $("#txErro"), lista: $("#txLista"),
    img: $("#txImg"), video: $("#txVideo"), sem: $("#txSem"), vivo: $("#txVivo"), prep: $("#txPrep"), turmas: $("#txTurmas"),
    ligar: $("#txLigar"), trocar: $("#txTrocar"), teste: $("#txTeste"), ver: $("#txVer"), desligar: $("#txDesligar") };

  var db = null, L = null, C = {}, grade = GRADE_PADRAO;
  var armada = false, manualAte = 0, stream = null, sess = null, ligando = false, ger = 0, falhas = 0, proxima = 0, modo = 0;
  var trava = null, med = null, parado = 0, ultQuadros = -1, ultErro = "", erroCam = "", verImg = false, verT = null, desde = 0, bat = null, alvoAtual = null;

  function le(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guarda(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hora(ts) { var d = new Date(ts); return d.getHours() + "h" + (d.getMinutes() ? two(d.getMinutes()) : ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function gradeOk(g) {
    return Array.isArray(g) && g.length > 0 && g.every(function (c) {
      return c && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.t) && typeof c.n === "string" && Array.isArray(c.d) && c.d.length > 0;
    });
  }
  function turmas() { return (C && C.turmas) || TURMAS_PADRAO; }
  function antes() { return C && C.regras && C.regras.abre5 === false ? 0 : 5 * 60000; }

  /* ---------- aviso (o que impede de usar) ---------- */
  function aviso(titulo, texto) {
    el.aviso.innerHTML = "<b>" + esc(titulo) + "</b>" + texto;
    el.aviso.hidden = false;
  }
  function semAviso() { el.aviso.hidden = true; el.aviso.innerHTML = ""; }

  /* ---------- as aulas com câmera ---------- */
  function janelas(agora, dias) {
    var l = [];
    for (var k = 0; k < dias; k++) {
      var d = new Date(agora); d.setDate(d.getDate() + k);
      grade.forEach(function (c) {
        var tk = TURMA_DE[c.n];
        if (!tk || !turmas()[tk] || c.d.indexOf(d.getDay()) < 0) return;
        var p = c.t.split(":"), ini = new Date(d); ini.setHours(+p[0], +p[1], 0, 0);
        l.push({ n: c.n, ini: ini.getTime(), fim: ini.getTime() + DUR * 60000, k: k });
      });
    }
    return l.sort(function (a, b) { return a.ini - b.ini || (a.n < b.n ? -1 : 1); });
  }
  /* o que deveria estar no ar agora: null, ou { n, fim, teste } */
  function alvo(agora) {
    if (!armada || !L || !L.envio_url || L.pausada) return null;
    var t = agora.getTime();
    if (manualAte > t) return { n: "Teste", fim: manualAte, teste: true };
    var a = antes(), agoraL = janelas(agora, 1).filter(function (x) { return t >= x.ini - a && t < x.fim; });
    if (!agoraL.length) return null;
    var nomes = [], fim = 0;
    agoraL.forEach(function (x) { if (nomes.indexOf(x.n) < 0) nomes.push(x.n); if (x.fim > fim) fim = x.fim; });
    return { n: nomes.join(" e "), fim: fim };
  }
  function proximas(agora, n) {
    var t = agora.getTime(), a = antes(), vistos = {}, l = [];
    janelas(agora, 8).forEach(function (x) {
      if (x.ini - a <= t) return;
      var k = x.ini + "";
      if (vistos[k]) { if (vistos[k].n.indexOf(x.n) < 0) vistos[k].n += " e " + x.n; return; }
      vistos[k] = { n: x.n, ini: x.ini, k: x.k }; l.push(vistos[k]);
    });
    return l.slice(0, n);
  }
  function quando(x) { return (x.k === 0 ? "hoje" : x.k === 1 ? "amanhã" : DIAS[new Date(x.ini).getDay()]) + " às " + hora(x.ini); }

  /* ---------- a câmera do aparelho ---------- */
  function textoCamera(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "O navegador bloqueou a câmera. Toque no cadeado ao lado do endereço, libere a Câmera e recarregue a página.";
    if (n === "NotFoundError" || n === "OverconstrainedError") return "Este aparelho não tem uma câmera disponível.";
    if (n === "NotReadableError" || n === "AbortError") return "A câmera está em uso por outro aplicativo. Feche os outros apps e tente de novo.";
    return "Não deu para ligar a câmera deste aparelho.";
  }
  function abrirCamera() {
    var f = stream && stream.getVideoTracks()[0];
    if (f && f.readyState === "live") return Promise.resolve(stream);
    var id = le(K_CAMERA), v = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } };
    if (id) v.deviceId = { exact: id }; else v.facingMode = { ideal: "environment" };
    return navigator.mediaDevices.getUserMedia({ video: v, audio: false }).then(function (s) {
      stream = s; erroCam = "";
      el.video.srcObject = s;
      var p = el.video.play(); if (p && p.catch) p.catch(function () {});
      /* a câmera foi tomada (outro app, cabo solto): derruba o envio e deixa o relógio tentar de novo */
      s.getVideoTracks()[0].addEventListener("ended", function () {
        if (stream !== s) return;
        stream = null;
        if (sess || ligando) { pararEnvio(); ultErro = "A câmera do aparelho parou. Tentando de novo…"; proxima = Date.now() + 5000; }
        pinta();
      });
      return s;
    }, function (e) {
      if (id && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) { guarda(K_CAMERA, null); return abrirCamera(); }
      erroCam = textoCamera(e);
      var x = new Error("camera"); x.tipo = "camera"; throw x;
    });
  }
  function fecharCamera() {
    if (!stream) return;
    var s = stream; stream = null;
    s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    try { el.video.srcObject = null; } catch (e) {}
  }
  /* fora do ar e sem ninguém olhando a imagem, a câmera desliga (menos calor e bateria).
     No iPhone ela fica aberta: o Safari pede a permissão de novo a cada abertura. */
  function cameraSeNaoPrecisa() {
    if (sess || ligando || verImg || !armada) return;
    if (!IOS) fecharCamera();
  }
  function trocarCamera() {
    if (!navigator.mediaDevices.enumerateDevices) return;
    el.trocar.disabled = true;
    navigator.mediaDevices.enumerateDevices().then(function (l) {
      var cams = l.filter(function (d) { return d.kind === "videoinput" && d.deviceId; });
      if (cams.length < 2) { ultErro = "Este aparelho só tem uma câmera."; return; }
      var atual = stream && stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings ? stream.getVideoTracks()[0].getSettings().deviceId : le(K_CAMERA);
      var i = cams.map(function (d) { return d.deviceId; }).indexOf(atual);
      guarda(K_CAMERA, cams[(i + 1) % cams.length].deviceId);
      ultErro = "";
      fecharCamera();
      return abrirCamera();
    }).catch(function () {}).then(function () { el.trocar.disabled = false; pinta(); });
  }

  /* ---------- a tela acesa ---------- */
  function acorda() {
    if (!armada || !navigator.wakeLock || trava || document.visibilityState !== "visible") return;
    navigator.wakeLock.request("screen").then(function (w) {
      trava = w;
      w.addEventListener("release", function () { if (trava === w) trava = null; });
    }).catch(function () {});
  }
  function dorme() { var w = trava; trava = null; if (w) { try { w.release(); } catch (e) {} } }

  /* ---------- o envio ---------- */
  function pararEnvio() {
    ger++;
    if (sess) { try { sess.parar(); } catch (e) {} }
    sess = null; ligando = false; med = null; parado = 0; ultQuadros = -1;
  }
  function espera() { return [3, 6, 12, 24, 45, 60][Math.min(falhas, 6) - 1] * 1000; }
  function falhou(e) {
    falhas++;
    var t = e && e.tipo, st = e && e.status;
    if (t === "camera") { ultErro = erroCam; proxima = Date.now() + 15000; return; }
    if (t === "sem-rede") ultErro = "Sem internet. Tentando de novo…";
    else if (t === "recusado" && (st === 401 || st === 403 || st === 404)) {
      ultErro = "O link de envio não foi aceito (código " + st + "). Confira o link colado no painel, em Câmeras.";
      proxima = Date.now() + 60000; return;
    }
    else if (t === "recusado" && st >= 500) ultErro = "O serviço de transmissão não respondeu (código " + st + "). Tentando de novo…";
    else {
      /* a conversa com o servidor não fechou: tenta o próximo jeito de enviar */
      modo = (modo + 1) % MODOS.length;
      ultErro = (t === "recusado" ? "O serviço recusou a transmissão (código " + st + ")." : t === "nao-ligou" ? "O vídeo não passou pela rede deste lugar." : "A transmissão não começou.") + " Tentando de outro jeito…";
    }
    proxima = Date.now() + espera();
  }
  function ligar() {
    ligando = true;
    var g = ++ger;
    abrirCamera().then(function () {
      if (g !== ger) return null;
      var m = MODOS[modo];
      return Vivo.enviar(L.envio_url, stream, { kbps: 1800, qps: 24, h264: m.h264, audio: m.audio, aoCair: function () {
        if (g !== ger) return;
        sess = null; med = null; ger++;
        falhas++; ultErro = "A conexão caiu. Reconectando…"; proxima = Date.now() + 2000;
        pinta(); sinal();
      } });
    }).then(function (s) {
      if (!s) return;
      if (g !== ger) { s.parar(); return; }
      sess = s; ligando = false; falhas = 0; ultErro = ""; desde = Date.now(); parado = 0; ultQuadros = -1;
      guarda(K_MODO, String(modo));
      sinal();
    }).catch(function (e) {
      if (g !== ger) return;
      ligando = false;
      falhou(e);
      cameraSeNaoPrecisa();
    }).then(pinta);
  }
  function medir() {
    if (!sess) return;
    var s = sess;
    s.medir().then(function (m) {
      if (sess !== s || !m) return;
      med = m;
      /* ligada mas sem sair imagem por 20 segundos: derruba e deixa reconectar */
      if (m.quadros === ultQuadros) parado++; else parado = 0;
      ultQuadros = m.quadros;
      if (parado >= 4) { pararEnvio(); falhas++; ultErro = "A imagem travou. Reconectando…"; proxima = Date.now() + 2000; sinal(); }
      pinta();
    });
  }

  /* ---------- o relógio: a cada 5 segundos confere se devia estar no ar ---------- */
  function tick() {
    var agora = new Date();
    alvoAtual = alvo(agora);
    if (alvoAtual && !sess && !ligando && agora.getTime() >= proxima && navigator.onLine !== false) ligar();
    if (!alvoAtual && (sess || ligando)) { pararEnvio(); ultErro = ""; falhas = 0; cameraSeNaoPrecisa(); sinal(); }
    if (manualAte && manualAte <= agora.getTime()) manualAte = 0;
    medir();
    pinta();
  }

  /* ---------- sinal de vida para o painel (e a leitura de pausa e de link novo) ---------- */
  function aparelho() { var u = navigator.userAgent; return /Android/.test(u) ? "Celular Android" : IOS ? "iPhone ou iPad" : "Computador"; }
  function sinal() {
    if (!db || !L) return;
    var est = {
      armada: armada, ao_vivo: !!sess, turma: alvoAtual ? alvoAtual.n : null, desde: sess ? new Date(desde).toISOString() : null,
      conexao: sess && med ? { kbps: med.kbps, qps: med.qps, larg: med.larg, alt: med.alt } : null,
      bateria: bat ? { nivel: Math.round(bat.level * 100), tomada: !!bat.charging } : null,
      tela_acesa: !!trava, erro: ultErro || erroCam || null, aparelho: aparelho()
    };
    db.from("camera_links").update({ estado: est, visto_em: new Date().toISOString() }).eq("id", ID).select("envio_url, assistir_url, pausada").maybeSingle().then(function (r) {
      if (r.error || !r.data || !("pausada" in r.data)) return;
      var trocou = r.data.envio_url !== L.envio_url;
      L = r.data;
      if (trocou && (sess || ligando)) { pararEnvio(); proxima = 0; }
      tick();
    }, function () {});
  }
  function recarrega() {
    if (!db) return;
    db.from("configuracoes").select("valor").eq("chave", "cameras").maybeSingle().then(function (r) { if (!r.error) { C = (r.data && r.data.valor) || {}; pinta(); } }, function () {});
    db.rpc("grade_aulas").then(function (r) { if (!r.error && gradeOk(r.data)) { grade = r.data; pinta(); } }, function () {});
  }

  /* ---------- a tela ---------- */
  function mbps(k) { return k >= 1000 ? (k / 1000).toFixed(1).replace(".", ",") + " Mbps" : k + " kbps"; }
  function listaTurmas() {
    var on = Object.keys(NOMES).filter(function (k) { return turmas()[k]; });
    if (!on.length) return "Nenhuma turma com câmera. Escolha as turmas no painel, em Câmeras.";
    return "Turmas com câmera: <b>" + on.map(function (k) {
      var h = {};
      grade.forEach(function (c) { if (c.n === NOMES[k]) h[c.t] = 1; });
      var hs = Object.keys(h).sort().map(function (t) { var p = t.split(":"); return +p[0] + "h" + (p[1] !== "00" ? p[1] : ""); });
      return esc(NOMES[k]) + (hs.length ? " (" + hs.join(" · ") + ")" : " (sem aula na grade)");
    }).join(", ") + "</b>. Para mudar, abra o painel, em Câmeras.";
  }
  function pinta() {
    if (!L) return;
    var agora = new Date(), a = alvoAtual, temLink = !!L.envio_url;
    el.main.hidden = false;
    el.main.classList.toggle("modo", armada);
    el.modo.hidden = !armada;
    el.prep.hidden = armada;
    el.ligar.hidden = armada;
    el.trocar.hidden = armada;
    el.teste.hidden = el.desligar.hidden = !armada;
    el.ver.hidden = !armada || !!sess || ligando;
    el.ligar.disabled = !temLink;
    el.img.hidden = armada && !sess && !ligando && !verImg;
    el.vivo.hidden = !sess;
    el.sem.hidden = !!stream;
    el.sem.textContent = erroCam || "Ligando a câmera…";
    el.turmas.innerHTML = listaTurmas();
    el.teste.textContent = manualAte > agora.getTime() ? "Parar o teste" : "Transmitir agora por 10 min";
    el.teste.disabled = !temLink || !!L.pausada;
    el.ver.textContent = verImg ? "Esconder a imagem" : "Ver a imagem";
    el.ver.setAttribute("aria-pressed", String(verImg));
    if (!armada) return;

    var cls = "espera", est = "Aguardando", linha = "", det = [];
    if (L.pausada) { cls = "atencao"; est = "Pausada"; linha = "O professor pausou pelo painel. Para voltar, toque em Retomar em Câmeras."; }
    else if (!temLink) { cls = "atencao"; est = "Sem link"; linha = "Falta colar o link de envio no painel, em Câmeras."; }
    else if (sess) {
      cls = "no-ar"; est = "No ar"; linha = a ? a.n + " · até " + hora(a.fim) : "";
      if (med && med.kbps) det.push(mbps(med.kbps), med.qps + " quadros/s", med.larg + "×" + med.alt);
    }
    else if (a) { cls = "atencao"; est = navigator.onLine === false ? "Sem internet" : "Conectando"; linha = a.n + " · até " + hora(a.fim); }
    else {
      var px = proximas(agora, 1)[0];
      linha = px ? "Próxima: " + px.n + ", " + quando({ ini: px.ini - antes(), k: px.k }) : "Nenhuma turma com câmera tem aula na grade.";
    }
    if (bat) det.push("bateria " + Math.round(bat.level * 100) + "%" + (bat.charging ? " na tomada" : " fora da tomada"));
    if (!trava) det.push(navigator.wakeLock ? "toque na tela para mantê-la acesa" : "deixe a tela sempre ligada nos ajustes do aparelho");
    el.estado.className = "tx-estado " + cls;
    el.estado.textContent = est;
    el.linha.textContent = linha;
    el.det.textContent = det.join(" · ");
    var erro = !L.pausada && (ultErro || (sess ? "" : erroCam));
    el.erro.hidden = !erro; el.erro.textContent = erro || "";
    var lista = proximas(agora, 3);
    el.lista.hidden = !lista.length || !!L.pausada || !!sess;   /* no ar, a tela mostra só o que está acontecendo */
    el.lista.innerHTML = lista.map(function (x) { return "<li><b>" + esc(x.n) + "</b><span>" + esc(quando({ ini: x.ini - antes(), k: x.k })) + "</span></li>"; }).join("");
  }
  /* a tela fica parada o dia todo: o texto anda alguns pixels por minuto para não marcar o vidro */
  function desloca() {
    var m = new Date().getMinutes();
    el.modo.style.setProperty("--dx", ((m * 7) % 13 - 6) + "px");
    el.modo.style.setProperty("--dy", ((m * 5) % 9 - 4) + "px");
  }

  /* ---------- ligar e desligar o modo câmera ---------- */
  function armar() {
    armada = true; guarda(K_ARMADA, "1");
    falhas = 0; proxima = 0; ultErro = "";
    acorda(); cameraSeNaoPrecisa(); tick(); sinal();
  }
  function desarmar() {
    armada = false; guarda(K_ARMADA, null);
    manualAte = 0; verImg = false;
    pararEnvio(); dorme(); alvoAtual = null; ultErro = "";
    sinal();
    abrirCamera().catch(function () {}).then(pinta);
    pinta();
  }

  el.ligar.addEventListener("click", function () { if (L && L.envio_url) armar(); });
  el.desligar.addEventListener("click", desarmar);
  el.trocar.addEventListener("click", trocarCamera);
  el.teste.addEventListener("click", function () {
    manualAte = manualAte > Date.now() ? 0 : Date.now() + 10 * 60000;
    proxima = 0; falhas = 0; tick();
  });
  el.ver.addEventListener("click", function () {
    verImg = !verImg; clearTimeout(verT);
    if (verImg) { abrirCamera().catch(function () {}).then(pinta); verT = setTimeout(function () { verImg = false; cameraSeNaoPrecisa(); pinta(); }, 60000); }
    else cameraSeNaoPrecisa();
    pinta();
  });
  /* qualquer toque devolve a tela acesa (o navegador solta a trava quando a página sai da frente) */
  document.addEventListener("click", acorda);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { acorda(); if (L) tick(); } });
  window.addEventListener("online", function () { proxima = 0; if (L) tick(); });
  window.addEventListener("offline", function () { if (L) pinta(); });
  window.addEventListener("pagehide", function () { if (sess) { try { sess.parar(); } catch (e) {} } });

  /* ---------- começo ---------- */
  function semBanco(e) { var m = (e && (e.message || "")) + " " + ((e && e.code) || ""); return /42P01|PGRST205|camera_links/.test(m); }
  function comeca() {
    if (Acesso.sessao().papel !== "professor") {
      return aviso("Só o professor liga a câmera.", "<p>Entre com a conta do professor neste aparelho para usar a câmera do tatame.</p>");
    }
    if (!window.Vivo || !Vivo.suporta()) {
      return aviso("Este navegador não transmite vídeo.", "<p>Abra esta página no Chrome (Android) ou no Safari (iPhone), sempre atualizados.</p>");
    }
    Acesso.cliente().then(function (sb) {
      db = sb;
      return Promise.all([
        sb.from("camera_links").select("envio_url, assistir_url, pausada").eq("id", ID).maybeSingle(),
        sb.from("configuracoes").select("valor").eq("chave", "cameras").maybeSingle(),
        sb.rpc("grade_aulas")
      ]);
    }).then(function (r) {
      if (r[0].error) throw r[0].error;
      L = r[0].data || { envio_url: null, assistir_url: null, pausada: false };
      C = (r[1] && r[1].data && r[1].data.valor) || {};
      var g = r[2] && r[2].data;
      if (gradeOk(g)) grade = g;
      else { try { var gl = JSON.parse(le("evo-grade") || "null"); if (gradeOk(gl)) grade = gl; } catch (e) {} }
      if (C.nome) $("#txNome").textContent = C.nome + " · Studio Evolution BJJ";
      if (!L.envio_url) aviso("Falta colar o link de envio.", "<p>No computador, abra o painel, entre em Câmeras e cole os dois links da Cloudflare. Depois volte aqui e recarregue a página.</p>");
      else semAviso();
      var m = parseInt(le(K_MODO) || "0", 10); modo = m >= 0 && m < MODOS.length ? m : 0;
      armada = le(K_ARMADA) === "1" && !!L.envio_url;
      if (navigator.getBattery) navigator.getBattery().then(function (b) { bat = b; b.addEventListener("levelchange", pinta); b.addEventListener("chargingchange", pinta); pinta(); }).catch(function () {});
      if (armada) { acorda(); tick(); sinal(); }
      else { pinta(); abrirCamera().catch(function () {}).then(pinta); }
      setInterval(tick, 5000);
      setInterval(function () { if (armada) sinal(); }, 30000);
      setInterval(recarrega, 5 * 60000);
      setInterval(desloca, 60000); desloca();
    }).catch(function (e) {
      if (semBanco(e)) aviso("Falta atualizar o banco de dados.", "<p>No Supabase, abra SQL Editor, New query, cole o arquivo <b>20261128120000_camera_links.sql</b> e clique em Run. Depois recarregue esta página.</p>");
      else aviso("Não deu para carregar a câmera.", "<p>Confira a internet e recarregue a página.</p>");
    });
  }
  comeca();

  /* para os testes automáticos: o estado de dentro, sem expor nada do aparelho */
  window.__tx = { sinal: sinal, estado: function () { return { armada: armada, noAr: !!sess, ligando: ligando, modo: modo, erro: ultErro, alvo: alvoAtual, camera: !!stream }; } };
})();

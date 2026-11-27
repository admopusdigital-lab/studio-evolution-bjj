/* Studio Evolution BJJ · vídeo ao vivo pelo navegador (WebRTC), com a Cloudflare Stream.
   Vivo.enviar(url, stream, op)  manda a imagem de uma câmera para o link de envio (protocolo WHIP).
   Vivo.assistir(url, video)     toca a transmissão no link de assistir (protocolo WHEP).
   Sem biblioteca: usa só o que o navegador já tem. Cada chamada faz uma tentativa; quem chama decide quando
   tentar de novo (transmitir.js faz isso com espera crescente). A transmissão é sem som. */
(function () {
  "use strict";
  var ICE = [{ urls: "stun:stun.cloudflare.com:3478" }];
  var ESPERA_REDE = 15000;   /* a troca de endereços com o servidor */
  var ESPERA_LIGAR = 20000;  /* depois da troca, o vídeo começar a passar */

  function erro(tipo, extra) { var e = new Error(tipo); e.tipo = tipo; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }

  /* espera o navegador juntar os próprios endereços (assim a oferta já vai completa, em uma chamada só) */
  function esperaIce(pc, ms) {
    return new Promise(function (ok) {
      if (pc.iceGatheringState === "complete") return ok();
      var t = setTimeout(fim, ms);
      function ve() { if (pc.iceGatheringState === "complete") fim(); }
      function fim() { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", ve); ok(); }
      pc.addEventListener("icegatheringstatechange", ve);
    });
  }

  /* manda a oferta e recebe a resposta do servidor */
  function troca(url, pc) {
    var ac = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ac) ac.abort(); }, ESPERA_REDE);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: pc.localDescription.sdp, signal: ac ? ac.signal : undefined })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw erro("recusado", { status: r.status });
        var loc = null;
        try { loc = r.headers.get("Location"); } catch (e) {}
        return r.text().then(function (sdp) { return { sdp: sdp, recurso: loc ? new URL(loc, url).href : null }; });
      }, function (e) { clearTimeout(t); throw erro("sem-rede", { causa: e }); });
  }

  /* espera a ligação fechar de verdade (ou falhar) */
  function esperaLigar(pc) {
    return new Promise(function (ok, falha) {
      var t = setTimeout(function () { fim(erro("nao-ligou")); }, ESPERA_LIGAR);
      function ve() {
        if (pc.connectionState === "connected") fim();
        else if (pc.connectionState === "failed" || pc.connectionState === "closed") fim(erro("nao-ligou"));
      }
      function fim(e) { clearTimeout(t); pc.removeEventListener("connectionstatechange", ve); if (e) falha(e); else ok(); }
      pc.addEventListener("connectionstatechange", ve);
      ve();
    });
  }

  function encerra(pc, recurso) {
    try { pc.getSenders().forEach(function (s) { try { pc.removeTrack(s); } catch (e) {} }); } catch (e) {}
    try { pc.close(); } catch (e) {}
    /* avisa o servidor que acabou (se ele informou o endereço da sessão); sem resposta, a sessão expira sozinha */
    if (recurso) { try { fetch(recurso, { method: "DELETE", keepalive: true }).catch(function () {}); } catch (e) {} }
  }

  /* uma faixa de áudio em silêncio, para o servidor que exigir áudio: nenhum som do tatame sai do aparelho */
  function silencio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ac = new AC(), dst = ac.createMediaStreamDestination(), g = ac.createGain(), o = ac.createOscillator();
      g.gain.value = 0; o.connect(g); g.connect(dst); o.start();
      return { faixa: dst.stream.getAudioTracks()[0], fechar: function () { try { o.stop(); ac.close(); } catch (e) {} } };
    } catch (e) { return null; }
  }

  /* o H.264 que a Cloudflare aceita (perfil 42e01f) primeiro: o celular comprime por hardware e esquenta menos */
  function prefereH264(tr) {
    try {
      var caps = RTCRtpSender.getCapabilities("video").codecs;
      var h = caps.filter(function (c) { return /h264/i.test(c.mimeType) && /42e01f/i.test(c.sdpFmtpLine || "") && /packetization-mode=1/.test(c.sdpFmtpLine || ""); });
      if (!h.length || !tr.setCodecPreferences) return false;
      tr.setCodecPreferences(h.concat(caps.filter(function (c) { return h.indexOf(c) < 0; })));
      return true;
    } catch (e) { return false; }
  }

  var Vivo = {
    suporta: function () { return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },

    /* op: { kbps, qps, h264 (bool), audio (bool: manda uma faixa em silêncio), aoCair (fn) }
       resolve com a sessão { parar(), medir() } quando o vídeo está passando; rejeita com erro.tipo:
       "recusado" (com status), "sem-rede", "resposta-invalida", "nao-ligou" */
    enviar: function (url, stream, op) {
      op = op || {};
      var video = stream.getVideoTracks()[0];
      if (!video) return Promise.reject(erro("sem-camera"));
      var pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
      var mudo = null, recurso = null, vivo = true, ult = null;
      try { video.contentHint = "motion"; } catch (e) {}
      var tr = pc.addTransceiver(video, { direction: "sendonly", sendEncodings: [{ maxBitrate: (op.kbps || 1800) * 1000, maxFramerate: op.qps || 24 }] });
      var comH264 = op.h264 !== false && prefereH264(tr);
      if (op.audio) { mudo = silencio(); if (mudo) pc.addTransceiver(mudo.faixa, { direction: "sendonly" }); }

      function fecha() { if (!vivo) return; vivo = false; encerra(pc, recurso); if (mudo) mudo.fechar(); }

      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
        .then(function () { return esperaIce(pc, 2500); })
        .then(function () { return troca(url, pc); })
        .then(function (r) {
          recurso = r.recurso;
          return pc.setRemoteDescription({ type: "answer", sdp: r.sdp }).catch(function (e) { throw erro("resposta-invalida", { causa: e }); });
        })
        .then(function () { return esperaLigar(pc); })
        .then(function () {
          /* depois de ligada: se cair e não voltar em 8 segundos, avisa quem chamou */
          var tCai = null;
          pc.addEventListener("connectionstatechange", function () {
            if (!vivo) return;
            var s = pc.connectionState;
            clearTimeout(tCai);
            if (s === "failed" || s === "closed") caiu();
            else if (s === "disconnected") tCai = setTimeout(caiu, 8000);
          });
          function caiu() { if (!vivo) return; fecha(); if (op.aoCair) op.aoCair(); }
          return {
            h264: comH264,
            parar: function () { fecha(); },
            /* quanto está saindo: { kbps, qps, larg, alt, limite } */
            medir: function () {
              if (!vivo) return Promise.resolve(null);
              return pc.getStats().then(function (st) {
                var o = null;
                st.forEach(function (x) { if (x.type === "outbound-rtp" && (x.kind === "video" || x.mediaType === "video")) o = x; });
                if (!o) return null;
                var agora = { t: o.timestamp, b: o.bytesSent, f: o.framesEncoded }, m = { kbps: 0, qps: 0, larg: o.frameWidth || 0, alt: o.frameHeight || 0, limite: o.qualityLimitationReason || "none", quadros: o.framesEncoded || 0 };
                if (ult && agora.t > ult.t) { var s = (agora.t - ult.t) / 1000; m.kbps = Math.round((agora.b - ult.b) * 8 / s / 1000); m.qps = Math.round((agora.f - ult.f) / s); }
                ult = agora;
                return m;
              }).catch(function () { return null; });
            }
          };
        })
        .catch(function (e) { fecha(); throw e.tipo ? e : erro("falhou", { causa: e }); });
    },

    /* toca a transmissão num <video>. resolve com { parar() } quando a imagem chega;
       rejeita com erro.tipo: "fora-do-ar" (o link respondeu que não há transmissão), "sem-rede", "nao-ligou" */
    assistir: function (url, video, op) {
      op = op || {};
      function tenta(comAudio) {
        var pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
        var recurso = null, vivo = true, ms = new MediaStream();
        pc.addTransceiver("video", { direction: "recvonly" });
        if (comAudio) pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addEventListener("track", function (ev) { ms.addTrack(ev.track); });
        function fecha() { if (!vivo) return; vivo = false; try { video.srcObject = null; } catch (e) {} encerra(pc, recurso); }
        return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .then(function () { return esperaIce(pc, 2500); })
          .then(function () { return troca(url, pc); })
          .then(function (r) { recurso = r.recurso; return pc.setRemoteDescription({ type: "answer", sdp: r.sdp }).catch(function (e) { throw erro("resposta-invalida", { causa: e }); }); })
          .then(function () { return esperaLigar(pc); })
          .then(function () {
            video.muted = true; video.playsInline = true; video.srcObject = ms;
            var p = video.play(); if (p && p.catch) p.catch(function () {});
            pc.addEventListener("connectionstatechange", function () {
              if (vivo && (pc.connectionState === "failed" || pc.connectionState === "closed")) { fecha(); if (op.aoCair) op.aoCair(); }
            });
            return { parar: fecha };
          })
          .catch(function (e) { fecha(); throw e.tipo ? e : erro("falhou", { causa: e }); });
      }
      return tenta(true).catch(function (e) {
        /* servidor que não aceita pedir áudio numa transmissão sem som: tenta só o vídeo */
        if (e.tipo === "resposta-invalida" || (e.tipo === "recusado" && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 404 && e.status !== 409)) return tenta(false);
        throw e;
      }).catch(function (e) {
        if (e.tipo === "recusado" && (e.status === 404 || e.status === 409 || e.status === 400)) throw erro("fora-do-ar", { status: e.status });
        throw e;
      });
    }
  };

  window.Vivo = Vivo;
})();

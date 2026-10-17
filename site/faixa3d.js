/* Faixa em 3D realista (Three.js r149, carregado só quando a seção se aproxima).
   A faixa tem espessura e bordas arredondadas, relevo de trama e costuras (normal map gerado a partir
   de um mapa de altura do tecido), brilho de algodão (sheen), luz de estúdio com reflexos e sombra suave.
   Ela ondula no ar, reage ao mouse como uma corda (a onda corre pelo comprimento) e, na troca de faixa,
   uma volta inteira atravessa a faixa: cada trecho mostra a cor nova no meio do giro. Depois, os graus
   aparecem um a um na ponteira. Sem WebGL, Faixa3D devolve null e a página fica com o SVG. */
(function () {
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";

  /* carrega o Three.js uma vez só */
  var loading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loading) return loading;
    loading = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = THREE_URL; s.async = true;
      s.onload = function () { window.THREE ? ok(window.THREE) : fail(); };
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return loading;
  }

  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }

  function create(canvas, o) {
    var THREE = window.THREE;
    var small = !!o.small, reduce = !!o.reduce;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

    /* estúdio para os reflexos: sala escura com softbox em cima, rebatedor à esquerda e contraluz dourada */
    var pm = new THREE.PMREMGenerator(renderer);
    var env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x0b0a09, side: THREE.BackSide })));
    function panel(w, h, hex, k, pos) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(16, 5, 0xffffff, 3.4, [0, 13, 5]);
    panel(6, 12, 0xfff3e2, 1.5, [-15, 3, 7]);
    panel(6, 12, 0xe2b866, 2.6, [14, 1, -9]);
    panel(10, 3, 0xffffff, 0.8, [0, -6, 12]);
    var envRT = pm.fromScene(env, 0.035);
    scene.environment = envRT.texture;
    pm.dispose();

    var key = new THREE.DirectionalLight(0xfff2e0, 2.5);
    key.position.set(-4, 9, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 30;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.025;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xe8c27a, 1.5); rim.position.set(6, 2.5, -7); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xe6ecff, 0x1c140b, 0.35));

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.ShadowMaterial({ opacity: 0.5 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.45; ground.receiveShadow = true;
    scene.add(ground);

    /* ---------- a malha: um tubo achatado (seção de bordas arredondadas) que segue uma espinha ---------- */
    var L = 11.6, Wd = 1, T = 0.075, R = T / 2, NX = small ? 150 : 300, TILE = Wd * (1024 / 192);
    var sec = [], i, j, a, yy, nTop = 8, nCap = 6;
    for (i = 0; i <= nTop; i++) { yy = -Wd / 2 + R + (Wd - 2 * R) * i / nTop; sec.push([yy, T / 2, (yy + Wd / 2) / Wd, 1]); }
    for (i = 1; i < nCap; i++) { a = Math.PI / 2 - Math.PI * i / nCap; sec.push([Wd / 2 - R + R * Math.cos(a), R * Math.sin(a), 1, 0]); }
    for (i = 0; i <= nTop; i++) { yy = Wd / 2 - R - (Wd - 2 * R) * i / nTop; sec.push([yy, -T / 2, (yy + Wd / 2) / Wd, -1]); }
    for (i = 1; i < nCap; i++) { a = -Math.PI / 2 - Math.PI * i / nCap; sec.push([-Wd / 2 + R + R * Math.cos(a), R * Math.sin(a), 0, 0]); }
    sec.push(sec[0].slice());
    var NP = sec.length, nSide = (NX + 1) * NP, nCapV = NP + 1, nV = nSide + 2 * nCapV;
    var pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), aU = new Float32Array(nV), aMix = new Float32Array(nV), aFace = new Float32Array(nV);
    var idx = [];
    for (i = 0; i <= NX; i++) for (j = 0; j < NP; j++) {
      var vI = i * NP + j, s = i / NX;
      uv[vI * 2] = (s - 0.5) * L / TILE; uv[vI * 2 + 1] = sec[j][2];
      aU[vI] = s; aFace[vI] = sec[j][3];
    }
    for (i = 0; i < NX; i++) for (j = 0; j < NP - 1; j++) {
      var p0 = i * NP + j, p1 = p0 + NP;
      idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1);
    }
    /* as duas pontas cortadas da faixa */
    function capIdx(base, ring, flip) {
      for (j = 0; j < NP - 1; j++) { if (flip) idx.push(base, ring + j + 1, ring + j); else idx.push(base, ring + j, ring + j + 1); }
    }
    var c0 = nSide, c1 = nSide + nCapV;
    for (j = 0; j < nCapV; j++) { aU[c0 + j] = 0; aU[c1 + j] = 1; uv[(c0 + j) * 2] = -0.5 * L / TILE; uv[(c1 + j) * 2] = 0.5 * L / TILE; uv[(c0 + j) * 2 + 1] = uv[(c1 + j) * 2 + 1] = 0.5; }
    capIdx(c0 + NP, c0, false);
    capIdx(c1 + NP, c1, true);

    var geo = new THREE.BufferGeometry();
    var posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
    var mixAttr = new THREE.BufferAttribute(aMix, 1); mixAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
    geo.setAttribute("aMix", mixAttr);
    geo.setAttribute("aFace", new THREE.BufferAttribute(aFace, 1));
    geo.setIndex(idx);

    /* ---------- texturas ---------- */
    var tl = new THREE.TextureLoader();
    var nrm = tl.load(o.normal), det = tl.load(o.detail);
    [nrm, det].forEach(function (t) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });

    /* o bordado da academia perto da ponta esquerda, em fio dourado */
    var lc = document.createElement("canvas"); lc.width = 1024; lc.height = 192;
    var lx = lc.getContext("2d");
    lx.font = "400 92px 'Archivo Black', Arial Black, sans-serif";
    lx.textBaseline = "middle"; lx.textAlign = "center";
    lx.fillStyle = "#fff";
    lx.save(); lx.scale(1, 1); lx.fillText(o.label || "STUDIO EVOLUTION", 512, 100); lx.restore();
    /* pontos do bordado: o fio em diagonal recorta a letra */
    lx.globalCompositeOperation = "destination-out";
    for (i = -192; i < 1024; i += 5) { lx.beginPath(); lx.moveTo(i, 192); lx.lineTo(i + 70, 0); lx.lineWidth = 1.1; lx.strokeStyle = "rgba(0,0,0,.55)"; lx.stroke(); }
    var label = new THREE.CanvasTexture(lc);
    label.anisotropy = renderer.capabilities.getMaxAnisotropy();

    function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
    var U = {
      uColA: { value: lin(o.colors[0]) }, uColB: { value: lin(o.colors[0]) },
      uTipA: { value: lin(o.tips[0]) }, uTipB: { value: lin(o.tips[0]) },
      uGA: { value: 4 }, uGB: { value: 4 }, uLabel: { value: label }
    };
    var mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.9, metalness: 0, map: det, normalMap: nrm, normalScale: new THREE.Vector2(0.6, -0.6),
      sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.7, 0.7, 0.72), envMapIntensity: 1.25
    });
    mat.onBeforeCompile = function (sh) {
      for (var k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = "attribute float aU;\nattribute float aMix;\nattribute float aFace;\nvarying float vU;\nvarying float vMix;\nvarying float vFace;\nvarying float vV;\n" +
        sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n  vU = aU; vMix = aMix; vFace = aFace; vV = uv.y;");
      sh.fragmentShader = "uniform vec3 uColA, uColB, uTipA, uTipB;\nuniform float uGA, uGB;\nuniform sampler2D uLabel;\nvarying float vU;\nvarying float vMix;\nvarying float vFace;\nvarying float vV;\n" +
        sh.fragmentShader
          .replace("vec4 diffuseColor = vec4( diffuse, opacity );", [
            "vec4 diffuseColor = vec4( diffuse, opacity );",
            "  float nb = smoothstep(.47, .53, vMix);",
            "  vec3 fab = mix(uColA, uColB, nb);",
            "  vec3 tipc = mix(uTipA, uTipB, nb);",
            "  float gr = nb > .5 ? uGB : uGA;",
            "  float inTip = step(.74, vU) * step(vU, .93);",
            "  float tu = (vU - .74) / .19;",
            "  float tape = 0.;",
            "  for (int k = 0; k < 4; k++) {",
            "    float a0 = .78 - float(k) * .13;",
            "    float on = clamp(gr - float(k), 0., 1.);",
            "    tape += step(a0, tu) * step(tu, a0 + .065) * step(abs(vV - .5), .5 * on + .001) * step(.001, on);",
            "  }",
            "  vec3 albedo = mix(fab, tipc, inTip);",
            "  albedo = mix(albedo, vec3(.83, .82, .8), clamp(tape, 0., 1.) * inTip);",
            "  float goldAmt = 0.;",
            "  if (vFace < -.5 && vU > .045 && vU < .245) {",
            "    goldAmt = texture2D(uLabel, vec2((vU - .045) / .2, vV)).a;",
            "    albedo = mix(albedo, vec3(.58, .41, .14), goldAmt);",
            "  }",
            "  diffuseColor.rgb = albedo;"
          ].join("\n"))
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, .42, goldAmt);\n  roughnessFactor = mix(roughnessFactor, .55, clamp(tape, 0., 1.) * inTip);")
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, .55, goldAmt);");
    };
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    var group = new THREE.Group(); group.add(mesh); scene.add(group);

    /* ---------- movimento ---------- */
    var S = { t: 0, prog: 1, idle: reduce ? 0 : 1, tx: 0, ty: 0, cx: 0, cy: 0 };
    var oz = new Float32Array(NX + 1), vz = new Float32Array(NX + 1), oy = new Float32Array(NX + 1), vy = new Float32Array(NX + 1);
    var P = new Float32Array((NX + 1) * 3), TH = new Float32Array(NX + 1), LOC = new Float32Array(NX + 1);
    var ptr = { on: false, x: 0, y: 0, px: 0 }, SPAN = 4.6;
    function deform(dt) {
      var t = S.t, idle = S.idle, front = S.prog * (L + SPAN * 2) - SPAN;
      /* a corda: cada trecho puxa os vizinhos, então o toque do mouse vira uma onda que corre */
      if (!reduce) for (i = 0; i <= NX; i++) {
        var x = (i / NX - 0.5) * L, g = 0;
        if (ptr.on) { var dx = x - ptr.x; g = Math.exp(-dx * dx / 0.9); }
        var lap = (i > 0 && i < NX) ? (oz[i - 1] + oz[i + 1] - 2 * oz[i]) : 0;
        var lapy = (i > 0 && i < NX) ? (oy[i - 1] + oy[i + 1] - 2 * oy[i]) : 0;
        vz[i] += ((g * 0.75 - oz[i]) * 9 + lap * 500) * dt; vz[i] *= Math.pow(0.18, dt);
        vy[i] += ((g * ptr.y * 0.35 - oy[i]) * 9 + lapy * 500) * dt; vy[i] *= Math.pow(0.18, dt);
      }
      for (i = 0; i <= NX; i++) {
        if (!reduce) { oz[i] += vz[i] * dt; oy[i] += vy[i] * dt; }
        var x2 = (i / NX - 0.5) * L, d = x2 + L / 2;
        var lo = Math.min(1, Math.max(0, (front - d) / SPAN + 0.5)); lo = lo * lo * (3 - 2 * lo);
        LOC[i] = lo;
        var wav = idle * (0.34 * Math.sin(x2 * 0.5 + t * 1.05) + 0.1 * Math.sin(x2 * 1.3 - t * 1.7));
        TH[i] = lo * Math.PI * 2 + wav;
        var lift = Math.sin(lo * Math.PI);
        P[i * 3] = x2;
        P[i * 3 + 1] = idle * 0.12 * Math.sin(x2 * 0.3 + t * 0.8) + 0.3 * lift + 0.02 * x2 * x2 * (0.4 + 0.6 * idle) - 0.25 + oy[i];
        P[i * 3 + 2] = idle * 0.5 * Math.sin(x2 * 0.38 - t * 1.2) + 1.0 * lift + oz[i];
      }
      var k = 0, tx, ty, tz, l, bx, by, bz, nx, ny, nz;
      for (i = 0; i <= NX; i++) {
        var ia = Math.max(0, i - 1), ib = Math.min(NX, i + 1);
        tx = P[ib * 3] - P[ia * 3]; ty = P[ib * 3 + 1] - P[ia * 3 + 1]; tz = P[ib * 3 + 2] - P[ia * 3 + 2];
        l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
        /* referencial da seção: "cima" perpendicular à espinha e a frente (N = T × B) */
        var dot = ty; bx = -tx * dot; by = 1 - ty * dot; bz = -tz * dot;
        l = Math.hypot(bx, by, bz); bx /= l; by /= l; bz /= l;
        nx = ty * bz - tz * by; ny = tz * bx - tx * bz; nz = tx * by - ty * bx;
        var c = Math.cos(TH[i]), sn = Math.sin(TH[i]);
        var ux = bx * c + nx * sn, uy = by * c + ny * sn, uz = bz * c + nz * sn;
        var ox = -bx * sn + nx * c, oy2 = -by * sn + ny * c, oz2 = -bz * sn + nz * c;
        var px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        for (j = 0; j < NP; j++) {
          var sy = sec[j][0], sz = sec[j][1];
          pos[k] = px + ux * sy + ox * sz; pos[k + 1] = py + uy * sy + oy2 * sz; pos[k + 2] = pz + uz * sy + oz2 * sz;
          aMix[i * NP + j] = LOC[i];
          k += 3;
        }
      }
      /* tampas: centro + anel copiado das pontas */
      function cap(ci, ring) {
        var cx = 0, cy = 0, cz = 0;
        for (j = 0; j < NP; j++) {
          var src = (ring * NP + j) * 3, dst = (ci + j) * 3;
          pos[dst] = pos[src]; pos[dst + 1] = pos[src + 1]; pos[dst + 2] = pos[src + 2];
          aMix[ci + j] = LOC[ring];
          cx += pos[src]; cy += pos[src + 1]; cz += pos[src + 2];
        }
        var ce = (ci + NP) * 3; pos[ce] = cx / NP; pos[ce + 1] = cy / NP; pos[ce + 2] = cz / NP; aMix[ci + NP] = LOC[ring];
      }
      cap(c0, 0); cap(c1, NX);
      posAttr.needsUpdate = true; mixAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }

    /* ---------- câmera e tamanho ---------- */
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var tn = Math.tan(camera.fov * Math.PI / 360);
      var d = Math.max((L * 0.6) / (tn * camera.aspect), 2.6 / tn);
      camera.position.set(0, d * 0.2, d);
      camera.lookAt(0, -0.25, 0);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    /* o mouse vira uma mão passando por baixo da faixa */
    var ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
    function onMove(e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) { group.worldToLocal(hit); ptr.on = Math.abs(hit.y) < 2.2; ptr.x = hit.x; ptr.y = Math.max(-1, Math.min(1, hit.y)); }
      S.tx = ndc.x * 0.18; S.ty = -ndc.y * 0.1;
    }
    function onLeave() { ptr.on = false; S.tx = 0; S.ty = 0; }
    if (o.fine && !reduce) { (o.hover || canvas).addEventListener("mousemove", onMove); (o.hover || canvas).addEventListener("mouseleave", onLeave); }

    var raf = 0, visible = true, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      S.t += dt;
      S.cx += (S.tx - S.cx) * 0.05; S.cy += (S.ty - S.cy) * 0.05;
      group.rotation.y = -0.2 + S.cx; group.rotation.x = 0.1 + S.cy;
      deform(dt);
      renderer.render(scene, camera);
    }
    function start() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    var io = null;
    if ("IntersectionObserver" in window) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }); io.observe(canvas); }
    deform(0); renderer.render(scene, camera);
    if (!reduce) start();

    var cur = 0, tw = null;
    function renderOnce() { if (!raf) { deform(0); renderer.render(scene, camera); } }
    return {
      set: function (n, animate) {
        if (n === cur) return;
        var from = cur; cur = n;
        if (S.prog > 0.5) { U.uColA.value.copy(U.uColB.value); U.uTipA.value.copy(U.uTipB.value); U.uGA.value = U.uGB.value; }
        U.uColB.value = lin(o.colors[n]); U.uTipB.value = lin(o.tips[n]);
        if (tw) tw.kill();
        if (!animate || reduce || !window.gsap) {
          S.prog = 1; U.uGB.value = 4; U.uColA.value.copy(U.uColB.value); U.uTipA.value.copy(U.uTipB.value); U.uGA.value = 4;
          renderOnce(); return;
        }
        S.prog = 0; U.uGB.value = 0;
        /* um tranco na ponta, como quem sacode a faixa antes de girar */
        for (i = 0; i <= 8; i++) vz[i] += (n > from ? 1 : -1) * 2.2 * (1 - i / 8);
        tw = gsap.timeline()
          .to(S, { prog: 1, duration: 1.6, ease: "power2.inOut" })
          .to(U.uGB, { value: 4, duration: 1.3, ease: "power1.inOut" }, 1.05);
      },
      ready: function () { return true; },
      destroy: function () {
        stop(); if (io) io.disconnect();
        window.removeEventListener("resize", resize);
        (o.hover || canvas).removeEventListener("mousemove", onMove); (o.hover || canvas).removeEventListener("mouseleave", onLeave);
        geo.dispose(); mat.dispose(); nrm.dispose(); det.dispose(); label.dispose(); envRT.dispose(); renderer.dispose();
      }
    };
  }

  /* Faixa3D.mount(canvas, opções, pronto): carrega o Three.js e chama pronto(api) ou pronto(null) */
  window.Faixa3D = {
    supported: hasGL,
    mount: function (canvas, o, done) {
      if (!hasGL()) { done(null); return; }
      loadThree().then(function () {
        var api = null;
        try { api = create(canvas, o); } catch (e) { if (window.console) console.warn("Faixa3D", e); api = null; }
        done(api);
      }, function () { done(null); });
    }
  };
})();

// Homestead title film (liftoff), world: ported to plain JS from src/ui/liftoff/world.ts
// (Homestead main @ 6c3d22c, seat 3 UI). Only the TypeScript types were removed; every other line is
// the original. Classic script: reads its imports from, and adds its exports to, window.HS.liftoff.
(() => {
  const L = window.HS.liftoff;
  const { clamp, fbm2, make, mix, LENS_F, LH, LN_PIXELS, LW, E1, E2, E3, bayer, camToBody, hash, lensDir, sstep } = L;

  // ---------- building the textures

  function* worldGen(self, dest, D) {
    const moon = dest === "moon";
    const sxh = D.sun[0];
    const szh = D.sun[2];
    const sl = Math.hypot(sxh, szh);
    const lx = sxh / sl;
    const lz = szh / sl;
    // a small seeded generator, so a destination always looks the same
    let seed = moon ? 91 : 17;
    const r = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // craters stamped into a tiling height field
    const craters = (hf, N, count, rmin, rmax, depth) => {
      for (let k = 0; k < count; k++) {
        const cx = r() * N;
        const cy = r() * N;
        const rad = rmin * Math.pow(rmax / rmin, Math.pow(r(), 2.4));
        const R2 = rad * 1.7;
        for (let y = Math.floor(cy - R2); y <= cy + R2; y++) {
          for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
            const dd = Math.hypot(x - cx, y - cy) / rad;
            if (dd > 1.7) continue;
            const p = dd < 1 ? dd * dd - 1 + 0.3 : 0.3 * Math.exp(-(((dd - 1) * 3.2) ** 2));
            hf[(((y % N) + N) % N) * N + (((x % N) + N) % N)] += p * depth * rad;
          }
        }
      }
    };
    const shade = (hf, N, x, y, gain) => {
      const gx = (hf[y * N + ((x + 1) % N)] - hf[y * N + ((x - 1 + N) % N)]) * 0.5;
      const gz = (hf[((y + 1) % N) * N + x] - hf[((y - 1 + N) % N) * N + x]) * 0.5;
      return 1 - (gx * lx + gz * lz) * gain;
    };
    // macro: colour with the relief baked in
    const MS = 512;
    const mh = new Float32Array(MS * MS);
    const mac = new Uint32Array(MS * MS);
    for (let y = 0; y < MS; y++) {
      for (let x = 0; x < MS; x++) mh[y * MS + x] = fbm2((x / MS) * 8, (y / MS) * 8, 8, 6) * (moon ? 2 : 3);
      if ((y & 31) === 31) yield;
    }
    craters(mh, MS, moon ? 420 : 160, 0.8, moon ? 26 : 18, moon ? 0.5 : 0.35);
    yield;
    const cD = moon ? [72, 72, 78] : [92, 50, 36];
    const cM = moon ? [128, 128, 134] : [158, 92, 60];
    const cB = moon ? [168, 168, 174] : [206, 132, 86];
    for (let y = 0; y < MS; y++) {
      for (let x = 0; x < MS; x++) {
        const a = fbm2((x / MS) * 5 + 3, (y / MS) * 5 + 1, 5, 5);
        const c = a < 0.47 ? mix(cD, cM, sstep(0.3, 0.47, a)) : mix(cM, cB, sstep(0.47, 0.66, a));
        const s = clamp(shade(mh, MS, x, y, moon ? 1.6 : 1.1), 0.35, 1.6);
        mac[y * MS + x] = (clamp(c[0] * s, 0, 255) | 0) | ((clamp(c[1] * s, 0, 255) | 0) << 8) | ((clamp(c[2] * s, 0, 255) | 0) << 16) | 0xff000000;
      }
      if ((y & 31) === 31) yield;
    }
    // mid: relief at 60 m
    const NS = 256;
    const hm = new Float32Array(NS * NS);
    const mid = new Uint8Array(NS * NS);
    for (let y = 0; y < NS; y++) {
      for (let x = 0; x < NS; x++) {
        hm[y * NS + x] = fbm2((x / NS) * 16, (y / NS) * 16, 16, 5) * 3 + (moon ? 0 : Math.sin((x + fbm2(x / 32, y / 32, 8, 2) * 40) * 0.35) * 0.05);
      }
      if ((y & 63) === 63) yield;
    }
    craters(hm, NS, moon ? 260 : 110, 0.6, 12, moon ? 0.45 : 0.3);
    yield;
    for (let y = 0; y < NS; y++) {
      for (let x = 0; x < NS; x++) {
        const a = fbm2((x / NS) * 12 + 7, (y / NS) * 12, 12, 3);
        mid[y * NS + x] = clamp(128 * shade(hm, NS, x, y, 2.4) * (0.8 + 0.4 * a), 0, 255);
      }
    }
    yield;
    // detail at 3 m: boulders and grain
    const hd = new Float32Array(NS * NS);
    const det = new Uint8Array(NS * NS);
    for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) hd[y * NS + x] = fbm2((x / NS) * 32, (y / NS) * 32, 32, 4) * 2;
    for (let k = 0; k < 520; k++) {
      const cx = r() * NS;
      const cy = r() * NS;
      const rad = 0.5 + Math.pow(r(), 3) * 3.5;
      for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
        for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          const dd = Math.hypot(x - cx, y - cy) / rad;
          if (dd > 1) continue;
          hd[(((y % NS) + NS) % NS) * NS + (((x % NS) + NS) % NS)] += Math.sqrt(1 - dd * dd) * rad * 0.9;
        }
      }
    }
    yield;
    for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) det[y * NS + x] = clamp(128 * shade(hd, NS, x, y, 1.4) * (0.9 + 0.2 * r()), 0, 255);
    yield;
    // the homestead from above, plus the lights that shine in the dark
    const [, bx] = make(1024, 1024);
    const [, ex] = make(1024, 1024);
    drawBaseTop(bx, ex, moon);
    yield;
    const ba = new Uint32Array(bx.getImageData(0, 0, 1024, 1024).data.buffer);
    const be = new Uint32Array(ex.getImageData(0, 0, 1024, 1024).data.buffer);
    self.value = { mac, mid, det, ba, be, D };
  }

  /** the base seen from straight above: x is downrange metres, z is sideways, two texels a metre */
  function drawBaseTop(x, e, moon) {
    const M = (m) => 512 + m * 2;
    const disc = (c, cx, cz, r, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(M(cx), M(cz), r * 2, 0, Math.PI * 2);
      c.fill();
    };
    const rect = (c, x0, z0, x1, z1, col) => {
      c.fillStyle = col;
      c.fillRect(M(x0), M(z0), (x1 - x0) * 2, (z1 - z0) * 2);
    };
    const conc = moon ? "#8e8e94" : "#6c6474";
    const concD = moon ? "#6e6e74" : "#544c5c";
    const road = moon ? "#9a9aa0" : "#7a5444";
    // roads and tracks
    x.strokeStyle = road;
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(M(-20), M(-6));
    x.lineTo(M(-70), M(-28));
    x.lineTo(M(-100), M(-34));
    x.stroke();
    x.lineWidth = 6;
    x.beginPath();
    x.moveTo(M(20), M(10));
    x.quadraticCurveTo(M(40), M(60), M(130), M(70));
    x.stroke();
    x.strokeStyle = moon ? "#5a5a60" : "#4a2e26";
    x.lineWidth = 1;
    for (const o of [-2, 2]) {
      x.beginPath();
      x.moveTo(M(30) + o, M(48));
      x.bezierCurveTo(M(10) + o, M(90), M(-60) + o, M(70), M(-130) + o, M(110));
      x.stroke();
    }
    // launch pad: concrete, a scorched centre, a dashed ring and the flame trench
    disc(x, 0, 0, 30, conc);
    disc(x, 0, 0, 27, concD);
    disc(x, 0, 0, 25, conc);
    rect(x, -60, -5, -12, 5, "#1a1418");
    rect(x, -60, -5, -12, -4, "#3a3238");
    const sc = x.createRadialGradient(M(0), M(0), 0, M(0), M(0), 30);
    sc.addColorStop(0, "rgba(20,14,16,.95)");
    sc.addColorStop(1, "rgba(20,14,16,0)");
    x.fillStyle = sc;
    x.beginPath();
    x.arc(M(0), M(0), 30, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#f2c040";
    x.lineWidth = 2;
    x.setLineDash([6, 6]);
    x.beginPath();
    x.arc(M(0), M(0), 46, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    rect(x, -10, -12, -4, -6, "#2a3140");
    for (const [fx, fz] of [[18, 18], [-18, 20], [20, -20]]) {
      rect(x, fx - 1, fz - 1, fx + 1, fz + 1, "#3a4458");
      disc(e, fx, fz, 1.2, "#fff0c0");
    }
    // domes with a ring of windows and a skylight
    const dome = (cx, cz, rr, seed) => {
      disc(x, cx, cz, rr + 0.5, "#0a0f1c");
      const gr = x.createRadialGradient(M(cx - rr * 0.35), M(cz - rr * 0.35), 1, M(cx), M(cz), rr * 2);
      gr.addColorStop(0, moon ? "#d4d4da" : "#eef0f4");
      gr.addColorStop(0.7, moon ? "#a2a2aa" : "#c8ccd6");
      gr.addColorStop(1, moon ? "#6e6e78" : "#8a92a2");
      x.fillStyle = gr;
      x.beginPath();
      x.arc(M(cx), M(cz), rr * 2, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "rgba(60,66,80,.6)";
      x.lineWidth = 1;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        x.beginPath();
        x.moveTo(M(cx), M(cz));
        x.lineTo(M(cx + Math.cos(a) * rr), M(cz + Math.sin(a) * rr));
        x.stroke();
      }
      x.beginPath();
      x.arc(M(cx), M(cz), rr * 1.2, 0, Math.PI * 2);
      x.stroke();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + seed;
        if (hash(seed * 9 + k) > 0.25) {
          const wx = cx + Math.cos(a) * rr * 0.86;
          const wz = cz + Math.sin(a) * rr * 0.86;
          rect(e, wx - 0.6, wz - 0.6, wx + 0.6, wz + 0.6, "#ffcf6a");
        }
      }
      disc(e, cx, cz, rr * 0.18, "#ffe6a8");
    };
    rect(x, -80, -30, -36, -24, "#b4bcca");
    rect(x, -80, -30, -36, -29, "#e8ecf2");
    for (let m = -78; m < -38; m += 4) rect(e, m, -27.6, m + 1, -26.6, "#ffcf6a");
    dome(-95, -35, 13, 1);
    dome(-70, -68, 8, 2);
    // greenhouse: a long glass hall glowing pink from its grow lights
    rect(x, -152, -22, -112, -6, "#2a3442");
    for (let m = -150; m < -114; m += 3) rect(e, m, -20, m + 2, -8, m % 6 === 0 ? "#ff7ad0" : "#c04aa8");
    for (let m = -150; m < -112; m += 3) rect(x, m, -22, m + 0.5, -6, "#4a5a6a");
    // solar field
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 6; i++) {
        rect(x, 34 + i * 9, -84 + j * 11, 42 + i * 9, -78 + j * 11, "#1d2f6a");
        rect(x, 34 + i * 9, -84 + j * 11, 42 + i * 9, -83 + j * 11, moon ? "#7a86a8" : "#8ab4e8");
      }
    }
    // relay dish and its shadow
    disc(x, 72, 24, 5.2, "#0a0f1c");
    disc(x, 72, 24, 5, moon ? "#c8c8ce" : "#e8ecf2");
    disc(x, 73, 25, 3, moon ? "#9a9aa2" : "#b4bcca");
    disc(e, 70, 22, 0.6, "#ff5a50");
    // the rover, out on the track with its headlights on
    rect(x, 28, 44, 33, 47, "#0a0f1c");
    rect(x, 28.3, 44.3, 32.7, 46.7, "#d8dce4");
    rect(x, 28.3, 45.3, 32.7, 45.8, "#f08c32");
    rect(e, 27, 44.5, 28, 45, "#fff2c8");
    rect(e, 27, 46, 28, 46.5, "#fff2c8");
    disc(e, 31, 45.5, 0.5, "#ffb43c");
    // the old landing pad, with a parked lander
    disc(x, 150, 70, 14, conc);
    x.strokeStyle = "#f2c040";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(M(140), M(60));
    x.lineTo(M(160), M(80));
    x.moveTo(M(160), M(60));
    x.lineTo(M(140), M(80));
    x.stroke();
    disc(x, 150, 70, 3.5, "#0a0f1c");
    disc(x, 150, 70, 3, "#c8a040");
    disc(e, 150, 70, 0.5, "#78ffdc");
    // path lights along the road
    for (let k = 0; k < 12; k++) {
      const m = -20 - k * 6.5;
      rect(e, m, -6 - k * 2.2 + 3, m + 0.8, -6 - k * 2.2 + 3.8, "#ffd27a");
    }
  }

  // ---------- drawing it

  const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  const FS = `precision highp float;
uniform vec3 uE1, uE2, uE3, uBw, uAw, uZw, uO, uSun, uAmb, uSunC, uTwi, uHazeD, uHazeL, uSky, uBlue;
uniform float uRp, uH, uF, uAtm, uHs, uKH, uK2, uAvgD, uL0, uIL, uSkyL, uPG, uPR2;
uniform sampler2D tMac, tMid, tDet, tBase, tEmit, tBay;
void main() {
  vec2 px = vec2(gl_FragCoord.x, 360.0 - gl_FragCoord.y) * 2.0;
  vec2 q = px - vec2(640.0, 360.0);
  float rp = max(length(q), 1e-4), th = 2.0 * atan(rp / (2.0 * uF)), sn = sin(th);
  vec3 dc = vec3(sn * q.x / rp, -sn * q.y / rp, cos(th));
  vec3 db = vec3(-dot(dc, uE2), -dot(dc, uE1), dot(dc, uE3));
  vec3 d = normalize(db.x * uBw + db.y * uAw + db.z * uZw);
  float bb = dot(uO, d), cl = length(cross(uO, d)), hc = cl - uRp, mu = dot(d, uSun);
  vec3 col;
  if (bb < 0.0 && hc < 0.0) {
    float disc = -hc * (2.0 * uRp + hc), cc = uH * (2.0 * uRp + uH);
    float tt = cc / (-bb + sqrt(disc));
    vec3 hp = uO + d * tt;
    float cosI = -dot(d, hp) / uRp, f = tt * (2.0 / uF) / max(cosI, 0.12);
    col = texture2D(tMac, vec2(hp.x * 0.2 + 256.5, hp.z * 0.2 + 256.5) / 512.0).rgb * 255.0;
    if (f < 0.5) {
      float wm = f < 0.12 ? 1.0 : (0.5 - f) * 2.63;
      float m = 1.0 + (texture2D(tMid, hp.xz * 16.667 / 256.0).r * 255.0 - 128.0) * 0.0048 * wm;
      if (f < 0.025) { float wd = f < 0.006 ? 1.0 : (0.025 - f) * 52.6; m *= 1.0 + (texture2D(tDet, hp.xz * 333.3 / 256.0).r * 255.0 - 128.0) * 0.0042 * wd; }
      col *= m;
    }
    vec3 em = vec3(0.0);
    if (f < 0.01 && abs(hp.x) < 0.255 && abs(hp.z) < 0.255) {
      vec2 bu = (hp.xz * 2000.0 + 512.0) / 1024.0;
      float wb = f < 0.004 ? 1.0 : (0.01 - f) * 166.0;
      vec4 ca = texture2D(tBase, bu);
      if (ca.a > 0.5) col = mix(col, ca.rgb * 255.0, wb);
      vec4 ce = texture2D(tEmit, bu);
      if (ce.a > 0.5) em = ce.rgb * 255.0 * wb * 1.2;
    }
    float ndl = dot(hp, uSun) / uRp;
    float k = clamp((ndl - uL0) * uIL, 0.0, 1.0), lit = k * k * (3.0 - 2.0 * k);
    float tw = (ndl > -0.07 && ndl < 0.05) ? 1.0 - abs(ndl + 0.01) * 16.6 : 0.0;
    col = col * (uAmb + uSunC * lit + uTwi * tw) + em;
    if (uPG > 0.0) { float d2 = dot(hp.xz, hp.xz); col += vec3(255.0, 125.0, 45.0) * uPG * exp(-d2 / uPR2); }
    if (uAtm > 0.5) { float tr = exp(-uKH * tt * uAvgD), sw = mu > 0.0 ? mu * mu : 0.0; col = col * tr + mix(uHazeD, uHazeL, sw) * (1.0 - tr) * uSkyL; }
  } else if (uAtm > 0.5) {
    float ht = bb < 0.0 ? max(hc, 0.0) : uH;
    float sc = 1.0 - exp(-uK2 * exp(-ht / uHs));
    float fw = mu > 0.0 ? mu * mu : 0.0; fw *= fw;
    float core = pow(max(mu, 0.0), 32.0), lum = sc * uSkyL;
    col = mix(uSky, uBlue, fw) * lum + vec3(255.0, 250.0, 245.0) * core * sc;
  } else col = vec3(0.0);
  col += (texture2D(tBay, gl_FragCoord.xy / 4.0).r - 0.5) * 8.0;
  gl_FragColor = vec4(clamp(col / 255.0, 0.0, 1.0), 1.0);
}`;

  const UNIFORMS = ["uE1", "uE2", "uE3", "uBw", "uAw", "uZw", "uO", "uSun", "uAmb", "uSunC", "uTwi", "uHazeD", "uHazeL", "uSky", "uBlue", "uRp", "uH", "uF", "uAtm", "uHs", "uKH", "uK2", "uAvgD", "uL0", "uIL", "uSkyL", "uPG", "uPR2", "tMac", "tMid", "tDet", "tBase", "tEmit", "tBay"];

  function gpuRenderer() {
    try {
      const c = document.createElement("canvas");
      c.width = LW;
      c.height = LH;
      const gl = c.getContext("webgl", { antialias: false, alpha: false, depth: false, premultipliedAlpha: false });
      if (!gl) return null;
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (!hp || hp.precision < 20) return null;
      const sh = (type, src) => {
        const o = gl.createShader(type);
        if (!o) throw new Error("no shader");
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? "shader");
        return o;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const tex = (unit, w, h, fmt, data, linear, repeat) => {
        const t = gl.createTexture();
        if (!t) throw new Error("no texture");
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
        const fl = linear ? gl.LINEAR : gl.NEAREST;
        const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, fl);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
        return t;
      };
      const bay = tex(5, 4, 4, gl.LUMINANCE, Uint8Array.from(Array.from({ length: 16 }, (_, i) => bayer(i & 3, i >> 2) * 255)), false, true);
      const set3 = (n, v) => gl.uniform3f(U[n], v[0], v[1], v[2]);
      set3("uE1", E1);
      set3("uE2", E2);
      set3("uE3", E3);
      gl.uniform1f(U.uF, LENS_F);
      ["tMac", "tMid", "tDet", "tBase", "tEmit", "tBay"].forEach((n, i) => gl.uniform1i(U[n], i));
      let cur = null;
      return {
        canvas: c,
        gpu: true,
        render(st, T) {
          if (cur !== T) {
            T.gl ??= [
              tex(0, 512, 512, gl.RGBA, new Uint8Array(T.mac.buffer), true, true),
              tex(1, 256, 256, gl.LUMINANCE, T.mid, true, true),
              tex(2, 256, 256, gl.LUMINANCE, T.det, true, true),
              tex(3, 1024, 1024, gl.RGBA, new Uint8Array(T.ba.buffer), false, false),
              tex(4, 1024, 1024, gl.RGBA, new Uint8Array(T.be.buffer), false, false),
            ];
            T.gl.forEach((t, i) => {
              gl.activeTexture(gl.TEXTURE0 + i);
              gl.bindTexture(gl.TEXTURE_2D, t);
            });
            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, bay);
            const D = T.D;
            set3("uSun", D.sun);
            set3("uAmb", D.amb);
            set3("uSunC", D.sunC);
            set3("uTwi", D.twi);
            set3("uHazeD", D.hazeD);
            set3("uHazeL", D.hazeL);
            set3("uSky", D.sky);
            set3("uBlue", D.blue);
            gl.uniform1f(U.uRp, D.Rp);
            gl.uniform1f(U.uAtm, D.atm ? 1 : 0);
            gl.uniform1f(U.uHs, D.atm ? D.atm.H : 1);
            gl.uniform1f(U.uKH, D.atm ? D.atm.k : 0);
            gl.uniform1f(U.uK2, D.atm ? D.atm.k2 : 0);
            gl.uniform1f(U.uL0, D.lit0);
            gl.uniform1f(U.uIL, 1 / (D.lit1 - D.lit0));
            cur = T;
          }
          const D = T.D;
          const h = st.h;
          set3("uBw", st.bw);
          set3("uAw", st.aw);
          set3("uZw", st.zw);
          set3("uO", st.O);
          gl.uniform1f(U.uH, h);
          gl.uniform1f(U.uAvgD, D.atm ? (h > 1e-3 ? (D.atm.H * (1 - Math.exp(-h / D.atm.H))) / h : 1) : 0);
          gl.uniform1f(U.uSkyL, st.skyLight);
          gl.uniform1f(U.uPG, st.padGlow);
          gl.uniform1f(U.uPR2, st.padR2);
          gl.viewport(0, 0, LW, LH);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
      };
    } catch (e) {
      console.warn("liftoff: WebGL world is off, using the slower fallback", e);
      return null;
    }
  }

  /** the same picture in plain JS: half the rows each frame, so it costs half as much */
  function cpuRenderer() {
    const [canvas, ctx] = make(LW, LH);
    const img = ctx.createImageData(LW, LH);
    const out = new Uint32Array(img.data.buffer);
    const RAY = new Float32Array(LN_PIXELS * 3);
    const DITH = new Float32Array(LN_PIXELS);
    for (let j = 0; j < LH; j++) {
      for (let i = 0; i < LW; i++) {
        const d = camToBody(lensDir(i * 2 + 1, j * 2 + 1));
        const k = j * LW + i;
        RAY[k * 3] = d[0];
        RAY[k * 3 + 1] = d[1];
        RAY[k * 3 + 2] = d[2];
        DITH[k] = bayer(i, j) - 0.5;
      }
    }
    const bil8 = (A, u, v) => {
      let u0 = Math.floor(u);
      let v0 = Math.floor(v);
      const fu = u - u0;
      const fv = v - v0;
      u0 &= 255;
      v0 &= 255;
      const u1 = (u0 + 1) & 255;
      const v1 = (v0 + 1) & 255;
      const a = A[(v0 << 8) | u0];
      const b = A[(v0 << 8) | u1];
      const c = A[(v1 << 8) | u0];
      const d = A[(v1 << 8) | u1];
      return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
    };
    let parity = 0;
    return {
      canvas,
      gpu: false,
      render(st, T, skip, full) {
        parity ^= 1;
        const par = full ? -1 : parity;
        const D = T.D;
        const Rp = D.Rp;
        const atm = D.atm;
        const h = st.h;
        const [Ox, Oy, Oz] = st.O;
        const OO = Ox * Ox + Oy * Oy + Oz * Oz;
        const cc = OO - Rp * Rp;
        const [b0, b1, b2] = st.bw;
        const [a0, a1, a2] = st.aw;
        const [z0, z1, z2] = st.zw;
        const [sx, sy, sz] = D.sun;
        const Hs = atm ? atm.H : 1;
        const kH = atm ? atm.k : 0;
        const k2 = atm ? atm.k2 : 0;
        const avgD = atm ? (h > 1e-3 ? (Hs * (1 - Math.exp(-h / Hs))) / h : 1) : 0;
        const pxA = 2 / LENS_F;
        const { mac: MAC, mid: MID, det: DET, ba: BA, be: BE } = T;
        const [amR, amG, amB] = D.amb;
        const [suR, suG, suB] = D.sunC;
        const [twR, twG, twB] = D.twi;
        const l0 = D.lit0;
        const il = 1 / (D.lit1 - D.lit0);
        const skL = st.skyLight;
        const pg = st.padGlow;
        const pr2 = st.padR2;
        for (let i = 0; i < LN_PIXELS; i++) {
          if (par >= 0 && (((i / LW) | 0) & 1) !== par) {
            i += LW - 1;
            continue;
          }
          if (skip[i]) {
            out[i] = 0xff000000;
            continue;
          }
          const j = i * 3;
          const rx = RAY[j];
          const ry = RAY[j + 1];
          const rz = RAY[j + 2];
          const dx = rx * b0 + ry * a0 + rz * z0;
          const dy = rx * b1 + ry * a1 + rz * z1;
          const dz = rx * b2 + ry * a2 + rz * z2;
          const bb = Ox * dx + Oy * dy + Oz * dz;
          const disc = bb * bb - cc;
          const mu = dx * sx + dy * sy + dz * sz;
          let r;
          let gr;
          let bl;
          if (bb < 0 && disc > 0) {
            const tt = -bb - Math.sqrt(disc);
            const hx = Ox + dx * tt;
            const hy = Oy + dy * tt;
            const hz = Oz + dz * tt;
            const cosI = -(dx * hx + dy * hy + dz * hz) / Rp;
            const f = (tt * pxA) / (cosI > 0.12 ? cosI : 0.12);
            const u = hx * 0.2 + 256;
            const v = hz * 0.2 + 256;
            let u0 = Math.floor(u);
            let v0 = Math.floor(v);
            const fu = u - u0;
            const fv = v - v0;
            u0 &= 511;
            v0 &= 511;
            const u1 = (u0 + 1) & 511;
            const v1 = (v0 + 1) & 511;
            const c00 = MAC[(v0 << 9) | u0];
            const c10 = MAC[(v0 << 9) | u1];
            const c01 = MAC[(v1 << 9) | u0];
            const c11 = MAC[(v1 << 9) | u1];
            const w00 = (1 - fu) * (1 - fv);
            const w10 = fu * (1 - fv);
            const w01 = (1 - fu) * fv;
            const w11 = fu * fv;
            r = (c00 & 255) * w00 + (c10 & 255) * w10 + (c01 & 255) * w01 + (c11 & 255) * w11;
            gr = ((c00 >> 8) & 255) * w00 + ((c10 >> 8) & 255) * w10 + ((c01 >> 8) & 255) * w01 + ((c11 >> 8) & 255) * w11;
            bl = ((c00 >> 16) & 255) * w00 + ((c10 >> 16) & 255) * w10 + ((c01 >> 16) & 255) * w01 + ((c11 >> 16) & 255) * w11;
            if (f < 0.5) {
              const wm = f < 0.12 ? 1 : (0.5 - f) * 2.63;
              let m = 1 + (bil8(MID, hx * 16.667, hz * 16.667) - 128) * 0.0048 * wm;
              if (f < 0.025) {
                const wd = f < 0.006 ? 1 : (0.025 - f) * 52.6;
                m *= 1 + (bil8(DET, hx * 333.3, hz * 333.3) - 128) * 0.0042 * wd;
              }
              r *= m;
              gr *= m;
              bl *= m;
            }
            let er = 0;
            let eg = 0;
            let eb = 0;
            if (f < 0.01 && hx > -0.255 && hx < 0.255 && hz > -0.255 && hz < 0.255) {
              const bi = (((hz * 2000 + 512) | 0) << 10) | ((hx * 2000 + 512) | 0);
              const wb = f < 0.004 ? 1 : (0.01 - f) * 166;
              const ca = BA[bi];
              if (ca >>> 24) {
                r += ((ca & 255) - r) * wb;
                gr += (((ca >> 8) & 255) - gr) * wb;
                bl += (((ca >> 16) & 255) - bl) * wb;
              }
              const ce = BE[bi];
              if (ce >>> 24) {
                er = (ce & 255) * wb * 1.2;
                eg = ((ce >> 8) & 255) * wb * 1.2;
                eb = ((ce >> 16) & 255) * wb * 1.2;
              }
            }
            const ndl = (hx * sx + hy * sy + hz * sz) / Rp;
            let k = (ndl - l0) * il;
            k = k < 0 ? 0 : k > 1 ? 1 : k;
            const lit = k * k * (3 - 2 * k);
            const tw = ndl > -0.07 && ndl < 0.05 ? 1 - Math.abs(ndl + 0.01) * 16.6 : 0;
            r = r * (amR + suR * lit + twR * tw) + er;
            gr = gr * (amG + suG * lit + twG * tw) + eg;
            bl = bl * (amB + suB * lit + twB * tw) + eb;
            if (pg > 0) {
              const d2 = hx * hx + hz * hz;
              if (d2 < pr2 * 12) {
                const gl = pg * Math.exp(-d2 / pr2);
                r += 255 * gl;
                gr += 125 * gl;
                bl += 45 * gl;
              }
            }
            if (atm) {
              const tr = Math.exp(-kH * tt * avgD);
              const sw = mu > 0 ? mu * mu : 0;
              const q = (1 - tr) * skL;
              r = r * tr + (D.hazeD[0] + (D.hazeL[0] - D.hazeD[0]) * sw) * q;
              gr = gr * tr + (D.hazeD[1] + (D.hazeL[1] - D.hazeD[1]) * sw) * q;
              bl = bl * tr + (D.hazeD[2] + (D.hazeL[2] - D.hazeD[2]) * sw) * q;
            }
          } else if (atm) {
            let ht;
            const tca = -bb;
            if (tca > 0) {
              const q = OO - tca * tca;
              ht = (q > 0 ? Math.sqrt(q) : 0) - Rp;
            } else ht = h;
            if (ht < 0) ht = 0;
            const sc = 1 - Math.exp(-k2 * Math.exp(-ht / Hs));
            let fw = mu > 0 ? mu * mu : 0;
            fw *= fw;
            let core = fw * fw;
            core *= core;
            core *= core;
            const lum = sc * skL;
            r = (D.sky[0] + (D.blue[0] - D.sky[0]) * fw) * lum + 255 * core * sc;
            gr = (D.sky[1] + (D.blue[1] - D.sky[1]) * fw) * lum + 250 * core * sc;
            bl = (D.sky[2] + (D.blue[2] - D.sky[2]) * fw) * lum + 245 * core * sc;
          } else r = gr = bl = 0;
          const dd = DITH[i] * 8;
          r += dd;
          gr += dd;
          bl += dd;
          out[i] = 0xff000000 | ((bl > 255 ? 255 : bl < 0 ? 0 : bl) << 16) | ((gr > 255 ? 255 : gr < 0 ? 0 : gr) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r);
        }
        ctx.putImageData(img, 0, 0);
      },
    };
  }

  const makeWorldRenderer = () => gpuRenderer() ?? cpuRenderer();

  Object.assign(L, { worldGen, makeWorldRenderer });
})();

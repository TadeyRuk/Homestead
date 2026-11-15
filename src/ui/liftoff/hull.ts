import { clamp } from "../kit";
import { type Ctx, type RGB, Prep, fbm, make, mix, vnoise } from "./gfx";
import { ART_H, ART_W, CP, LENS_F, LH, LW, RH, type V3, bayer, camToBody, dot3, lensDir, norm3, sstep } from "./math";

/**
 * The rocket as the hull camera sees it: a booster, an upper stage, and the nozzle the upper stage
 * reveals when the booster lets go. Each is ray-traced once, per pixel at full resolution (it is
 * foreground, so it gets 1 x 1 detail), then drawn as ordinary images.
 */

export interface Piece {
  c: HTMLCanvasElement;
  x: number;
  y: number;
}
export interface HullData {
  /** booster: day and night shading, the glow of its engines, and the frost on it */
  bD: Piece;
  bN: Piece;
  bG: Piece;
  fr: Piece;
  /** upper stage */
  uD: Piece;
  uN: Piece;
  /** the upper-stage nozzle and its heat glow */
  nD: Piece;
  nN: Piece;
  nH: Piece;
  /** half-resolution masks of where a stage covers the world completely */
  maskA: Uint8Array;
  maskB: Uint8Array;
  /** the booster's right-hand edge, every third row, as x, y pairs */
  edge: number[];
  /** spots on the booster where ice flakes off */
  pts: number[];
}

/** the four slot colours, in the order they wrap round the upper stage */
const SLOTC: RGB[] = [
  [240, 140, 50],
  [90, 150, 245],
  [230, 235, 240],
  [230, 185, 70],
];

const W = ART_W;
const H = ART_H;

export const hullPrep = new Prep<HullData>(function* (self) {
  const N = W * H;
  const mk = () => new Uint8ClampedArray(N * 4);
  const L = { bD: mk(), bN: mk(), bG: mk(), uD: mk(), uN: mk(), nD: mk(), nN: mk(), nH: mk(), fr: mk() };
  type Layer = keyof typeof L;
  const LB = camToBody(norm3([0.45, 0.6, -0.66]));
  const phc = Math.atan2(CP[2], CP[0]);
  const fins = [0, 1, 2, 3].map((k): [number, number] => {
    const p = phc + Math.PI / 4 + (k * Math.PI) / 2;
    return [Math.cos(p), Math.sin(p)];
  });
  const ox = CP[0];
  const oz = CP[2];
  const C0 = ox * ox + oz * oz;
  const pts: number[] = [];
  const put = (A: Uint8ClampedArray, i: number, c: ArrayLike<number>, a = 255) => {
    A[i] = c[0];
    A[i + 1] = c[1];
    A[i + 2] = c[2];
    A[i + 3] = a;
  };

  // part: 1 booster tank, 2 fin, 3 upper stage, 4 its underside, 5 its nozzle; s is metres along the body
  function paint(part: number, s: number, phi: number, n: V3, dist: number, x: number, y: number, d: V3): [RGB, RGB] {
    const w = dist / LENS_F;
    const arc = phi * RH;
    let c: RGB;
    let f = 1;
    let spec = 0.25;
    if (part === 2) {
      c = [72, 78, 92];
      spec = 0.1;
    } else if (part === 4) {
      c = [54, 59, 70];
      spec = 0.05;
    } else if (part === 5) {
      c = [120, 98, 84];
      spec = 0.5;
    } else if (s > -3.2) {
      c = [224, 228, 235];
      const q = (s - 2) / 1.3;
      if (Math.abs(q - Math.round(q)) * 1.3 < w * 0.7) f *= 0.82;
      const qa = (phi * RH) / 0.6;
      if (Math.abs(qa - Math.round(qa)) * 0.6 < w * 0.5) f *= 0.93;
    } else if (s > -5.6) {
      c = [56, 61, 72];
      spec = 0.08;
      const m = arc / 0.32;
      if (Math.abs(m - Math.round(m)) * 0.32 < w * 0.8) c = [86, 92, 106];
    } else if (s > -26) {
      c = [224, 228, 235];
      if (s < -6.6 && s > -7.4) c = [240, 140, 50];
      else if (s < -7.7 && s > -8.3) c = SLOTC[(((Math.floor((phi + Math.PI) / (Math.PI / 2))) % 4) + 4) % 4];
      if (s < -18.5) {
        const k = clamp((-18.5 - s) / 7) * (0.45 + 0.55 * vnoise(phi * 9, s * 0.35, 2.5));
        c = mix(c, [46, 40, 38], k * 0.9);
      }
      const m = (s + 5.6) / 2.6;
      if (Math.abs(m - Math.round(m)) * 2.6 < w * 0.7) f *= 0.72;
      const q = arc / 0.5;
      if (Math.abs(q - Math.round(q)) * 0.5 < w * 0.45) f *= 0.9;
    } else {
      c = [70, 76, 88];
      spec = 0.1;
    }
    if (part === 1 || part === 3) {
      if (Math.abs(s + 3.2) < w * 0.9 || Math.abs(s + 5.6) < w * 0.9 || Math.abs(s + 26) < w * 0.9) f *= 0.55;
    }
    const l = Math.max(0, dot3(n, LB));
    const hv = norm3([LB[0] - d[0], LB[1] - d[1], LB[2] - d[2]]);
    const sp = Math.pow(Math.max(0, dot3(n, hv)), 24) * spec;
    const q = (0.4 + 0.72 * l + sp) * 7;
    const qb = Math.floor(q + bayer(x, y) - 0.5) / 7;
    const day = [c[0] * qb * f, c[1] * qb * f, c[2] * qb * f];
    const ln = (0.3 + 0.26 * l) * f;
    return [day, [c[0] * ln * 0.78, c[1] * ln * 0.86, c[2] * ln * 1.15]];
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = camToBody(lensDir(x + 0.5, y + 0.5));
      const dx = d[0];
      const dy = d[1];
      const dz = d[2];
      const A = dx * dx + dz * dz;
      const B = 2 * (ox * dx + oz * dz);
      const Cc = C0 - RH * RH;
      let tc = -1;
      if (A > 1e-12) {
        const disc = B * B - 4 * A * Cc;
        if (disc >= 0) {
          const t1 = (-B - Math.sqrt(disc)) / (2 * A);
          if (t1 > 0) tc = t1;
        }
      }
      const sc = tc > 0 ? dy * tc : 99;
      const i = (y * W + x) * 4;
      // booster: tank, interstage, engine skirt and four fins
      let bt = Infinity;
      let bpart = 0;
      let bs = 0;
      let bn: V3 = [0, 0, 0];
      let bphi = 0;
      if (tc > 0 && sc < -3.2 && sc > -28) {
        bt = tc;
        bpart = 1;
        bs = sc;
        const hx = ox + dx * tc;
        const hz = oz + dz * tc;
        bn = [hx / RH, 0, hz / RH];
        bphi = Math.atan2(hz, hx);
      }
      for (const [ux, uz] of fins) {
        const nfx = -uz;
        const nfz = ux;
        const den = nfx * dx + nfz * dz;
        if (Math.abs(den) < 1e-9) continue;
        const tf = -(nfx * ox + nfz * oz) / den;
        if (tf <= 0 || tf >= bt) continue;
        const px = ox + dx * tf;
        const pz = oz + dz * tf;
        const s = dy * tf;
        const r = px * ux + pz * uz;
        const rOut = s > -23.6 ? -1 : s > -26 ? RH + ((-23.6 - s) / 2.4) * 1.7 : RH + 1.7;
        if (s < -28.4 || r < RH || r > rOut) continue;
        bt = tf;
        bpart = 2;
        bs = s;
        bn = den < 0 ? [nfx, 0, nfz] : [-nfx, 0, -nfz];
        bphi = r;
      }
      if (bpart) {
        const [D, Nn] = paint(bpart, bs, bphi, bn, bt, x, y, d);
        let Dd = D;
        let Nd = Nn;
        if (bpart === 2 && bphi > RH + 1.5) {
          Dd = D.map((v) => v * 1.25);
          Nd = Nn.map((v) => v * 1.3);
        }
        put(L.bD, i, Dd);
        put(L.bN, i, Nd);
        const gl = Math.min(1, Math.exp((bs + 28) / 4.2)) * (bpart === 2 ? 0.8 : 1);
        put(L.bG, i, [255 * gl, 135 * gl, 55 * gl]);
        if (bpart === 1 && bs < -7 && bs > -25.5) {
          const fr = fbm(bphi * 5 + 3, bs * 0.42, 0.5, 4);
          if (fr > 0.49) {
            const l = 0.62 + 0.4 * Math.max(0, dot3(bn, LB));
            const fc = bayer(x, y) > 0.5 ? [236, 246, 255] : [196, 218, 240];
            put(L.fr, i, fc.map((v) => v * l));
            if ((x * 7 + y * 13) % 29 === 0) pts.push(x, y);
          }
        }
        if (bpart === 1 && (x * 31 + y * 17) % 97 === 0) pts.push(x, y);
      }
      // upper stage
      if (tc > 0 && sc >= -3.2 && sc < 8) {
        const hx = ox + dx * tc;
        const hz = oz + dz * tc;
        const [D, Nn] = paint(3, sc, Math.atan2(hz, hx), [hx / RH, 0, hz / RH], tc, x, y, d);
        put(L.uD, i, D);
        put(L.uN, i, Nn);
      }
      // the upper stage's vacuum nozzle and the bottom of its tank, revealed at staging
      let nt = Infinity;
      let npart = 0;
      let ns = 0;
      let nn: V3 = [0, 0, 0];
      if (dy < -1e-6) {
        const tp = -3.2 / dy;
        const px = ox + dx * tp;
        const pz = oz + dz * tp;
        if (px * px + pz * pz < RH * RH) {
          nt = tp;
          npart = 4;
          ns = -3.2;
          nn = [0, -1, 0];
        }
      }
      {
        const r0 = 0.55;
        const k = 0.72 / 3.6;
        const Q0 = r0 + k * -3.2;
        const Q1 = -k * dy;
        const qa = A - Q1 * Q1;
        const qb = B - 2 * Q0 * Q1;
        const qc = C0 - Q0 * Q0;
        const disc = qb * qb - 4 * qa * qc;
        if (disc >= 0 && Math.abs(qa) > 1e-12) {
          const sq = Math.sqrt(disc);
          for (const tt of [(-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)].sort((p, q) => p - q)) {
            if (tt <= 0 || tt >= nt) continue;
            const s = dy * tt;
            if (s > -3.2 || s < -6.8) continue;
            const px = ox + dx * tt;
            const pz = oz + dz * tt;
            const r = Math.hypot(px, pz);
            nt = tt;
            npart = 5;
            ns = s;
            nn = norm3([px / r, k, pz / r]);
            break;
          }
        }
      }
      if (npart) {
        const [D, Nn] = paint(npart, ns, 0, nn, nt, x, y, d);
        put(L.nD, i, D);
        put(L.nN, i, Nn);
        if (npart === 5) {
          const ht = 1 - sstep(-3.4, -6.8, ns) * 0.72;
          put(L.nH, i, [255 * ht, 110 * ht, 40 * ht]);
        }
      }
    }
    if ((y & 3) === 3) yield;
  }

  // a 1 px dark outline round each stage (rule 5)
  const outline = (A: Uint8ClampedArray) => {
    const add: number[] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (A[i * 4 + 3]) continue;
        if (A[(i - 1) * 4 + 3] || A[(i + 1) * 4 + 3] || A[(i - W) * 4 + 3] || A[(i + W) * 4 + 3]) add.push(i);
      }
    }
    for (const i of add) {
      A[i * 4] = 8;
      A[i * 4 + 1] = 14;
      A[i * 4 + 2] = 26;
      A[i * 4 + 3] = 255;
    }
  };
  for (const k of ["bD", "bN", "uD", "uN", "nD", "nN"] as Layer[]) {
    outline(L[k]);
    yield;
  }

  // crop each layer to its bounding box, so drawing it is cheap
  const toPiece = (A: Uint8ClampedArray<ArrayBuffer>): Piece => {
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (A[(y * W + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { c: make(1, 1)[0], x: 0, y: 0 };
    const [c, cx] = make(x1 - x0 + 1, y1 - y0 + 1);
    (cx as Ctx).putImageData(new ImageData(A, W, H), -x0, -y0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    return { c, x: x0, y: y0 };
  };
  const pieces = {} as Record<Layer, Piece>;
  for (const k of Object.keys(L) as Layer[]) {
    pieces[k] = toPiece(L[k]);
    yield;
  }

  // where a stage covers the whole world pixel, the world is not drawn there
  const mask = (keys: Layer[]) => {
    const m = new Uint8Array(LW * LH);
    for (let j = 0; j < LH; j++) {
      for (let i = 0; i < LW; i++) {
        let all = true;
        for (let q = 0; q < 4 && all; q++) {
          const x = i * 2 + (q & 1);
          const y = j * 2 + (q >> 1);
          const o = (y * W + x) * 4 + 3;
          if (!keys.some((k) => L[k][o])) all = false;
        }
        m[j * LW + i] = all ? 1 : 0;
      }
    }
    return m;
  };
  const maskA = mask(["bD", "uD"]);
  yield;
  const maskB = mask(["uD", "nD"]);
  yield;
  const edge: number[] = [];
  for (let y = 0; y < H; y += 3) {
    for (let x = W - 1; x >= 0; x--) {
      if (L.bD[(y * W + x) * 4 + 3]) {
        edge.push(x, y);
        break;
      }
    }
  }
  self.value = { ...pieces, maskA, maskB, edge, pts };
});

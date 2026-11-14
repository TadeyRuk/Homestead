export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

// mulberry32: small, fast, and identical on every browser, which is what seeded runs need
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => {
    if (!Number.isInteger(n) || n < 1) throw new Error(`int(n) needs a positive whole number, got ${n}`);
    return Math.floor(next() * n);
  };
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error("pick from empty list");
      return items[int(items.length)];
    },
  };
}

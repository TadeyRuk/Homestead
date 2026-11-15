export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => [...root.querySelectorAll<T>(sel)];

export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const play = (v: HTMLVideoElement): void => { if (!calm) v.play().catch(() => { /* autoplay refused: the poster stays */ }); };

// swap a looping clip for another one, with its poster while it loads
export const swapClip = (v: HTMLVideoElement, name: string, poster: string): void => {
  v.poster = `/assets/${poster}.jpg`;
  v.src = `/assets/${name}.mp4`;
  play(v);
};

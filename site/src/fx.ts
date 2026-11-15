// The page's motion: the starfield, scroll reveals, counters, the tilt on the monitors, the flight path
// along the right edge, and clips that only play while they are on screen.
import { $, $$, calm, play } from './dom';

export function starfield(): void {
  const c = $<HTMLCanvasElement>('#stars'), g = c.getContext('2d')!;
  type Star = { x: number; y: number; s: number; p: number; v: number; z: number };
  let stars: Star[] = [], W = 0, H = 0, shot: { x: number; y: number; t: number } | null = null;

  const size = (): void => {
    W = c.width = innerWidth; H = c.height = innerHeight;
    stars = Array.from({ length: Math.round((W * H) / 4200) }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < .12 ? 2 : 1, p: Math.random() * 6.28, v: .4 + Math.random() * 1.4, z: .08 + Math.random() * .3 }));
    draw(0);
  };
  const draw = (t: number): void => {
    g.clearRect(0, 0, W, H);
    for (const s of stars) {
      g.globalAlpha = calm ? .55 : .3 + .5 * (.5 + .5 * Math.sin(s.p + (t / 1000) * s.v));
      g.fillStyle = s.s > 1 ? '#bfe9ff' : '#fff';
      const y = (((s.y - scrollY * s.z) % H) + H) % H;   // stars drift past as the page scrolls
      g.fillRect(s.x | 0, y | 0, s.s, s.s);
    }
    if (shot) {
      const k = (t - shot.t) / 700;
      if (k > 1) shot = null;
      else { g.globalAlpha = 1 - k; g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) g.fillRect((shot.x + k * 420 - i * 5) | 0, (shot.y + k * 190 - i * 2.3) | 0, 2, 2); }
    }
    g.globalAlpha = 1;
  };
  addEventListener('resize', size); size();
  if (calm) return;
  const loop = (t: number): void => {
    if (!shot && Math.random() < .004) shot = { x: Math.random() * W * .7, y: Math.random() * H * .5, t };
    draw(t); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function reveals(): void {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
  $$('.reveal').forEach((el) => io.observe(el));
}

// numbers that count up when they come into view
export function counters(): void {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target as HTMLElement, to = Number(el.dataset.to), dec = Number(el.dataset.dec ?? 0), t0 = performance.now();
    if (calm) { el.textContent = to.toFixed(dec); return; }
    const step = (t: number): void => { const k = Math.min(1, (t - t0) / 1300), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = v.toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  $$('[data-to]').forEach((el) => io.observe(el));
}

// the monitors lean toward the pointer
export function tilt(): void {
  if (calm || !matchMedia('(hover: hover)').matches) return;
  $$('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) scale(1.015)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// looping clips play only while visible
export function clips(): void {
  const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target as HTMLVideoElement; if (e.isIntersecting) play(v); else v.pause(); }), { threshold: .25 });
  $$<HTMLVideoElement>('video.auto').forEach((v) => { if (calm) v.controls = true; io.observe(v); });
}

// the scroll bar along the top and the little ship flying from Earth to Mars down the right edge
export function flightPath(): void {
  const bar = $('#progress'), ship = $('#ship'), nav = $('nav');
  const on = (): void => {
    const k = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    bar.style.transform = `scaleX(${k})`;
    ship.style.top = `${k * 100}%`;
    nav.classList.toggle('scrolled', scrollY > 40);
  };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); on();
}

export function clock(): void {
  if (calm) return;
  const el = $('#clock'), t0 = performance.now();
  setInterval(() => { const s = (performance.now() - t0) / 1000; el.textContent = `T+ ${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; }, 100);
}

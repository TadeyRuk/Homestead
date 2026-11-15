// The four acts, driven by the scroll. The section pins to the screen and each stretch of scrolling
// brings in the next act; the arrows, dots, keyboard and a swipe scroll the page to the act they ask for.
// Only the slide on screen plays its clip.
import { $, $$, calm, play } from './dom';
import { sfx } from './sound';

export function carousel(root: HTMLElement): void {
  const pin = root.closest<HTMLElement>('.pin')!;
  const track = $('.car-track', root), slides = $$('.slide', root), dots = $$('.car-dots button', root);
  const n = slides.length;
  let at = -1, visible = false;

  const span = (): number => Math.max(1, pin.offsetHeight - innerHeight);
  const top = (): number => pin.getBoundingClientRect().top + scrollY;

  const show = (i: number): void => {
    if (i === at) return;
    root.dataset.dir = i > at ? 'fwd' : 'back';
    if (at >= 0) sfx.whoosh();
    at = i;
    track.style.transform = `translateX(${-100 * at}%)`;
    slides.forEach((s, k) => {
      const on = k === at, v = s.querySelector('video');
      s.classList.toggle('on', on);
      s.classList.toggle('past', k < at);
      s.inert = !on;
      if (v) { if (on && visible) play(v); else v.pause(); }
    });
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === at)));
    root.style.setProperty('--c', slides[at].style.getPropertyValue('--c'));
  };

  const onScroll = (): void => {
    const k = Math.min(.9999, Math.max(0, (scrollY - top()) / span())) * n;
    show(Math.floor(k));
    dots.forEach((d, i) => d.style.setProperty('--p', String(i < at ? 1 : i > at ? 0 : k - at)));   // each dot fills as its act scrolls by
  };
  // land in the middle of an act's stretch of scroll
  const go = (i: number): void => {
    const to = Math.min(n - 1, Math.max(0, i));
    scrollTo({ top: top() + ((to + .5) / n) * span(), behavior: calm ? 'auto' : 'smooth' });
  };

  $('.car-prev', root).addEventListener('click', () => go(at - 1));
  $('.car-next', root).addEventListener('click', () => go(at + 1));
  dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
  root.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(at - 1); if (e.key === 'ArrowRight') go(at + 1); });

  let x0 = 0, y0 = 0;
  root.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  root.addEventListener('pointerup', (e) => { const dx = e.clientX - x0; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - y0)) go(at + (dx < 0 ? 1 : -1)); });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    const v = slides[Math.max(0, at)].querySelector('video');
    if (v) { if (visible) play(v); else v.pause(); }
  }, { threshold: .3 }).observe(root);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
}

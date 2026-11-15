// The four flight stations. They cycle on their own until someone picks one.
import { STATIONS } from './data';
import { $, $$, calm, swapClip } from './dom';

export function stations(): void {
  const buttons = $$<HTMLButtonElement>('.stations button'), info = $('#stinfo'), video = $<HTMLVideoElement>('#stv'), box = $('#cockpit');
  let at = 0, auto = !calm, visible = false, timer = 0;

  const show = (i: number): void => {
    at = i % STATIONS.length;
    const s = STATIONS[at];
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === at)));
    box.style.setProperty('--c', s.color);
    info.innerHTML = `<h3>${s.name}</h3><p>${s.text}</p>
      <div class="keys">${s.keys.map(([k, what]) => `<span>${k.split(' ').map((c) => `<kbd>${c}</kbd>`).join('')} ${what}</span>`).join('')}</div>
      <div class="tuned">Difficulty set by your <b>${s.tunedBy}</b> part</div>`;
    info.classList.remove('pop'); void info.offsetWidth; info.classList.add('pop');
    if (visible) swapClip(video, 'c-' + s.id, s.id);
  };
  const tick = (): void => { clearInterval(timer); if (auto && visible) timer = window.setInterval(() => show(at + 1), 5000); };

  buttons.forEach((b, k) => b.addEventListener('click', () => { auto = false; clearInterval(timer); show(k); }));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; tick(); }, { threshold: .3 }).observe(box);
  show(0);
}

// The opening splash: the launch film counts down and lifts off, the title slams in, then the splash
// lifts away like a rocket leaving the pad and the hero takes over on the ascent.
import { $, calm, play } from './dom';
import { sfx } from './sound';

const LIFTOFF_S = 2.5;   // where the rocket leaves the pad in splash.mp4
const TITLE_S = 3.4;
const END_S = 5.1;

export function splash(onDone: () => void): void {
  const root = $('#splash'), film = $<HTMLVideoElement>('video', root), count = $('#count');
  let done = false, stage = 0, shown = '';

  const finish = (): void => {
    if (done) return;
    done = true;
    root.classList.add('out'); sfx.whoosh();
    document.documentElement.classList.remove('locked');
    onDone();
    setTimeout(() => root.remove(), 900);
  };
  const title = (): void => { if (stage < 2) { stage = 2; root.classList.add('title'); sfx.slam(); } };

  if (calm) { root.remove(); document.documentElement.classList.remove('locked'); onDone(); return; }

  film.addEventListener('timeupdate', () => {
    const t = film.currentTime, left = Math.ceil(LIFTOFF_S - t);
    count.textContent = t < LIFTOFF_S ? `T-${left}` : 'LIFTOFF';
    if (t >= LIFTOFF_S && stage < 1) { stage = 1; root.classList.add('liftoff'); sfx.rumble(); }
    else if (t < LIFTOFF_S && count.textContent !== shown) sfx.beep();
    shown = count.textContent ?? '';
    if (t >= TITLE_S) title();
    if (t >= END_S) finish();
  });
  film.addEventListener('ended', finish);
  film.play().catch(() => { title(); setTimeout(finish, 1600); });   // autoplay refused: show the title, then go

  $('#skip').addEventListener('click', finish);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); }, { once: true });
  setTimeout(finish, 8000);   // never hold the page hostage to a slow video
  play(film);
}

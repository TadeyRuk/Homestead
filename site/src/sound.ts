// Sound effects, synthesised in the browser so there is nothing to download. Sound starts on its own where
// the browser allows it, and otherwise on the visitor's first click, tap or key press.
let ctx: AudioContext | null = null, out: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch { /* storage blocked: start with sound on */ }

const ready = (): boolean => !muted && !!ctx && ctx.state === 'running';

export function unlock(): void {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain(); out.gain.value = muted ? 0 : .5; out.connect(ctx.destination);
    ctx.addEventListener('statechange', startMusic);
    loadMusic();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  startMusic();
}

// The game's own title music: an intro that plays once, then a part that loops. Ogg first, AAC for browsers
// that cannot decode Ogg.
let intro: AudioBuffer | null = null, loop: AudioBuffer | null = null, playing = false;
const clip = (name: string): Promise<AudioBuffer> => {
  const get = (ext: string): Promise<AudioBuffer> => fetch(`/assets/${name}.${ext}`).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b));
  return get('ogg').catch(() => get('m4a'));
};
function loadMusic(): void {
  Promise.all([clip('music-earth-1'), clip('music-earth-2')]).then(([a, b]) => { intro = a; loop = b; startMusic(); }).catch(() => { /* no music: the effects still play */ });
}
function startMusic(): void {
  if (playing || !ctx || !out || ctx.state !== 'running' || !intro || !loop) return;
  playing = true;
  const g = ctx.createGain(), t = ctx.currentTime + .05;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .6);
  g.connect(out);
  const a = ctx.createBufferSource(), b = ctx.createBufferSource();
  a.buffer = intro; b.buffer = loop; b.loop = true;
  a.connect(g); b.connect(g);
  a.start(t); b.start(t + intro.duration);
}

export const isMuted = (): boolean => muted;
export function setMuted(m: boolean): void {
  muted = m;
  if (out && ctx) out.gain.setTargetAtTime(m ? 0 : .5, ctx.currentTime, .05);
  try { localStorage.setItem('muted', m ? '1' : '0'); } catch { /* not saved */ }
}

function tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, delay = 0): void {
  if (!ready()) return;
  const t = ctx!.currentTime + delay, o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(out!); o.start(t); o.stop(t + dur + .02);
}

function noise(dur: number, vol: number, f0: number, f1: number, q = 1): void {
  if (!ready()) return;
  const c = ctx!, t = c.currentTime, buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(out!); src.start(t);
}

export const sfx = {
  tick: (): void => tone('square', 1500, 1100, .035, .05),
  click: (): void => { tone('square', 520, 880, .07, .14); tone('square', 880, 1320, .08, .1, .06); },
  pick: (): void => tone('triangle', 420, 760, .09, .22),
  good: (): void => { tone('square', 660, 660, .08, .12); tone('square', 990, 990, .14, .12, .08); },
  bad: (): void => { tone('sawtooth', 190, 110, .22, .16); },
  whoosh: (): void => { noise(.55, .3, 300, 4200, .8); tone('sine', 140, 420, .4, .12); },
  slam: (): void => { tone('sine', 150, 34, .7, .7); noise(.35, .4, 2400, 200, .6); },
  rumble: (): void => { noise(2.6, .5, 90, 520, .5); tone('sawtooth', 44, 70, 2.6, .16); },
  beep: (): void => tone('square', 880, 880, .09, .12),
};

// Wire the page: unlock on the first gesture, a tick on hover, a click on press, and the mute button.
export function sounds(toggle: HTMLButtonElement): void {
  const paint = (): void => { toggle.textContent = muted ? 'Sound off' : 'Sound on'; toggle.setAttribute('aria-pressed', String(!muted)); };
  paint();
  toggle.addEventListener('click', () => { setMuted(!muted); paint(); unlock(); sfx.click(); });

  // Try to start straight away. A browser that allows autoplay for this visitor plays the splash with sound;
  // one that does not stays quiet until the first click, tap or key press, which the listeners below catch.
  unlock();
  addEventListener('touchend', unlock, true);

  const hot = 'a, button';
  addEventListener('pointerdown', (e) => { unlock(); if ((e.target as HTMLElement).closest(hot)) sfx.click(); }, true);
  addEventListener('keydown', unlock, true);
  let last: Element | null = null;
  addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest(hot);
    if (el && el !== last) sfx.tick();
    last = el;
  });
}

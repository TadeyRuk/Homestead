/**
 * Small square-wave sounds made in the browser, so there are no audio files to load.
 * Audio starts after the first key or click (browsers require it); M mutes.
 */
let ac: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem("homestead-muted") === "1";
} catch {
  // storage can be blocked; sound simply starts unmuted
}

function unlock(): void {
  if (ac) {
    if (ac.state === "suspended") void ac.resume();
    return;
  }
  try {
    ac = new AudioContext();
  } catch {
    ac = null;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem("homestead-muted", muted ? "1" : "0");
  } catch {
    // not saved; the toggle still works for this tab
  }
  return muted;
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("pointerdown", unlock, { passive: true });
}

function tone(f: number, d = 0.07, type: OscillatorType = "square", v = 0.035, f2 = 0, delay = 0): void {
  if (muted || !ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}

function hiss(d: number, v = 0.05, lowpass = 1200): void {
  if (muted || !ac) return;
  const n = Math.floor(ac.sampleRate * d);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  f.type = "lowpass";
  f.frequency.value = lowpass;
  g.gain.value = v;
  s.buffer = buf;
  s.connect(f).connect(g).connect(ac.destination);
  s.start();
}

export const sfx = {
  blip: () => tone(660, 0.05),
  type: () => tone(900 + Math.random() * 200, 0.012, "square", 0.008),
  warn: () => {
    tone(880, 0.09, "square", 0.03);
    tone(880, 0.09, "square", 0.03, 0, 0.16);
  },
  hit: () => {
    hiss(0.35, 0.09, 500);
    tone(90, 0.3, "sawtooth", 0.06, 40);
  },
  thrust: () => hiss(0.08, 0.02, 600),
  stamp: () => {
    hiss(0.15, 0.08, 900);
    tone(120, 0.15, "square", 0.05, 60);
  },
  tick: () => tone(1200, 0.03, "square", 0.02),
  jingle: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", 0.035, 0, i * 0.11)),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.05, 0, i * 0.2)),
};

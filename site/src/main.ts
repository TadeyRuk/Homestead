import './style.css';
import { carousel } from './carousel';
import { GAME_URL } from './data';
import { $, $$, play } from './dom';
import { clips, clock, counters, flightPath, reveals, starfield, tilt } from './fx';
import { lab } from './lab';
import { sounds } from './sound';
import { splash } from './splash';
import { stations } from './stations';

// every "play" button goes to the game
$$<HTMLAnchorElement>('a[data-play]').forEach((a) => { a.href = GAME_URL; a.target = '_blank'; a.rel = 'noopener'; });

sounds($<HTMLButtonElement>('#snd'));
starfield();
flightPath();
carousel($('#run'));
stations();
lab();
tilt();
counters();

splash(() => {
  // the splash has lifted off: the hero picks the film up on the ascent and its words land one by one
  document.body.classList.add('ready');
  const film = $<HTMLVideoElement>('.hero video');
  film.currentTime = 0; play(film);
  clock(); reveals(); clips();
});

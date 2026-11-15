// Homestead mission report: find the biggest loss, walk it back to a build choice, name the real mission.
// Shown as a journey (five pixel-art stages), the rocket with the deciding part circled, and a score of icons and bars.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, C, CAT, PIX, clamp, seg, typed } = HS;
  let Rp = null;

  // Reads the run in HS.S and returns everything the report screen shows.
  HS.analyze = () => {
    const S = HS.S, m = HS.model(), mi = S.mission, e = S.ended, u = Math.floor(S.uplinked + 1e-6), target = mi.target;
    const landed = !e || e.phase === 'surface';
    const sal = S.salvaged.map(s => HS.PARTS[HS.SALVAGE[s]].name);
    const salLine = (slot) => S.emptyAtTimeout.includes(slot) ? `The ${HS.SLOT_NAME[slot].toLowerCase()} slot was still empty at launch${S.credits >= HS.KIOSK_COST ? `, with ${S.credits} credits unspent` : ''}, so it got a ${HS.PARTS[HS.SALVAGE[slot]].name.toLowerCase()}.` : null;
    let head, chain = [], real, realTag = 'What real missions do';
    const heavyPct = Math.round(m.massFrac * 100);

    if (e && e.reason === 'overweight') {
      const others = ['power', 'comms', 'payload'].map(k => m[k]).sort((a, b) => b.mass - a.mass)[0];
      head = 'The rocket never reached orbit.';
      chain = [`The build weighed ${m.mass} kg, and the ${m.prop.name.toLowerCase()} lifts ${m.lift} kg.`, `The heaviest part after the engine was the ${others.name.toLowerCase()} at ${others.mass} kg.`, salLine('prop') || 'The pad showed the mass meter in red before launch. Launch is never blocked.'];
      real = 'The launch vehicle sets a hard limit on mass. Real teams keep a mass budget with margin from the first day, and when one part grows, another has to shrink.';
    } else if (e && e.reason === 'hull') {
      head = `The hull failed ${Math.round(clamp(S.log.find(l => l.type === 'lost').prog, 0, 1) * 100)}% of the way to ${mi.short}.`;
      chain = [`The ship took ${S.hits} debris hit${S.hits === 1 ? '' : 's'}.`];
      if (S.hitsNoWarn * 2 >= S.hits) { chain.push(`${S.hitsNoWarn} of them came with no warning, because the link to Earth was down.`); chain.push(salLine('comms') || `The ${m.comms.name.toLowerCase()} was mounted in the comms slot: ${m.comms.flight.toLowerCase()}.`); real = m.comms.fact; }
      else if (m.heavy > .3) { chain.push(`Steering was sluggish: the build was at ${heavyPct}% of what the ${m.prop.name.toLowerCase()} can lift.`); real = m.prop.fact; }
      else if (m.power.target) { chain.push(`The ${m.power.name.toLowerCase()} makes the ship a bigger target for debris.`); real = m.power.fact; }
      else { chain.push(`The warnings came, but the ship was not moved out of the way in time. ${m.prop.name}: ${m.prop.flight}.`); real = m.prop.fact; }
    } else if (e && e.reason === 'fuel') {
      head = 'The tanks ran dry before arrival.';
      chain = [`The ${m.prop.name.toLowerCase()} was in the propulsion slot. ${m.prop.flight}.`, m.heavy > 0 ? `The build was at ${heavyPct}% of the engine's lift, so every burn cost more fuel.` : 'Speed changes and steering each cost fuel, and there were too many of them.'];
      if (salLine('prop')) chain.push(salLine('prop'));
      real = m.prop.fact;
    } else if (e && e.reason === 'oxygen') {
      head = 'The cabin ran out of oxygen before arrival.';
      const breachT = S.log.filter(l => l.type === 'weld').reduce((a, l) => a + l.t, 0);
      chain = [S.hits ? `${S.hits} debris hit${S.hits === 1 ? '' : 's'} opened the hull, and the cabin leaked air until each breach was welded.` : 'The oxygen converter was not fed often enough.', S.trips ? `The breaker tripped ${S.trips} time${S.trips === 1 ? '' : 's'}, and life support was off each time.` : `The flight took ${Math.round(S.flightTime)} s. A slower ship needs more air.`];
      if (breachT > 20) chain.push(`Breaches stayed open for ${Math.round(breachT)} s in total.`);
      real = 'On the International Space Station, oxygen is made by splitting water, and the crew tracks every consumable. Air is part of the mission design, not an afterthought.';
    } else {
      // the crew landed: compare the ways data was lost
      const rc = m.power.recharge * (m.power.solar && mi.id === 'mars' ? .43 : 1);
      const losses = [
        { k: 'down', v: S.lostDown + (e ? 5 : 0) }, { k: 'hands', v: S.carried }, { k: 'buffer', v: Math.round(S.buffer) }, { k: 'yield', v: S.yieldLost }
      ].sort((a, b) => b.v - a.v);
      const top = u >= target && !e ? { k: 'ok' } : losses[0].v > 0 ? losses[0] : { k: 'short' };
      head = u > target ? `You uplinked ${u} data units. Mission Control asked for ${target}.` : `You uplinked ${u} of the ${target} data units Mission Control asked for.`;
      if (top.k === 'ok') {
        chain = [`The ${m.payload.name.toLowerCase()} gave ${m.payload.rich} data units for each rich site.`, `The ${m.comms.name.toLowerCase()} sent it home at ${m.comms.rate.toFixed(2)} units per second.`, S.instDamage > 1 ? `The instrument still arrived at ${Math.round(100 - S.instDamage)}% accuracy after a hot core in flight.` : 'The instrument arrived intact, because the core stayed in its safe band.'];
        real = m.payload.fact;
      } else if (top.k === 'down') {
        const hz = e && e.hazard ? `in the ${mi.hazardName.toLowerCase()}` : 'far from the lander';
        chain = [`Your suit ran out ${hz}${S.lostDown ? `, and ${S.lostDown} carried data units were lost` : ''}.`, `The ${m.power.name.toLowerCase()} recharges a suit at ${rc.toFixed(1)}% per second${m.power.solar && mi.id === 'mars' ? ', because sunlight at Mars is 43% of Earth\'s' : ''}.`, S.hazardTime > 4 ? `You spent ${Math.round(S.hazardTime)} s inside the hazard, where suits drain ${mi.id === 'mars' ? 'four' : 'six'} times faster.` : 'The suit was not topped up at the lander before the long walk.'];
        real = mi.hazardFact;
      } else if (top.k === 'buffer') {
        chain = [`${Math.round(S.buffer)} units were still waiting in the lander when the extraction ship arrived.`, `Uploads were slow: the ${m.comms.name.toLowerCase()} sends ${m.comms.rate.toFixed(2)} units per second.`, salLine('comms') || `The ${m.payload.name.toLowerCase()} collected data faster than the link could send it.`];
        real = m.comms.fact;
      } else if (top.k === 'hands') {
        chain = [`${S.carried} units were still in your hands when the extraction ship arrived.`, 'Data only counts once it reaches the lander.', S.hazardTime > 6 ? `The ${mi.hazardName.toLowerCase()} cost you ${Math.round(S.hazardTime)} s of slow walking and suit drain.` : `The ${m.payload.name.toLowerCase()} takes ${m.payload.scan} s per scan, which left no time for the walk back.`];
        real = 'Mars rovers send most of their data through orbiters that pass overhead. Whatever is not ready for the pass waits for the next one, so the day is planned around the link.';
      } else if (top.k === 'yield') {
        chain = [`The instrument arrived at ${Math.round(100 - S.instDamage)}% accuracy, which cost ${S.yieldLost} data units on the surface.`, `The core ran too hot for ${Math.round(S.hotTime)} s in flight. ${m.payload.name}: ${m.payload.flight.toLowerCase()}.`, m.power.heat ? `The ${m.power.name.toLowerCase()} adds its own heat to the core.` : 'The coolant valve was left too far closed.'];
        real = m.payload.fact;
      } else {
        const need = mi.objectives.scans;
        chain = [`You scanned ${S.scansRich} rich site${S.scansRich === 1 ? '' : 's'} and ${S.scansPoor} poor one${S.scansPoor === 1 ? '' : 's'}.`, `The ${m.payload.name.toLowerCase()} gives ${m.payload.rich} data units for a rich site, so ${target} units takes at least ${Math.ceil(target / m.payload.rich)} rich scans.`, salLine('payload') || (S.scansRich < need ? 'The rich sites are far from the lander, and the clock ran out.' : 'More scans were needed than the time allowed.')];
        real = m.payload.fact;
      }
    }
    chain = chain.filter(Boolean);

    // score: data first, then crew, credits, build time, fuel and hull
    const rows = [];
    const dataPts = landed ? Math.round(Math.min(1, u / target) * 500) : 0;
    rows.push(['Data uplinked', `${u} / ${target}`, dataPts]);
    rows.push(['Crew standing', landed ? `${S.crewStanding} / 1` : '0 / 1', landed && S.crewStanding ? 160 : 0]);
    rows.push(['Credits unspent', String(S.credits), S.credits * 2]);
    rows.push(['Build time left', HS.fmt(S.buildLeft), Math.min(180, Math.round(S.buildLeft * 180 / HS.BUILD_TIME))]);
    rows.push(['Fuel and hull', `${Math.round(S.fuel)}% / ${Math.round(S.hull)}%`, landed ? Math.round((S.fuel + S.hull) / 5) : 0]);
    const objN = (S.scansRich >= mi.objectives.scans ? 1 : 0) + (S.sampleDone ? 1 : 0) + (S.deployDone ? 1 : 0);
    rows.push(['Objectives', `${objN} / 3${S.bonusDone ? ' + bonus' : ''}`, landed ? objN * 20 + (S.bonusDone ? 30 : 0) : 0]);
    const score = rows.reduce((a, r) => a + r[2], 0);
    const full = landed && !e && u >= target && objN === 3;
    const outcome = full ? 'SUCCESS' : landed && u > 0 ? 'PARTIAL SUCCESS' : 'MISSION FAILED';
    // the part that decided it: the one whose fact the analysis cites (every part has its own fact)
    const factSlot = HS.SLOTS.find(sl => m[sl] && m[sl].fact === real);
    const culprit = factSlot || (e && e.reason === 'overweight' ? 'prop' : real === mi.hazardFact ? 'power' : e && e.reason === 'oxygen' ? null : 'payload');
    return { head, chain, real, realTag, rows, score, outcome, sal, culprit, full, landed, u, target, objN, m, col: full ? C.green : outcome === 'PARTIAL SUCCESS' ? C.amber : C.red };
  };

  // ---------- pixel art for the report, on the 1280 x 720 grid (1 x 1 detail, 1 px outline, light from the top left)
  // five stage icons, 48 x 48: the run as a journey; and a 16 x 16 icon for each score row
  const L = HS.liftoff, R = L.R, OUT = HS.ART_OUT;
  const disc = (x, cx, cy, r, col, ry = r) => { for (let y = -ry; y <= ry; y++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };
  const nose = (x, cx, y0, y1, w, a, b) => { for (let y = y0; y < y1; y++) { const hw = Math.max(1, Math.round((y - y0 + 1) / (y1 - y0) * w / 2)); R(x, cx - hw, y, hw * 2, 1, a); R(x, cx, y, hw, 1, b); } };
  const ARTS = {};
  function art(dest) {
    if (ARTS[dest]) return ARTS[dest];
    const sp = (w, h, fn) => L.sprite(w, h, fn, OUT), mars = dest === 'mars';
    const A = {
      build: sp(48, 48, (x) => {
        R(x, 0, 40, 48, 8, '#2c5c49'); R(x, 0, 40, 48, 2, '#3e7660');
        R(x, 4, 6, 2, 34, '#566078'); R(x, 13, 6, 2, 34, '#566078'); R(x, 4, 6, 1, 34, '#8a96b0');
        for (let y = 8; y < 40; y += 6) { R(x, 4, y, 11, 1, '#7a86a0'); for (let k = 0; k < 6; k++) R(x, 5 + Math.round(k * 1.6), y + k, 1, 1, '#566078'); }
        R(x, 7, 2, 4, 4, '#ff5a50'); R(x, 15, 16, 7, 2, '#7a86a0');
        nose(x, 27, 2, 12, 10, '#e8ecf2', '#aab2c0');
        R(x, 22, 12, 10, 28, '#e8ecf2'); R(x, 29, 12, 3, 28, '#aab2c0'); R(x, 22, 12, 1, 28, '#ffffff');
        R(x, 22, 28, 10, 3, '#f08c32'); R(x, 24, 16, 3, 3, '#2f5fc8'); R(x, 24, 16, 1, 1, '#a8c8ff');
        R(x, 19, 34, 3, 6, '#c84a2a'); R(x, 32, 34, 3, 6, '#8a2e18');
        for (let k = 0; k < 9; k++) R(x, 35 + k, 46 - k, 2, 2, '#c8ccd4');
        R(x, 42, 33, 6, 6, '#c8ccd4'); R(x, 42, 33, 6, 1, '#ffffff'); x.clearRect(44, 33, 2, 3);
      }),
      launch: sp(48, 48, (x) => {
        disc(x, 10, 42, 7, '#9aa2b2', 5); disc(x, 38, 42, 7, '#9aa2b2', 5); disc(x, 24, 44, 9, '#c8ccd4', 4); disc(x, 9, 40, 4, '#e8ecf2', 3); disc(x, 37, 40, 4, '#e8ecf2', 3);
        for (let y = 30; y < 42; y++) { const hw = Math.max(1, Math.round(4 - (y - 30) * .3)); R(x, 24 - hw, y, hw * 2, 1, y < 33 ? '#fff6d8' : y < 37 ? '#ffd27a' : '#ff9a3c'); }
        nose(x, 24, 0, 8, 10, '#e8ecf2', '#aab2c0');
        R(x, 19, 8, 10, 22, '#e8ecf2'); R(x, 26, 8, 3, 22, '#aab2c0'); R(x, 19, 8, 1, 22, '#ffffff'); R(x, 19, 20, 10, 2, '#f08c32'); R(x, 21, 11, 3, 3, '#2f5fc8');
        R(x, 16, 24, 3, 6, '#c84a2a'); R(x, 29, 24, 3, 6, '#8a2e18');
      }),
      flight: sp(48, 48, (x) => {
        for (const [X, Y] of [[3, 4], [14, 9], [44, 30], [30, 42], [20, 3], [42, 22], [8, 26]]) R(x, X, Y, 1, 1, '#ffffff');
        disc(x, 39, 9, 7, mars ? '#c45c38' : '#b4b8c4'); disc(x, 37, 7, 3, mars ? '#e8845a' : '#d8dce4'); R(x, 41, 11, 3, 2, mars ? '#9a4428' : '#8a8e9a');
        disc(x, 4, 45, 10, '#1f5ab0'); R(x, 0, 38, 6, 3, '#46885a'); R(x, 6, 41, 4, 2, '#46885a');
        for (let X = 4; X < 12; X++) { const hw = Math.round((12 - X) * .35) + 1; R(x, X, 24 - hw, 1, hw * 2, X < 8 ? '#ff9a3c' : '#ffd27a'); }
        R(x, 12, 20, 20, 8, '#e8ecf2'); R(x, 12, 26, 20, 2, '#aab2c0'); R(x, 12, 20, 20, 1, '#ffffff');
        for (let X = 32; X < 39; X++) { const hh = Math.max(1, Math.round((39 - X) * .55)); R(x, X, 24 - hh, 1, hh * 2, X > 35 ? '#aab2c0' : '#e8ecf2'); }
        R(x, 26, 21, 3, 3, '#2f5fc8'); R(x, 20, 20, 2, 8, '#f08c32'); R(x, 12, 16, 4, 4, '#c84a2a'); R(x, 12, 28, 4, 4, '#8a2e18');
        R(x, 18, 17, 6, 3, '#1d2a5a'); R(x, 18, 28, 6, 3, '#1d2a5a');
      }),
      surface: sp(48, 48, (x) => {
        const g0 = mars ? '#9a4a30' : '#7a7e8a', g1 = mars ? '#c46a44' : '#a0a4ae', g2 = mars ? '#6e341f' : '#565a66';
        R(x, 0, 36, 48, 12, g0); R(x, 0, 36, 48, 2, g1); disc(x, 6, 42, 3, g2, 2); disc(x, 40, 44, 2, g2, 1); disc(x, 30, 45, 3, g1, 1);
        R(x, 13, 29, 2, 7, '#9aa2b2'); R(x, 33, 29, 2, 7, '#9aa2b2'); R(x, 11, 35, 6, 2, '#c8ccd4'); R(x, 31, 35, 6, 2, '#c8ccd4');
        R(x, 4, 21, 11, 5, '#2846a0'); R(x, 33, 21, 11, 5, '#2846a0'); R(x, 4, 21, 11, 1, '#5a7ac8'); R(x, 33, 21, 11, 1, '#5a7ac8');
        R(x, 15, 17, 18, 13, '#d8a040'); R(x, 15, 17, 18, 2, '#ffe0a0'); R(x, 28, 17, 5, 13, '#8a5f1c'); R(x, 19, 22, 4, 4, '#3a2a14');
        R(x, 23, 10, 2, 7, '#9aa2b2'); R(x, 19, 8, 10, 3, '#e8ecf2'); R(x, 23, 7, 2, 1, '#ff5a50');
        R(x, 42, 24, 1, 12, '#c8ccd4'); R(x, 43, 24, 5, 4, '#78ffdc');
      }),
      home: sp(48, 48, (x) => {
        x.drawImage(L.earthSphere(14), 0, 18);
        for (let y = 2; y < 13; y++) { const hw = Math.round(11 * Math.sqrt(Math.max(0, 1 - ((12 - y) / 11) ** 2))); for (let X = -hw; X < hw; X++) R(x, 36 + X, y, 1, 1, ((X + 20) >> 2) % 2 ? '#f08c32' : '#ffffff'); }
        for (const X of [26, 31, 41, 46]) for (let k = 0; k < 14; k++) R(x, Math.round(X + (36 - X) * k / 14), 12 + k, 1, 1, '#9aa2b2');
        R(x, 32, 26, 8, 5, '#c8ccd4'); R(x, 33, 25, 6, 1, '#e8ecf2'); R(x, 31, 31, 10, 3, '#5a3a24'); R(x, 34, 27, 2, 2, '#2f5fc8');
      }),
      // score rows
      data: sp(16, 16, (x) => { R(x, 3, 1, 10, 14, '#2a3040'); R(x, 4, 2, 8, 6, '#78ffdc'); R(x, 4, 2, 8, 1, '#c8fff0'); for (const X of [4, 7, 10]) R(x, X, 12, 2, 3, '#e6b946'); }),
      crew: sp(16, 16, (x) => { disc(x, 8, 7, 7, '#e8ecf2', 6); R(x, 3, 4, 10, 6, '#8a5f1c'); R(x, 3, 4, 10, 1, '#d8a040'); R(x, 4, 5, 2, 2, '#ffe0a0'); R(x, 2, 14, 12, 2, '#f08c32'); }),
      credits: sp(16, 16, (x) => { for (let k = 0; k < 3; k++) { R(x, 2, 12 - k * 3, 12, 3, '#a8287a'); R(x, 2, 12 - k * 3, 12, 1, '#d640a4'); } disc(x, 8, 4, 6, '#ff96e1', 3); R(x, 4, 2, 4, 1, '#ffffff'); R(x, 7, 3, 2, 2, '#d640a4'); }),
      time: sp(16, 16, (x) => { R(x, 6, 0, 4, 2, '#ffb43c'); disc(x, 8, 9, 6, '#ffb43c'); disc(x, 8, 9, 4, '#fff0c8'); R(x, 8, 5, 1, 5, '#2a3040'); R(x, 8, 9, 3, 1, '#2a3040'); }),
      hull: sp(16, 16, (x) => { for (let y = 0; y < 15; y++) { const hw = y < 8 ? 7 : 7 - Math.round((y - 8) * 1); if (hw > 0) R(x, 8 - hw, y, hw * 2, 1, '#5a96f5'); } R(x, 1, 5, 14, 3, '#f08c32'); R(x, 2, 1, 5, 1, '#a8c8ff'); R(x, 8, 0, 7, 15, 'rgba(10,15,28,.25)'); }),
      objectives: sp(16, 16, (x) => { R(x, 2, 2, 12, 14, '#c8a46e'); R(x, 4, 4, 8, 10, '#f2f4f8'); R(x, 6, 1, 4, 3, '#6a7282'); for (const [X, Y] of [[5, 9], [6, 10], [7, 11], [8, 10], [9, 9], [10, 8], [11, 7]]) R(x, X, Y, 1, 1, '#2a9a4a'); }),
      fact: sp(24, 24, (x) => { R(x, 2, 9, 7, 6, '#1d2a5a'); R(x, 15, 9, 7, 6, '#1d2a5a'); R(x, 2, 9, 7, 1, '#8ab4e8'); R(x, 15, 9, 7, 1, '#8ab4e8'); R(x, 9, 11, 6, 2, '#9aa2b2'); R(x, 9, 7, 6, 10, '#d8a040'); R(x, 9, 7, 6, 2, '#ffe0a0'); R(x, 13, 7, 2, 10, '#8a5f1c'); R(x, 11, 2, 2, 5, '#c8ccd4'); disc(x, 12, 2, 3, '#e8ecf2', 1); })
    };
    // status badges: made it, trouble, ended here
    const badge = (col, fn) => sp(14, 14, (x) => { disc(x, 7, 7, 7, col); fn(x); });
    A.ok = badge('#2a9a4a', (x) => { for (const [X, Y] of [[3, 7], [4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]]) R(x, X, Y, 2, 2, '#ffffff'); });
    A.warn = badge('#e8a020', (x) => { R(x, 6, 2, 3, 7, '#2a1a00'); R(x, 6, 10, 3, 3, '#2a1a00'); });
    A.fail = badge('#dc3c3c', (x) => { for (let k = 0; k < 8; k++) { R(x, 3 + k, 3 + k, 2, 2, '#ffffff'); R(x, 10 - k, 3 + k, 2, 2, '#ffffff'); } });
    return (ARTS[dest] = A);
  }
  const STATUS = { ok: C.green, warn: C.amber, fail: C.red, skip: '#3a4a62' };
  // the five stages and how far the run got
  function stages(a) {
    const S = HS.S, e = S.ended, m = a.m, reason = e && e.reason;
    const failAt = reason === 'overweight' ? 1 : reason === 'hull' || reason === 'fuel' || reason === 'oxygen' ? 2 : -1;
    const nSal = S.salvaged.length;
    return [
      { k: 'build', name: 'BUILD', v: nSal ? `${4 - nSal} parts + ${nSal} salvage` : `4 parts, ${HS.fmt(S.buildLeft)} spare`, st: nSal ? 'warn' : 'ok' },
      { k: 'launch', name: 'LAUNCH', v: m.lift ? `${m.mass} of ${m.lift} kg` : `${m.mass} kg`, st: failAt === 1 ? 'fail' : 'ok' },
      { k: 'flight', name: 'FLIGHT', v: failAt === 2 ? `${reason === 'oxygen' ? 'air' : reason} gave out` : failAt === 1 ? 'never flew' : `hull ${Math.round(S.hull)}%  fuel ${Math.round(S.fuel)}%`, st: failAt === 2 ? 'fail' : failAt === 1 ? 'skip' : S.hull < 50 || S.fuel < 25 ? 'warn' : 'ok' },
      { k: 'surface', name: S.mission.short.toUpperCase(), v: a.landed ? `${a.u} of ${a.target} data` : 'not reached', st: !a.landed ? 'skip' : a.u >= a.target && a.objN === 3 ? 'ok' : a.u > 0 ? 'warn' : 'fail' },
      { k: 'home', name: 'HOME', v: !a.landed ? 'not reached' : S.crewStanding ? 'crew home safe' : 'carried home', st: !a.landed ? 'skip' : S.crewStanding ? 'ok' : 'warn' }
    ];
  }

  HS.scenes.report = {
    enter() {
      Rp = { t: 0, a: HS.analyze(), best: HS.best(), n: 0 };
      Rp.newBest = Rp.a.score > Rp.best; HS.saveBest(Rp.a.score);
      Rp.a.outcome === 'MISSION FAILED' ? HS.sfx.sad() : HS.sfx.jingle();
      Rp.st = stages(Rp.a);
      Rp.reach = Math.max(0, ...Rp.st.map((s, i) => (s.st === 'skip' ? -1 : i)));
      // lay the words out once: the headline, the chain of causes, the real mission
      Rp.head = HS.wrap(Rp.a.head, 196, 8.5, { w: 700 });
      Rp.chain = Rp.a.chain.map((c) => HS.wrap(c, 190, 6.5));
      Rp.real = HS.wrap(Rp.a.real, 252, 6.5).slice(0, 5);
      Rp.textEnd = 138 + Rp.head.length * 11 + 3 + Rp.chain.reduce((h, ls) => h + ls.length * 8.5 + 3, 0) - 8;
      Rp.whyAt = 1.7; Rp.realAt = Rp.whyAt + .4 + Rp.chain.length * .3;
      Rp.rowsAt = Rp.realAt + .4; Rp.scoreAt = Rp.rowsAt + Rp.a.rows.length * .18 + .3; Rp.endAt = Rp.scoreAt + 1.2;
      Rp.lit = -1; Rp.rowsShown = 0;
      const lost = HS.S.log.find((l) => l.type === 'lost'); Rp.lost = lost ? clamp(lost.prog, 0, 1) : null;
    },
    update(dt) {
      const before = Rp.t; Rp.t += dt;
      // a tick as each stage lights and each score row lands
      const lit = Math.floor(clamp((Rp.t - .2) / 1.4, 0, 1) * Rp.reach + 1e-6);
      if (lit > Rp.lit) { Rp.lit = lit; HS.sfx.tick(); }
      const rowsShown = Math.max(0, Math.min(Rp.a.rows.length, Math.floor((Rp.t - Rp.rowsAt) / .18) + 1));
      if (Rp.t > Rp.rowsAt && rowsShown > Rp.rowsShown) { Rp.rowsShown = rowsShown; HS.sfx.type(); }
      if (Rp.t > Rp.scoreAt && before <= Rp.scoreAt) HS.sfx.ok();
      const skip = HS.hit('Enter', 'Space', 'KeyE') || HS.In.click;
      if (Rp.t < Rp.endAt) { if (skip) { Rp.t = Rp.endAt; Rp.lit = Rp.reach; Rp.rowsShown = Rp.a.rows.length; HS.In.click = false; HS.In.hit.clear(); } return; }
      const S = HS.S;
      if (HS.hit('KeyR') || Rp.btn === 'retry') { HS.newRun(S.mission.id, S.seed); HS.sfx.ok(); HS.go('brief'); }
      else if (HS.hit('Enter', 'KeyN') || Rp.btn === 'new') { HS.newRun(S.mission.id, 10000 + Math.floor(Math.random() * 89999)); HS.sfx.ok(); HS.go('brief'); }
      else if (HS.hit('KeyT', 'Escape') || Rp.btn === 'title') { HS.sfx.blip(); HS.go('title'); }
      Rp.btn = null;
    },
    draw() {
      const t = Rp.t, a = Rp.a, S = HS.S, mi = S.mission, A = art(mi.id);
      const img = (s, x, y) => { g.imageSmoothingEnabled = false; g.drawImage(s, x, y, s.width / 2, s.height / 2); };
      // how the run ended, behind the panel: the lander on the surface, the burnt pad, or the planet never reached
      HS.cutArt.report(t); HS.bleedArt(); HS.blitArt();
      box(20, 20, 600, 322, C.cyan, 6);
      const hd = `MISSION REPORT  /  ${mi.name}  /  `;
      T(hd, 34, 36, 8.5, C.cyan, { w: 600 }); T(a.outcome, 34 + HS.tw(hd, 8.5, { w: 600 }), 36, 8.5, a.col, { w: 600 });
      T('seed ' + S.seed, 606, 36, 7.5, C.muted, { a: 'right' });
      g.fillStyle = '#22324a'; g.fillRect(34, 43, 572, 1);

      // ----- the journey: five stages, a path between them, a ship travelling it as far as the run got
      const NX = (i) => 92 + i * 114, NY = 70, kp = clamp((t - .2) / 1.4, 0, 1) * Rp.reach;
      for (let i = 0; i < 4; i++) {
        const x0 = NX(i) + 19, x1 = NX(i + 1) - 19, done = Math.min(1, Math.max(0, kp - i));
        for (let X = x0; X < x1; X += 4) { const on = (X - x0) / (x1 - x0) < done; g.fillStyle = on ? (i + 1 === Rp.reach && Rp.st[i + 1].st === 'fail' ? C.red : C.cyan) : '#2a3a52'; g.fillRect(X, NY - .5, on ? 3 : 2, 1); }
      }
      if (t < 1.8) { const i = Math.min(3, Math.floor(kp)), f = kp - i, X = NX(i) + 19 + (NX(i + 1) - NX(i) - 38) * Math.min(1, f); g.fillStyle = '#ffffff'; g.fillRect(X - 1.5, NY - 1.5, 3, 3); g.fillStyle = 'rgba(120,255,220,.35)'; g.fillRect(X - 3, NY - 3, 6, 6); }
      // a flight that failed: the path runs on towards the destination as far as the ship got, and stops at an X
      if (Rp.st[2].st === 'fail' && Rp.lost != null) {
        const x0 = NX(2) + 19, x1 = NX(3) - 19, xe = x0 + (x1 - x0) * Rp.lost * clamp((t - 1.6) / .6, 0, 1);
        for (let X = x0; X < xe - 3; X += 4) { g.fillStyle = C.red; g.fillRect(X, NY - .5, 3, 1); }
        if (t > 2.2) {
          g.strokeStyle = C.red; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xe - 3, NY - 3); g.lineTo(xe + 3, NY + 3); g.moveTo(xe + 3, NY - 3); g.lineTo(xe - 3, NY + 3); g.stroke();
          T(`${Math.round(Rp.lost * 100)}% there`, xe, NY - 7, 6.5, C.red, { w: 700, a: 'center' });
        }
      }
      Rp.st.forEach((s, i) => {
        const on = kp >= i - .001 || t >= Rp.endAt, cx = NX(i), col = STATUS[s.st];
        g.globalAlpha = on ? 1 : .25;
        g.fillStyle = s.st === 'skip' ? 'rgba(20,28,40,.9)' : 'rgba(14,22,36,.95)'; g.beginPath(); g.arc(cx, NY, 17, 0, Math.PI * 2); g.fill();
        g.strokeStyle = on ? col : '#2a3a52'; g.lineWidth = s.st === 'fail' ? 1.5 : 1; g.stroke();
        if (s.st === 'skip') g.globalAlpha = .3;
        img(A[s.k], cx - 12.5, NY - 12.5);
        g.globalAlpha = on ? 1 : .25;
        if (on && s.st !== 'skip') img(A[s.st], cx + 8, NY - 18);
        T(s.name, cx, NY + 27, 6.5, s.st === 'skip' ? '#4a5a72' : C.muted, { w: 700, a: 'center' });
        T(s.v, cx, NY + 37, 7, s.st === 'fail' ? C.red : s.st === 'skip' ? '#4a5a72' : s.st === 'warn' ? C.amber : C.white, { w: 600, a: 'center' });
        g.globalAlpha = 1;
      });
      g.fillStyle = '#22324a'; g.fillRect(34, 116, 572, 1);

      // ----- left: what decided it, your rocket with that part circled, and what real missions do
      const kw = clamp((t - Rp.whyAt) / .4, 0, 1);
      if (kw > 0) {
        g.globalAlpha = kw;
        T('WHAT DECIDED IT', 34, 128, 6.5, C.muted, { w: 700 });
        const ids = { prop: S.slots.prop || '', power: S.slots.power || '', comms: S.slots.comms || '', payload: S.slots.payload || '' }, bp = HS.blueprint.ink(ids);
        const bx = 34, by = 134, bw = bp.c.width / 2 + 8, bh = bp.c.height / 2 + 8;
        g.fillStyle = '#0f3364'; g.fillRect(bx, by, bw, bh);
        for (let X = 5; X < bw; X += 5) { g.fillStyle = 'rgba(150,200,255,.07)'; g.fillRect(bx + X, by, .5, bh); }
        for (let Y = 5; Y < bh; Y += 5) { g.fillStyle = 'rgba(150,200,255,.07)'; g.fillRect(bx, by + Y, bw, .5); }
        img(bp.c, bx + 4, by + 4);
        if (a.culprit) {
          const [ax, ay] = bp.anchors[a.culprit], rc = a.full ? C.green : a.col, r = 6 + Math.sin(t * 4) * 1.2;
          g.strokeStyle = rc; g.lineWidth = 1; g.beginPath(); g.arc(bx + 4 + ax / 2, by + 4 + ay / 2, r, 0, Math.PI * 2); g.stroke();
          const part = HS.PARTS[S.slots[a.culprit]];
          if (part) { img(HS.partIcon(S.slots[a.culprit]), bx, by + bh + 4); T(part.name, bx + 20, by + bh + 12, 6.5, rc, { w: 700 }); T(HS.SLOT_NAME[a.culprit].toLowerCase(), bx + 20, by + bh + 20, 6, C.muted); }
        }
        let y = 138;
        const tx = 132;
        Rp.head.forEach((ln) => { T(ln, tx, y, 8.5, C.white, { w: 700 }); y += 11; });
        y += 3;
        Rp.chain.forEach((lines, i) => {
          const kc = clamp((t - Rp.whyAt - .3 - i * .3) / .3, 0, 1);
          if (kc <= 0) return;
          g.globalAlpha = kw * kc;
          g.fillStyle = a.col; g.fillRect(tx, y - 4, 2.5, 2.5);
          lines.forEach((ln) => { T(ln, tx + 7, y, 6.5, '#c8d2dc'); y += 8.5; });
          y += 3; g.globalAlpha = kw;
        });
        g.globalAlpha = 1;
      }
      const kr = clamp((t - Rp.realAt) / .4, 0, 1);
      if (kr > 0) {
        const ry = Math.max(234, Rp.textEnd + 6), lines = Rp.real.slice(0, Math.max(1, Math.floor((306 - ry - 22) / 8.5))), rh = 22 + lines.length * 8.5;
        g.globalAlpha = kr;
        g.fillStyle = 'rgba(255,180,60,.06)'; g.fillRect(34, ry, 296, rh); g.fillStyle = C.amber; g.fillRect(34, ry, 2, rh);
        img(A.fact, 40, ry + 4);
        T(a.realTag.toUpperCase(), 58, ry + 11, 6.5, C.amber, { w: 700 });
        lines.forEach((ln, i) => T(ln, 58, ry + 21 + i * 8.5, 6.5, '#e8ecf2'));
        g.globalAlpha = 1;
      }
      g.fillStyle = '#22324a'; g.fillRect(340, 122, 1, 186);

      // ----- right: the score, row by row with an icon and a bar each, then the total
      const rx = 350;
      T('SCORE', rx, 128, 6.5, C.muted, { w: 700 });
      const icons = ['data', 'crew', 'credits', 'time', 'hull', 'objectives'];
      const frac = [a.landed ? Math.min(1, a.u / a.target) : 0, a.landed ? S.crewStanding : 0, S.credits / S.creditsStart, S.buildLeft / HS.BUILD_TIME, a.landed ? (S.fuel + S.hull) / 200 : 0, a.objN / 3];
      const cols = [C.cyan, C.white, C.pink, C.amber, '#5a96f5', C.green];
      a.rows.forEach(([n, v, pts], i) => {
        const k = clamp((t - Rp.rowsAt - i * .18) / .35, 0, 1); if (k <= 0) return;
        const yy = 142 + i * 14;
        g.globalAlpha = k;
        img(A[icons[i]], rx, yy - 7);
        T(n, rx + 13, yy, 6.5, C.muted, { w: 600 });
        if (i === 5) {
          for (let j = 0; j < 3; j++) { g.fillStyle = j < a.objN ? C.green : '#1e2838'; g.fillRect(452 + j * 9, yy - 5, 7, 5); }
          if (S.bonusDone) { g.fillStyle = C.pink; g.fillRect(481, yy - 6, 2, 7); g.fillRect(478.5, yy - 3.5, 7, 2); }
        } else { g.fillStyle = '#1e2838'; g.fillRect(452, yy - 5, 60, 4); g.fillStyle = cols[i]; g.fillRect(452, yy - 5, 60 * clamp(frac[i], 0, 1) * k, 4); }
        T(v, 560, yy, 6.5, C.white, { a: 'right' });
        T('+' + pts, 606, yy, 7, pts ? C.green : '#6f7d8c', { w: 700, a: 'right' });
        g.globalAlpha = 1;
      });
      if (t > Rp.scoreAt) {
        const k = seg(t, Rp.scoreAt, Rp.scoreAt + .9);
        g.fillStyle = '#22324a'; g.fillRect(rx, 230, 256, 1);
        T('TOTAL', rx, 243, 6.5, C.muted, { w: 700 });
        T(String(Math.round(a.score * k)), rx, 282, 36, C.white, { w: 700, f: PIX });
        if (k >= 1) T(Rp.newBest ? 'new best' : 'best ' + Math.max(Rp.best, a.score), rx, 296, 7, Rp.newBest ? C.green : C.muted, { w: 600 });
        // your astronaut: standing, or laid out if the suit ran dry
        if (S.crewStanding || S.ended && S.ended.phase !== 'surface') HS.bigAstro(568, 250 + (a.full ? Math.round(Math.sin(t * 3) * 1.5) : 0), 1.5, S.suit);
        else { const d = HS.crewDown(S.suit); g.imageSmoothingEnabled = false; g.drawImage(d, 548, 300 - d.height, d.width, d.height); }
        const st = seg(t, Rp.scoreAt + .5, Rp.scoreAt + .8);
        if (st > 0) { g.save(); g.translate(500, 250); g.rotate(-.1); g.globalAlpha = st; const sc = 2 - st; g.scale(sc, sc); const w = HS.tw(a.outcome, 9, { w: 700, f: PIX }) + 14; g.fillStyle = 'rgba(8,14,26,.85)'; g.fillRect(-w / 2, -9, w, 18); g.strokeStyle = a.col; g.lineWidth = 1.5; g.strokeRect(-w / 2, -9, w, 18); T(a.outcome, 0, 1, 9, a.col, { w: 700, a: 'center', b: 'middle', f: PIX }); g.restore(); g.globalAlpha = 1; }
      }
      if (t >= Rp.endAt) {
        if (HS.button('[ENTER] new seed', 34, 316, 120, 18, C.amber, Math.floor(t * 2) % 2)) Rp.btn = 'new';
        if (HS.button('[R] same seed again', 162, 316, 130, 18, C.cyan)) Rp.btn = 'retry';
        if (HS.button('[T] title', 300, 316, 70, 18, C.muted)) Rp.btn = 'title';
      } else T('[ENTER] skip', 34, 330, 7, C.muted);
    }
  };

  HS.dbg = HS.dbg || {}; HS.dbg.report = () => Rp;   // test hook
})();

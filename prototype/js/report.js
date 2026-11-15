// Homestead mission report: find the biggest loss, walk it back to a build choice, name the real mission.
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
    rows.push(['Build time left', HS.fmt(S.buildLeft), Math.min(180, S.buildLeft)]);
    rows.push(['Fuel and hull', `${Math.round(S.fuel)}% / ${Math.round(S.hull)}%`, landed ? Math.round((S.fuel + S.hull) / 5) : 0]);
    const objN = (S.scansRich >= mi.objectives.scans ? 1 : 0) + (S.sampleDone ? 1 : 0) + (S.deployDone ? 1 : 0);
    rows.push(['Objectives', `${objN} / 3${S.bonusDone ? ' + bonus' : ''}`, landed ? objN * 20 + (S.bonusDone ? 30 : 0) : 0]);
    const score = rows.reduce((a, r) => a + r[2], 0);
    const full = landed && !e && u >= target && objN === 3;
    const outcome = full ? 'SUCCESS' : landed && u > 0 ? 'PARTIAL SUCCESS' : 'MISSION FAILED';
    return { head, chain, real, realTag, rows, score, outcome, sal, col: full ? C.green : outcome === 'PARTIAL SUCCESS' ? C.amber : C.red };
  };

  HS.scenes.report = {
    enter() {
      Rp = { t: 0, a: HS.analyze(), best: HS.best(), n: 0 };
      Rp.newBest = Rp.a.score > Rp.best; HS.saveBest(Rp.a.score);
      Rp.a.outcome === 'MISSION FAILED' ? HS.sfx.sad() : HS.sfx.jingle();
      // lay out the typed lines once
      let tt = .5; Rp.lines = [];
      const add = (s, size, col, o, x, w) => { for (const ln of HS.wrap(s, w, size, o)) { Rp.lines.push({ s: ln, at: tt, size, col, o, x }); tt += ln.length / 90 + .12; } };
      add(Rp.a.head, 10.5, C.white, { w: 600 }, 38, 332); Rp.chainFrom = Rp.lines.length;
      Rp.a.chain.forEach(s => add(s, 8, '#dbe3ea', {}, 50, 320)); Rp.chainTo = Rp.lines.length; tt += .3;
      Rp.realAt = tt; tt += .3; add(Rp.a.real, 8, C.white, {}, 38, 332);
      Rp.rowsAt = tt + .3; Rp.scoreAt = Rp.rowsAt + Rp.a.rows.length * .2 + .3; Rp.endAt = Rp.scoreAt + 1.2;
    },
    update(dt) {
      const before = Rp.t; Rp.t += dt;
      if (Rp.t < Rp.rowsAt && Math.floor(Rp.t * 24) !== Math.floor(before * 24)) HS.sfx.type();
      if (Rp.t > Rp.scoreAt && before <= Rp.scoreAt) HS.sfx.ok();
      const skip = HS.hit('Enter', 'Space', 'KeyE') || HS.In.click;
      if (Rp.t < Rp.endAt) { if (skip) { Rp.t = Rp.endAt; HS.In.click = false; HS.In.hit.clear(); } return; }
      const S = HS.S;
      if (HS.hit('KeyR') || Rp.btn === 'retry') { HS.newRun(S.mission.id, S.seed); HS.S.suit = S.suit; HS.sfx.ok(); HS.go('brief'); }
      else if (HS.hit('Enter', 'KeyN') || Rp.btn === 'new') { HS.newRun(S.mission.id, 10000 + Math.floor(Math.random() * 89999)); HS.S.suit = S.suit; HS.sfx.ok(); HS.go('brief'); }
      else if (HS.hit('KeyT', 'Escape') || Rp.btn === 'title') { HS.sfx.blip(); HS.go('title'); }
      Rp.btn = null;
    },
    draw() {
      const t = Rp.t, a = Rp.a, S = HS.S, mi = S.mission;
      // how the run ended, behind the panel: the lander on the surface, the burnt pad, or the planet never reached
      HS.cutArt.report(t); HS.blitArt();
      box(20, 20, 600, 322, C.cyan, 6);
      const hd = `MISSION REPORT  /  ${mi.name}  /  `;
      T(hd, 38, 40, 8.5, C.cyan, { w: 600 }); T(a.outcome, 38 + HS.tw(hd, 8.5, { w: 600 }), 40, 8.5, a.col, { w: 600 });
      T('seed ' + S.seed, 602, 40, 7.5, C.muted, { a: 'right' });
      g.strokeStyle = '#22324a'; g.lineWidth = 1; g.beginPath(); g.moveTo(38, 48); g.lineTo(602, 48); g.moveTo(384, 58); g.lineTo(384, 306); g.stroke();
      // left column: what happened, why, and the real mission
      let y = 68; const ys = {};
      Rp.lines.forEach((ln, i) => {
        if (i === Rp.chainFrom) { y += 4; ys.chainStart = y; }
        if (i === Rp.chainTo) { ys.chainEnd = y; y += 22; }
        if (t > ln.at) T(typed(ln.s, t - ln.at, 90), ln.x, y, ln.size, ln.col, ln.o);
        y += ln.size + 5;
      });
      if (t > Rp.lines[Rp.chainFrom].at) { g.fillStyle = '#3a4a62'; g.fillRect(40, ys.chainStart - 8, 2, ys.chainEnd - ys.chainStart - 2); }
      if (t > Rp.realAt) T(a.realTag.toUpperCase(), 38, ys.chainEnd + 10, 7.5, C.amber, { w: 600 });
      // right column: the build, the score rows, the score
      const rx = 400;
      if (t > .3) {
        T('YOUR BUILD', rx, 68, 7.5, C.muted, { w: 600 });
        HS.SLOTS.forEach((slot, i) => { const p = HS.PARTS[S.slots[slot]]; if (!p) return; const yy = 83 + i * 12.5; g.fillStyle = CAT[slot]; g.fillRect(rx, yy - 6, 6, 6); T(p.name, rx + 11, yy, 8, p.salvage ? C.red : C.white, { w: p.salvage ? 600 : 500 }); T(HS.SLOT_NAME[slot].toLowerCase(), 602, yy, 6.5, C.muted, { a: 'right' }); });
        if (a.sal.length) T('red: salvage part from an empty slot', rx, 134, 6.5, C.red);
      }
      a.rows.forEach(([n, v, pts], i) => {
        const k = t - Rp.rowsAt - i * .2; if (k < 0) return; const yy = 154 + i * 14;
        T(n, rx, yy, 8, C.muted); T(v, 556, yy, 8, C.white, { a: 'right' }); T('+' + pts, 602, yy, 8, pts ? C.green : '#6f7d8c', { w: 600, a: 'right' });
      });
      if (t > Rp.scoreAt) {
        const k = seg(t, Rp.scoreAt, Rp.scoreAt + .9);
        g.strokeStyle = '#22324a'; g.beginPath(); g.moveTo(rx, 236); g.lineTo(602, 236); g.stroke();
        T('SCORE', rx, 252, 8.5, C.muted, { w: 600 });
        T(String(Math.round(a.score * k)), rx, 292, 40, C.white, { w: 700, f: PIX });
        if (k >= 1) T(Rp.newBest ? 'new best' : 'best ' + Math.max(Rp.best, a.score), rx, 304, 7.5, Rp.newBest ? C.green : C.muted, { w: 600 });
        HS.bigAstro(566, 262 + (S.crewStanding && !S.ended ? Math.sin(t * 3) * 1.5 : 0), 1.5, S.suit);
        const st = seg(t, Rp.scoreAt + .5, Rp.scoreAt + .8);
        if (st > 0) { g.save(); g.translate(540, 250); g.rotate(-.1); g.globalAlpha = st; const sc = 2 - st; g.scale(sc, sc); const w = HS.tw(a.outcome, 9, { w: 700, f: PIX }) + 14; g.fillStyle = 'rgba(8,14,26,.85)'; g.fillRect(-w / 2, -9, w, 18); g.strokeStyle = a.col; g.lineWidth = 1.5; g.strokeRect(-w / 2, -9, w, 18); T(a.outcome, 0, 1, 9, a.col, { w: 700, a: 'center', b: 'middle', f: PIX }); g.restore(); g.globalAlpha = 1; }
      }
      if (t >= Rp.endAt) {
        if (HS.button('[ENTER] new seed', 38, 316, 120, 18, C.amber, Math.floor(t * 2) % 2)) Rp.btn = 'new';
        if (HS.button('[R] same seed again', 166, 316, 130, 18, C.cyan)) Rp.btn = 'retry';
        if (HS.button('[T] title', 304, 316, 70, 18, C.muted)) Rp.btn = 'title';
      } else T('[ENTER] skip', 38, 330, 7, C.muted);
    }
  };
  HS.dbg = HS.dbg || {}; HS.dbg.report = () => Rp;   // test hook
})();

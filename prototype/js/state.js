// Homestead GameState: the one copy of the run. Scenes read build stats from it and write events to it.
(() => {
  const HS = window.HS;

  HS.newRun = (missionId, seed) => {
    const m = HS.MISSIONS[missionId];
    HS.S = {
      seed, mission: m, suit: (HS.S && HS.S.suit) || HS.C.pilot, visor: (HS.S && HS.S.visor) || 'gold', name: (HS.S && HS.S.name) || '',
      credits: m.credits, creditsStart: m.credits,
      slots: { prop: null, power: null, comms: null, payload: null },
      salvaged: [], kioskBuys: 0, buildLeft: 0, emptyAtTimeout: [],
      // flight results
      fuel: 100, hull: 100, hits: 0, hitsNoWarn: 0, trips: 0, instDamage: 0, cabinO2: 100, telemetry: 0, flightTime: 0, hotTime: 0,
      // surface results
      uplinked: 0, buffer: 0, carried: 0, lostDown: 0, yieldLost: 0, scansRich: 0, scansPoor: 0, sampleDone: false, deployDone: false, bonusDone: false,
      crewStanding: 1, hazardTime: 0, surfaceLeft: 0,
      ended: null,   // { phase, reason } when a run ends early
      log: []
    };
  };

  HS.log = (type, data = {}) => { HS.S.log.push(Object.assign({ type }, data)); };

  // Build stats from whatever is mounted. extra = { slot: partId } previews a part before mounting.
  HS.model = (extra) => {
    const s = Object.assign({}, HS.S.slots, extra || {});
    const P = HS.PARTS, part = (k) => s[k] ? P[s[k]] : null;
    const prop = part('prop'), power = part('power'), comms = part('comms'), payload = part('payload');
    let mass = HS.CABIN_MASS, draw = HS.BASE_LOAD;
    for (const p of [prop, power, comms, payload]) if (p) { mass += p.mass; if (p.power < 0) draw += -p.power; }
    const lift = prop ? prop.lift : 0, supply = power ? power.power : 0;
    return {
      prop, power, comms, payload, mass, lift, supply, draw,
      massFrac: lift ? mass / lift : 0, overweight: lift > 0 && mass > lift,
      loadFrac: supply ? draw / supply : 0,
      heavy: lift ? HS.clamp((mass / lift - .8) / .2, 0, 1.5) : 0,   // 0 below 80% of lift, 1 at the limit
      mounted: [prop, power, comms, payload].filter(Boolean).length
    };
  };

  HS.best = () => { try { return parseInt(localStorage.getItem('homestead.best') || '0', 10) || 0; } catch (e) { return 0; } };
  HS.saveBest = (v) => { try { if (v > HS.best()) localStorage.setItem('homestead.best', String(v)); } catch (e) { /* storage blocked: skip */ } };
})();

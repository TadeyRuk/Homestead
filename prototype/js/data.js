// Homestead data: every balance number lives in this file.
// Part mass and power follow the team proposal. "real" is the hardware each part is based on.
// Flight and surface numbers are game assumptions, tuned for a ten-minute run.
(() => {
  const HS = window.HS;

  HS.CABIN_MASS = 200;   // crew cabin and tanks, kg (game assumption)
  HS.BASE_LOAD = 150;    // life support 90 W + galley heater 40 W + cabin lights 20 W (game assumption)
  HS.KIOSK_COST = 20;
  // pacing: a run is about 14-15 minutes. PACE stretches every phase clock (3:00 became 5:00); the goals are
  // rescaled with it so a longer run is fuller, not easier. Flight events come EVENT_K times further apart, so a
  // longer flight has about 30% more of them; fuel burn and hull damage per hit are divided by EVENT_K to match.
  HS.PACE = 5 / 3;
  HS.EVENT_K = Math.sqrt(HS.PACE);
  HS.BUILD_TIME = 300;
  HS.SURFACE_TIME = 300;
  HS.DRAWN_GOALS = 3;    // objectives drawn from the mission's pool each run, besides the uplink and the bonus

  HS.SLOTS = ['prop', 'power', 'comms', 'payload'];
  HS.SLOT_NAME = { prop: 'PROPULSION', power: 'POWER', comms: 'COMMS', payload: 'PAYLOAD' };
  HS.SLOT_ROLE = { prop: 'pilot', power: 'eng', comms: 'comms', payload: 'sci' };

  HS.PARTS = {
    // propulsion: lift kg, steer mode, steer speed, fuel burn per second of thrust, transit time multiplier
    solid: { slot: 'prop', name: 'Solid motor', mass: 180, power: -10, lift: 600, steer: 'pulse', turn: 46, burn: 5.2, accel: .3, transit: 1, flight: 'Lifts 600 kg. Steers in fixed pulses', surf: 'Fuel left scores', real: 'Solid rocket boosters (Space Shuttle, SLS)', fact: 'Solid boosters give huge thrust but cannot be throttled or shut down once lit. Shuttle and SLS pair them with liquid engines for control.' },
    chem: { slot: 'prop', name: 'Chemical engine', mass: 300, power: -30, lift: 900, steer: 'smooth', turn: 70, burn: 9, accel: .4, transit: .9, flight: 'Lifts 900 kg. Responsive, thirsty', surf: 'Fuel left scores', real: 'RL10 upper-stage engine', fact: 'The RL10 has flown since the 1960s because it restarts and throttles cleanly, but every burn spends propellant that had to be launched too.' },
    ion: { slot: 'prop', name: 'Ion drive', mass: 120, power: -250, lift: 500, steer: 'slow', turn: 30, burn: 1.2, accel: .14, transit: 1.25, flight: 'Lifts 500 kg. Slow, sips fuel', surf: 'Fuel left scores', real: 'Ion propulsion on Dawn', fact: 'Dawn\'s ion engines pushed about as hard as a sheet of paper weighs, but ran for years on very little xenon and visited two worlds.' },
    // power: supply W, solar (drops in flares and far from the Sun), heat added to the core, suit recharge %/s, bigger debris target,
    // drill: width of the ice drill's safe pressure band (js/games/drill.js); more torque, wider band
    solar_s: { slot: 'power', name: 'Small solar array', mass: 60, power: 300, solar: true, heat: 0, recharge: 7, target: 0, drill: .16, flight: 'Drops in solar flares', surf: 'Slow suit recharge, weak at Mars', real: 'InSight lander arrays', fact: 'InSight ran on two small solar arrays. Mars dust slowly covered them, and the mission ended when power ran out.' },
    solar_l: { slot: 'power', name: 'Large solar array', mass: 150, power: 600, solar: true, heat: 0, recharge: 16, target: 2.5, drill: .24, flight: 'Plenty of power, bigger debris target', surf: 'Fast recharge, weak at Mars', real: 'Juno\'s arrays', fact: 'Juno needs three 9 m solar wings to make a few hundred watts at Jupiter, where sunlight is 25 times weaker than at Earth.' },
    rtg: { slot: 'power', name: 'Radioisotope generator', mass: 110, power: 450, solar: false, heat: .35, recharge: 11, target: 0, drill: .34, flight: 'Steady, ignores flares, runs hot', surf: 'Steady anywhere', real: 'MMRTG on Curiosity and Perseverance', fact: 'Curiosity and Perseverance carry an MMRTG, so dust storms and night do not stop them. The waste heat has to be managed all the time.' },
    // comms: dish drift, beam half-width deg, data units per second from the lander, seconds of debris warning
    lga: { slot: 'comms', name: 'Low-gain antenna', mass: 15, power: -20, drift: .25, beam: 20, rate: .22, warn: 2, flight: 'Hardly drifts, short warning', surf: 'Slow upload', real: 'Rover low-gain antennas', fact: 'Rover low-gain antennas work in almost any direction, but only at a trickle. They are the backup, not the science link.' },
    dish: { slot: 'comms', name: 'High-gain dish', mass: 70, power: -80, drift: 1, beam: 10, rate: .5, warn: 4.5, flight: 'Drifts when the pilot turns', surf: 'Fast upload', real: 'Mars Reconnaissance Orbiter\'s 3 m dish', fact: 'Mars Reconnaissance Orbiter carries a 3 m dish so its cameras\' data can get home. A strong instrument needs a link that can keep up.' },
    laser: { slot: 'comms', name: 'Laser terminal', mass: 40, power: -120, drift: 1.7, beam: 5.5, rate: .95, warn: 6, flight: 'Hardest to keep on target', surf: 'Fastest upload', real: 'Deep Space Optical Comms on Psyche', fact: 'The Deep Space Optical Communications demo on Psyche sent data by laser far faster than radio, but the beam has to be pointed with extreme precision.' },
    // payload: core heat, scan seconds, data units at a rich and a poor site
    camera: { slot: 'payload', name: 'Camera', mass: 30, power: -40, heat: .55, scan: 2.2, rich: 8, poor: 3, flight: 'Barely heats the core', surf: 'Quick scans, little data', real: 'HiRISE on Mars Reconnaissance Orbiter', fact: 'HiRISE takes sharp pictures quickly, but a picture answers fewer questions than a spectrum or a radar profile.' },
    spectro: { slot: 'payload', name: 'Spectrometer', mass: 80, power: -110, heat: 1.05, scan: 4, rich: 13, poor: 5, flight: 'Needs cooling', surf: 'Medium scans, good data', real: 'SuperCam on Perseverance', fact: 'SuperCam on Perseverance reads rock chemistry from a distance. Its detectors have to be kept cold to work.' },
    radar: { slot: 'payload', name: 'Radar sounder', mass: 160, power: -200, heat: 1.7, scan: 6, rich: 19, poor: 8, flight: 'Overheats fast', surf: 'Slow scans, most data', real: 'SHARAD on Mars Reconnaissance Orbiter', fact: 'SHARAD looks up to a kilometre under the Martian surface, at the cost of mass, power and long observation passes.' },
    // salvage: what an empty slot gets when the build timer runs out
    sal_prop: { slot: 'prop', salvage: true, name: 'Salvage motor', mass: 220, power: -20, lift: 560, steer: 'slow', turn: 24, burn: 6.6, accel: .16, transit: 1.2, flight: 'Weak and sluggish', surf: '-', real: 'scrap', fact: 'Real missions pick the engine first, because it decides how much everything else is allowed to weigh.' },
    sal_power: { slot: 'power', salvage: true, name: 'Salvage cell', mass: 80, power: 240, solar: true, heat: 0, recharge: 4, target: 0, drill: .12, flight: 'Barely enough power', surf: 'Very slow recharge', real: 'scrap', fact: 'Real missions size the power system with margin. Running a spacecraft at its power limit leaves nothing for a bad day.' },
    sal_comms: { slot: 'comms', salvage: true, name: 'Salvage antenna', mass: 30, power: -30, drift: .5, beam: 16, rate: .1, warn: 1, flight: 'Almost no warning', surf: 'Very slow upload', real: 'scrap', fact: 'Mars Reconnaissance Orbiter carries a 3 m dish so its cameras\' data can get home. A strong instrument needs a link that can keep up.' },
    sal_payload: { slot: 'payload', salvage: true, name: 'Salvage sensor', mass: 40, power: -40, heat: .6, scan: 5, rich: 5, poor: 2, flight: 'Runs warm', surf: 'Slow scans, little data', real: 'scrap', fact: 'The instrument is the reason the mission flies. Real teams choose it first and build the spacecraft around it.' }
  };
  HS.REAL_PARTS = Object.keys(HS.PARTS).filter(k => !HS.PARTS[k].salvage);
  HS.SALVAGE = { prop: 'sal_prop', power: 'sal_power', comms: 'sal_comms', payload: 'sal_payload' };

  HS.MISSIONS = {
    moon: {
      id: 'moon', name: 'LUNAR SURVEY', short: 'Moon', credits: 20, target: 33, transit: 142, eventGap: [18, 26], sites: [4, 4], solarAtArrival: 1, solarFlight: 1, days: 3,
      card: [['Destination', 'the Moon, about 3 days away'], ['Radio delay', 'about 1.3 seconds each way'], ['Gravity', 'one sixth of Earth\'s'],
        ['Objectives', 'scan 3 rich sites, bring back regolith,'], ['', 'deploy a seismometer, uplink 33 data units'], ['Budget', '20 credits'], ['Spacecraft', 'none. Build one from what you find.']],
      objectives: { scans: 3, sample: 'Regolith to lander', deploy: 'Seismometer', sampleSite: 'CRATER FLOOR', deploySite: 'SEISMOMETER SITE', bonus: 'Photograph Earth', sampleWords: 'bring back regolith', deployWords: 'deploy a seismometer' },
      // S2-18: three of these are drawn by the seed each run (js/surface-games.js); a game is only drawn once it is merged
      pool: ['scan', 'sample', 'deploy', 'drill', 'relay', { id: 'panels', solar: true }],
      hazard: 'flare', hazardName: 'SOLAR FLARE',
      hazardFact: 'The Moon has no thick atmosphere or global magnetic field, so solar particles reach the surface. Crews need shelter within minutes of a warning.',
      walk: 40
    },
    mars: {
      id: 'mars', name: 'MARS SURVEY', short: 'Mars', credits: 40, target: 50, transit: 208, eventGap: [12, 18], sites: [5, 5], solarAtArrival: .43, solarFlight: .6, days: 210,
      card: [['Destination', 'Mars, about 7 months away'], ['Radio delay', '3 to 22 minutes each way'], ['Sunlight', 'about 43% of what Earth gets'],
        ['Objectives', 'scan 4 rich sites, drill a core, deploy a'], ['', 'weather station, uplink 50 data units'], ['Budget', '40 credits'], ['Spacecraft', 'none. Build one from what you find.']],
      objectives: { scans: 4, sample: 'Core sample to lander', deploy: 'Weather station', sampleSite: 'CORE SITE', deploySite: 'WEATHER STATION', bonus: 'Photograph a dust devil', sampleWords: 'drill a core', deployWords: 'deploy a weather station' },
      pool: ['scan', 'sample', 'deploy', 'drill', 'relay', { id: 'panels', solar: true }],
      hazard: 'storm', hazardName: 'DUST STORM',
      hazardFact: 'In 2018 a planet-wide dust storm cut off power to the Opportunity rover, and the mission ended. Planners now schedule surface work around Mars weather.',
      walk: 36
    }
  };
})();

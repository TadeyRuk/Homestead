// Homestead lounge content (js/lounge.js): trivia and Wordle words for the wait at the lander.
// Every trivia answer is something the game already says somewhere: a part's fact, a mission card or a report line.
// Each question is [question, right answer, wrong, wrong, wrong]; the answers are shuffled by the seed.
(() => {
  const HS = window.HS;
  HS.TRIVIA = [
    ['How long does the trip to the Moon take?', 'About 3 days', 'About 3 weeks', 'About 7 months', 'About a year'],
    ['How long does a radio signal take from the Moon to Earth?', 'About 1.3 seconds', 'About 3 minutes', 'About 13 seconds', 'Instantly'],
    ['How long does a radio signal take from Mars to Earth?', '3 to 22 minutes', 'About 1.3 seconds', 'About 2 hours', 'About 30 seconds'],
    ['How strong is the Moon\'s gravity compared with Earth\'s?', 'One sixth', 'One half', 'One tenth', 'About the same'],
    ['How much sunlight reaches Mars compared with Earth?', 'About 43%', 'About 90%', 'About 10%', 'About twice as much'],
    ['Which rovers carry an MMRTG, so night and dust storms do not stop them?', 'Curiosity and Perseverance', 'Spirit and Opportunity', 'Sojourner', 'InSight'],
    ['What ended the Opportunity rover\'s mission in 2018?', 'A planet-wide dust storm', 'A meteorite strike', 'It ran out of fuel', 'It fell into a crater'],
    ['What did the Phoenix lander find just under the Martian soil in 2008?', 'Water ice', 'Liquid water', 'Fossils', 'Gold'],
    ['Which spacecraft used ion engines to visit two worlds?', 'Dawn', 'Juno', 'Voyager 1', 'Apollo 11'],
    ['Which mission flies on Hall-effect thrusters?', 'Psyche', 'Apollo 11', 'Hubble', 'Pathfinder'],
    ['How wide is Mars Reconnaissance Orbiter\'s dish?', '3 metres', '30 centimetres', '30 metres', '300 metres'],
    ['Juno needs huge solar wings because sunlight at Jupiter is how much weaker than at Earth?', '25 times weaker', '2 times weaker', 'About the same', '1000 times weaker'],
    ['How deep can the SHARAD radar look under the surface of Mars?', 'Up to about a kilometre', 'About a metre', 'About 100 kilometres', 'About 10 centimetres'],
    ['Which instrument on Perseverance reads rock chemistry from a distance?', 'SuperCam', 'HiRISE', 'SHARAD', 'LEND'],
    ['Which CubeSats relayed InSight\'s landing on Mars back to Earth as it happened?', 'MarCO', 'Ingenuity', 'Lunar Reconnaissance Orbiter', 'Juno'],
    ['How is oxygen made on the International Space Station?', 'By splitting water', 'By burning fuel', 'Only from plants', 'Fresh tanks from Earth every week'],
    ['What did NASA\'s KRUSTY test run at full power in 2018?', 'A small fission reactor', 'A rover wheel', 'A heat shield', 'A spacesuit'],
    ['Lunar Prospector found extra hydrogen at the Moon\'s poles. What is it a sign of?', 'Water ice', 'Volcanoes', 'Helium gas', 'Buried metal'],
    ['How do Mars rovers send most of their data home?', 'Through orbiters passing overhead', 'Straight to Earth by laser', 'On a return rocket', 'They store it all on board'],
    ['What can a solid rocket booster NOT do once it is lit?', 'Throttle or shut down', 'Make thrust', 'Burn its fuel', 'Lift a rocket'],
    ['How do Roll-Out Solar Arrays open in space?', 'They unroll like a carpet', 'They inflate like a balloon', 'They fold out like a fan', 'They are painted on'],
    ['Why do real missions keep a mass budget from the first day?', 'The launcher sets a hard mass limit', 'Heavy parts are cheaper', 'Mass makes radios faster', 'It is only paperwork']
  ];
  // five-letter words from space, the missions and the game; no dictionary check, so any five letters is a guess
  HS.WORDS = ['ORBIT', 'LUNAR', 'ROVER', 'COMET', 'PROBE', 'SOLAR', 'EARTH', 'VENUS', 'PLUTO', 'TITAN',
    'SPACE', 'STARS', 'FLARE', 'STORM', 'DUNES', 'RINGS', 'PANEL', 'RADAR', 'LASER', 'CABIN',
    'HATCH', 'DRILL', 'CRUST', 'TIDES', 'CERES', 'VESTA', 'ORION', 'XENON', 'EAGLE', 'ARRAY',
    'BOOST', 'FUELS', 'DELAY', 'RELAY', 'PLUME', 'MOONS', 'ROCKS', 'SCANS', 'DUSTY', 'LIGHT'];
})();

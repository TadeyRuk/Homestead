// Content for the landing page. The part numbers are the game's own (prototype/js/data.js).

export const GAME_URL = 'https://seedlign.itch.io/homestead';

export type SlotId = 'prop' | 'power' | 'comms' | 'payload';
export type MissionId = 'moon' | 'mars';

export interface Part {
  slot: SlotId;
  name: string;
  mass: number;      // kg
  power: number;     // W: positive is supply, negative is draw
  cost: number;      // credits
  real: string;      // the NASA hardware it is based on
  fact: string;
  lift?: number;     // kg, propulsion only
  solar?: boolean;
}

export const CABIN_MASS = 200;
export const BASE_LOAD = 150;
export const COST_CAP: Record<MissionId, number> = { moon: 20, mars: 40 };

export const SLOTS: { id: SlotId; name: string; color: string }[] = [
  { id: 'prop', name: 'Propulsion', color: 'var(--amber)' },
  { id: 'power', name: 'Power', color: 'var(--blue)' },
  { id: 'comms', name: 'Comms', color: 'var(--mint)' },
  { id: 'payload', name: 'Payload', color: 'var(--pink)' }
];

export const PARTS: Record<string, Part> = {
  solid: { slot: 'prop', name: 'Solid motor', mass: 180, power: -10, cost: 6, lift: 600, real: 'SLS solid rocket boosters', fact: 'Huge thrust, but it cannot be throttled or shut down once lit.' },
  chem: { slot: 'prop', name: 'Chemical engine', mass: 300, power: -30, cost: 10, lift: 900, real: 'RL10 upper-stage engine', fact: 'Flying since the 1960s because it restarts and throttles cleanly.' },
  storable: { slot: 'prop', name: 'Storable engine', mass: 260, power: -25, cost: 9, lift: 800, real: 'Orion\'s service module engine', fact: 'Its two propellants ignite on contact, so it restarts every time.' },
  ion: { slot: 'prop', name: 'Ion drive', mass: 120, power: -250, cost: 12, lift: 500, real: 'Ion propulsion on Dawn', fact: 'Pushes about as hard as a sheet of paper weighs, for years on end.' },
  hall: { slot: 'prop', name: 'Hall thruster', mass: 140, power: -350, cost: 11, lift: 550, real: 'Hall-effect thrusters on Psyche', fact: 'More thrust than Dawn\'s ion engines, and kilowatts of power to feed.' },
  solar_s: { slot: 'power', name: 'Small solar array', mass: 60, power: 300, cost: 4, solar: true, real: 'InSight lander arrays', fact: 'Mars dust slowly covered them, and the mission ended when power ran out.' },
  rosa: { slot: 'power', name: 'Roll-out solar array', mass: 70, power: 550, cost: 7, solar: true, real: 'ROSA on the ISS and DART', fact: 'Unrolls like a carpet. Tested on the ISS, flown on DART.' },
  solar_l: { slot: 'power', name: 'Large solar array', mass: 150, power: 600, cost: 8, solar: true, real: 'Juno\'s arrays', fact: 'Three 9 m wings for a few hundred watts at Jupiter.' },
  rtg: { slot: 'power', name: 'Radioisotope generator', mass: 110, power: 450, cost: 16, real: 'MMRTG on Curiosity and Perseverance', fact: 'Dust storms and night do not stop it. The waste heat never stops either.' },
  reactor: { slot: 'power', name: 'Fission reactor', mass: 230, power: 800, cost: 20, real: 'Kilopower (KRUSTY test)', fact: 'Ran at full power in 2018. Built to carry a base through night and dust.' },
  lga: { slot: 'comms', name: 'Low-gain antenna', mass: 15, power: -20, cost: 2, real: 'Rover low-gain antennas', fact: 'Works in almost any direction, at a trickle. The backup link.' },
  reflectarray: { slot: 'comms', name: 'CubeSat reflectarray', mass: 20, power: -50, cost: 3, real: 'MarCO CubeSats', fact: 'Relayed InSight\'s landing back to Earth as it happened.' },
  uhf: { slot: 'comms', name: 'UHF relay radio', mass: 25, power: -40, cost: 5, real: 'Electra UHF radios on MRO and the rovers', fact: 'Rovers send most of their data up to orbiters, which pass it on.' },
  dish: { slot: 'comms', name: 'High-gain dish', mass: 70, power: -80, cost: 7, real: 'Mars Reconnaissance Orbiter\'s 3 m dish', fact: 'A strong instrument needs a link that can keep up.' },
  laser: { slot: 'comms', name: 'Laser terminal', mass: 40, power: -120, cost: 12, real: 'Deep Space Optical Comms on Psyche', fact: 'Far faster than radio, if you can hold the beam on target.' },
  neutron: { slot: 'payload', name: 'Neutron spectrometer', mass: 25, power: -30, cost: 4, real: 'Lunar Prospector and LEND on LRO', fact: 'Found the hydrogen at the lunar poles that points to water ice.' },
  camera: { slot: 'payload', name: 'Camera', mass: 30, power: -40, cost: 5, real: 'HiRISE on Mars Reconnaissance Orbiter', fact: 'Sharp and quick, but a picture answers fewer questions.' },
  spectro: { slot: 'payload', name: 'Spectrometer', mass: 80, power: -110, cost: 9, real: 'SuperCam on Perseverance', fact: 'Reads rock chemistry from a distance. Has to be kept cold.' },
  radar: { slot: 'payload', name: 'Radar sounder', mass: 160, power: -200, cost: 11, real: 'SHARAD on Mars Reconnaissance Orbiter', fact: 'Sees a kilometre under the surface, at a price in mass and power.' },
  sam: { slot: 'payload', name: 'Sample lab', mass: 120, power: -230, cost: 14, real: 'SAM on Curiosity', fact: 'Bakes rock powder in tiny ovens. The rover\'s biggest instrument.' }
};

export interface Station { id: string; color: string; name: string; text: string; keys: [string, string][]; tunedBy: string }

export const STATIONS: Station[] = [
  { id: 'pilot', color: 'var(--amber)', name: 'Pilot', text: 'First-person. Dodge debris, hold the transfer speed.', keys: [['A D', 'steer'], ['W S', 'speed']], tunedBy: 'propulsion' },
  { id: 'eng', color: 'var(--blue)', name: 'Rocket Engineer', text: 'Balance the power bus. Weld the hull before the air is gone.', keys: [['Q–U', 'loads'], ['F', 'weld']], tunedBy: 'power' },
  { id: 'comms', color: 'var(--mint)', name: 'Comms Engineer', text: 'Keep Earth in the beam, or the pilot flies blind.', keys: [['A D', 'lean the dish']], tunedBy: 'comms' },
  { id: 'sci', color: 'var(--pink)', name: 'Science Officer', text: 'Hold the core in its safe band. Keep the cabin breathing.', keys: [['W S', 'valve'], ['SPACE', 'cartridge']], tunedBy: 'payload' }
];

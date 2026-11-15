// The build lab: one part per slot, checked the way the game's blueprint checks it.
import { BASE_LOAD, CABIN_MASS, COST_CAP, PARTS, SLOTS, type MissionId, type SlotId } from './data';
import { $, $$ } from './dom';
import { sfx } from './sound';

export function lab(): void {
  const pick: Record<SlotId, string> = { prop: 'ion', power: 'solar_s', comms: 'dish', payload: 'radar' };
  let mission: MissionId = 'mars', last = 'ion';

  $('#slots').innerHTML = SLOTS.map((s) => `<div class="slotrow" style="--c:${s.color}"><h4>${s.name}</h4><div class="parts">${
    Object.entries(PARTS).filter(([, p]) => p.slot === s.id).map(([id, p]) =>
      `<button data-id="${id}" aria-pressed="false"><b>${p.name}</b><span>${p.mass} kg · ${p.power > 0 ? '+' : ''}${p.power} W · ${p.cost} cr</span></button>`).join('')
  }</div></div>`).join('');

  const meter = (id: string, value: number, max: number, unit: string): boolean => {
    const el = $(id), bad = value > max;
    el.classList.toggle('bad', bad);
    $('.row span:last-child', el).textContent = `${value} / ${max} ${unit}`;
    $('i', el).style.width = `${Math.min(100, (value / max) * 100)}%`;
    return bad;
  };

  const update = (): void => {
    $$('#slots button').forEach((b) => b.setAttribute('aria-pressed', String(pick[PARTS[b.dataset.id!].slot] === b.dataset.id)));
    $$('.mis button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mission)));
    const parts = Object.values(pick).map((id) => PARTS[id]);
    const mass = CABIN_MASS + parts.reduce((a, p) => a + p.mass, 0), lift = PARTS[pick.prop].lift ?? 0;
    const draw = BASE_LOAD + parts.reduce((a, p) => a + (p.power < 0 ? -p.power : 0), 0), supply = PARTS[pick.power].power;
    const cost = parts.reduce((a, p) => a + p.cost, 0), cap = COST_CAP[mission];
    const heavy = meter('#m-mass', mass, lift, 'kg'), trip = meter('#m-power', draw, supply, 'W'), over = meter('#m-cost', cost, cap, 'cr');
    const [head, why] = heavy ? ['Too heavy to fly', `${mass - lift} kg over. It never reaches orbit.`]
      : trip ? ['Breakers will trip', `${draw - supply} W short. The screens go dark in flight.`]
      : over ? ['Over the cost cap', `${cost - cap} credits over. That costs score.`]
      : PARTS[pick.power].solar && mission === 'mars' ? ['Flies, with a catch', 'Mars gets 43% of Earth\'s sunlight. Solar is weak there.']
      : ['Ready to fly', `${lift - mass} kg and ${supply - draw} W to spare.`];
    const v = $('#verdict'), bad = heavy || trip || over;
    v.className = 'verdict' + (bad ? ' bad' : '');
    v.innerHTML = `${head}<small>${why}</small>`;
    v.classList.remove('pop'); void v.offsetWidth; v.classList.add('pop');
    $('#fact').innerHTML = `<b>Based on</b><strong>${PARTS[last].real}</strong>${PARTS[last].fact}`;
  };

  $('#slots').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    last = b.dataset.id!; pick[PARTS[last].slot] = last; update();
    if ($('#verdict').classList.contains('bad')) sfx.bad(); else sfx.good();
  });
  $$('.mis button').forEach((b) => b.addEventListener('click', () => { mission = b.dataset.m as MissionId; update(); }));
  update();
}

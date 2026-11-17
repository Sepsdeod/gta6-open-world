// The city of Solmar Bay: a seeded grid of avenues and streets, blocks of
// buildings, a park, a marina, a beach and the named places missions use.
// Generation is pure data — no drawing here — so the renderer, the traffic
// and the missions all read the same city.
import { BEACH, PALETTE, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 0, x1: 1000, y1: 800 },
  { name: 'Downtown', x0: 1000, y0: 0, x1: 2200, y1: 1100 },
  { name: 'Palm Heights', x0: 2200, y0: 0, x1: 3200, y1: 1100 },
  { name: 'Marina District', x0: 0, y0: 1100, x1: 1600, y1: 2050 },
  { name: 'Solmar Beach', x0: 1600, y0: 1100, x1: 3200, y1: 2400 },
];

export const PLACES = {
  hideout: { name: "Mara's Hideout", x: 480, y: 440 },
  marina: { name: 'Rico at the Marina', x: 800, y: 1640 },
  downtownDrop: { name: 'Downtown Drop', x: 1760, y: 440 },
  cometGT: { name: 'Comet GT', x: 2400, y: 1040 },
  garage: { name: "Lou's Garage", x: 1120, y: 1340 },
  docks: { name: 'Dockside Deal', x: 480, y: 1640 },
  bank: { name: 'Solmar National Bank', x: 1760, y: 1040 },
  beach: { name: 'Solmar Beach', x: 2720, y: 2140 },
  park: { name: 'Palm Park', x: 1440, y: 740 },
};

function nearestRoad(value, roads) {
  let best = roads[0];
  for (const road of roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parked = [];
  const roadSet = new Set();

  // One or two buildings per block, kept off the roads and the beach.
  for (let a = 0; a < ROADS.avenues.length - 1; a += 1) {
    for (let s = 0; s < ROADS.streets.length - 1; s += 1) {
      const x0 = ROADS.avenues[a] + 52;
      const y0 = ROADS.streets[s] + 52;
      const x1 = ROADS.avenues[a + 1] - 52;
      const y1 = ROADS.streets[s + 1] - 52;
      if (y0 > BEACH.sandTop) continue;
      // The park block stays green.
      if (a === 4 && s === 2) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: range(random, x0, x1), y: range(random, y0, y1), r: range(random, 10, 18) });
        }
        continue;
      }
      const count = 1 + Math.floor(random() * 2);
      for (let b = 0; b < count; b += 1) {
        const w = range(random, 90, Math.min(190, (x1 - x0) / count - 16));
        const h = range(random, 80, Math.min(170, y1 - y0 - 16));
        const x = x0 + (b * (x1 - x0)) / count + 8;
        const y = y0 + range(random, 4, Math.max(5, y1 - y0 - h - 8));
        buildings.push({
          x, y, w, h,
          color: pick(random, PALETTE.buildingRoof),
          floors: 1 + Math.floor(random() * 4),
          seed: random(),
        });
      }
      // A few palm trees along the block edge.
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: range(random, x0, x1), y: range(random, y0, y1), r: range(random, 8, 13) });
      }
    }
  }

  // Parked cars along the avenues, on the road edge where a player can steal one.
  const carColors = ['#d94f4f', '#4f7fd9', '#e8e8e8', '#3fae6a', '#e8a13c', '#7a4fd9', '#222831'];
  for (let i = 0; i < 26; i += 1) {
    const avenue = pick(random, ROADS.avenues);
    const street = pick(random, ROADS.streets);
    const along = range(random, street + 90, street + 240);
    parked.push({
      x: avenue + (random() < 0.5 ? -ROADS.lane : ROADS.lane),
      y: Math.min(along, BEACH.sandTop - 80),
      angle: Math.PI / 2,
      color: pick(random, carColors),
      model: pick(random, ['Sedan', 'Coupe', 'Hatch', 'SUV', 'Pickup']),
    });
  }

  return { buildings, trees, parked, districts: DISTRICTS, roadSet };
}

export function isOnRoad(x, y) {
  if (y > BEACH.sandTop) return false;
  for (const a of ROADS.avenues) if (Math.abs(x - a) <= ROADS.width / 2) return true;
  for (const s of ROADS.streets) if (Math.abs(y - s) <= ROADS.width / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  const avenue = nearestRoad(x, ROADS.avenues);
  const street = nearestRoad(y, ROADS.streets);
  return Math.abs(x - avenue) < Math.abs(y - street) ? { x: avenue, y } : { x, y: street };
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.min(WORLD.width - margin, Math.max(margin, x)),
    y: Math.min(WORLD.height - margin, Math.max(margin, y)),
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solmar Bay';
}

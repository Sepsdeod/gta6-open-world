// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, cross
// at the corners, panic and run when shots ring out, and a few of them are
// armed rivals during the dockside mission.
import { BEACH, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';
import { clampToWorld, isOnRoad } from './city.js';

const SHIRTS = ['#e86a6a', '#6aa8e8', '#7ac47a', '#e8c96a', '#c96ad9', '#e8e8e8', '#5ad9c9', '#e89a5a'];
const PANTS = ['#2e3440', '#4a3a2e', '#3a4a6a', '#5a5a5a'];

export function makePed(random, x, y, hostile) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: range(random, 40, 75),
    walkPhase: random() * 6,
    color: pick(random, SHIRTS),
    pants: pick(random, PANTS),
    alive: true,
    panic: 0,
    hostile: !!hostile,
    health: hostile ? 60 : 30,
    shootTimer: range(random, 0.5, 1.5),
    targetX: x,
    targetY: y,
  };
}

export function spawnPeds(random, city, count, nearX, nearY) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    let x;
    let y;
    if (nearX !== undefined) {
      x = nearX + range(random, -600, 600);
      y = nearY + range(random, -400, 400);
    } else {
      x = range(random, 100, WORLD.width - 100);
      y = range(random, 100, BEACH.sandTop - 100);
    }
    const spot = clampToWorld(x, y, 60);
    peds.push(makePed(random, spot.x, spot.y, false));
  }
  return peds;
}

/** Pick a new strolling target: a nearby sidewalk corner. */
function newTarget(ped, random) {
  const avenue = pick(random, ROADS.avenues);
  const street = pick(random, ROADS.streets);
  ped.targetX = avenue + range(random, -60, 60);
  ped.targetY = street + range(random, -60, 60);
}

export function updatePeds(state, dt, random) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    ped.walkPhase += dt * (ped.panic > 0 ? 12 : 6);
    if (ped.panic > 0) ped.panic -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      newTarget(ped, random);
      continue;
    }
    // Fleeing peds run away from the player; strollers walk to their corner.
    let tx = ped.targetX;
    let ty = ped.targetY;
    if (ped.panic > 0) {
      const fx = ped.x - px;
      const fy = ped.y - py;
      const fd = Math.hypot(fx, fy) || 1;
      tx = ped.x + (fx / fd) * 200;
      ty = ped.y + (fy / fd) * 200;
    }
    const ax = tx - ped.x;
    const ay = ty - ped.y;
    const ad = Math.hypot(ax, ay) || 1;
    const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
    ped.x += (ax / ad) * speed * dt;
    ped.y += (ay / ad) * speed * dt;
    ped.angle = Math.atan2(ay, ax);
    const clamped = clampToWorld(ped.x, ped.y, 30);
    ped.x = clamped.x;
    ped.y = Math.min(clamped.y, BEACH.waterTop - 30);
    // Only the player's own car running someone over is the player's crime:
    // the city's traffic hitting a pedestrian is not charged to Mara.
    for (const car of state.cars) {
      if (car.kind !== 'player') continue;
      if (Math.abs(car.speed) < 60) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 30) {
        ped.alive = false;
        state.events |= 128; // ped hit
        addWanted(state, 1);
        break;
      }
    }
  }
  // Keep the streets populated near the player.
  const near = state.peds.filter((p) => p.alive && Math.hypot(p.x - px, p.y - py) < 900).length;
  if (near < 14 && random() < dt * 2) {
    state.peds.push(...spawnPeds(random, state.city, 2, px, py));
  }
  if (state.peds.length > 60) {
    state.peds = state.peds.filter((p) => p.alive || Math.hypot(p.x - px, p.y - py) < 1000).slice(-60);
  }
}

export function addWanted(state, stars) {
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = 0;
}

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.alive && Math.hypot(ped.x - x, ped.y - y) < radius) ped.panic = 3;
  }
}

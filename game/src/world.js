// Solmar Bay's simulation: the player on foot or behind the wheel, the
// traffic, the pedestrians, the police, the bullets and the story, all
// advanced one fixed step at a time. No drawing and no sound here — step()
// returns what happened as bit flags and the caller reacts.
import { BEACH, CAR, PLAYER, STEP, WORLD } from './config.js';
import { buildCity, clampToWorld, PLACES } from './city.js';
import { createRandom, range } from './random.js';
import { ACTION_ENTER, ACTION_SHOOT } from './input.js';
import { drivePlayerCar, makeCar, moveCar, spawnTrafficCar, updatePolice, updateTraffic } from './vehicles.js';
import { addWanted, spawnPeds, updatePeds } from './pedestrians.js';
import { enemyShoot, playerShoot, updateBullets, updateParticles } from './combat.js';
import { updateWanted } from './police.js';
import { currentObjective, startStory, updateMissions } from './missions.js';

export const EVENT_COIN = 1;
export const EVENT_SHOT = 2;
export const EVENT_MISSION = 4;
export const EVENT_STORY = 8;
export const EVENT_WASTED = 16;
export const EVENT_CRASH = 32;
export const EVENT_BUSTED = 256;

function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const state = {
    random, city, seed,
    player: {
      x: PLACES.hideout.x, y: PLACES.hideout.y, angle: -Math.PI / 2,
      health: PLAYER.maxHealth, money: 250, onFoot: true, car: null,
      shootCooldown: 0, hurtCooldown: 0, bustTimer: 0,
    },
    cars: [], peds: [], bullets: [], pickups: [], particles: [],
    wanted: 0, wantedTimer: 0, elapsed: 0,
    missionIndex: 0, missionStep: 0, missionTimer: 0,
    enemiesDown: 0, enemiesTotal: 0, completedMissions: 0, storyDone: false,
    message: '', messageTimer: 0, events: 0,
    stats: { carsStolen: 0, cashFound: 0 },
  };

  function scatterPickups() {
    for (let i = 0; i < 12; i += 1) {
      state.pickups.push({
        x: range(random, 200, WORLD.width - 200),
        y: range(random, 200, BEACH.sandTop - 200),
        kind: 'cash', value: 50 + Math.floor(random() * 3) * 50, taken: false,
      });
    }
    for (let i = 0; i < 4; i += 1) {
      state.pickups.push({
        x: range(random, 200, WORLD.width - 200),
        y: range(random, 200, BEACH.sandTop - 200),
        kind: 'health', value: 40, taken: false,
      });
    }
  }

  function reset() {
    const player = state.player;
    player.x = PLACES.hideout.x;
    player.y = PLACES.hideout.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.maxHealth;
    player.money = 250;
    player.onFoot = true;
    player.car = null;
    player.shootCooldown = 0;
    player.hurtCooldown = 0;
    player.bustTimer = 0;
    state.cars = city.parked.map((p) => makeCar(p.x, p.y, p.angle, p.color, p.model, 'parked'));
    for (let i = 0; i < 16; i += 1) state.cars.push(spawnTrafficCar(random, city));
    state.peds = spawnPeds(random, city, 28);
    state.bullets = [];
    state.pickups = [];
    state.particles = [];
    scatterPickups();
    state.wanted = 0;
    state.wantedTimer = 0;
    state.elapsed = 0;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.enemiesDown = 0;
    state.enemiesTotal = 0;
    state.completedMissions = 0;
    state.storyDone = false;
    state.message = 'Welcome to Solmar Bay. Meet Rico at the Marina.';
    state.messageTimer = 5;
    state.events = 0;
    state.stats = { carsStolen: 0, cashFound: 0 };
    startStory(state);
  }

  function nearestCar(maxDist) {
    const player = state.player;
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      if (car.kind === 'wreck') continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const player = state.player;
    if (!player.onFoot) {
      // Get out: step out beside the car and leave it parked where it stops.
      const car = player.car;
      car.speed = 0;
      car.kind = 'parked';
      player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
      player.onFoot = true;
      player.car = null;
      return;
    }
    const car = nearestCar(80);
    if (!car) return;
    if (car.kind === 'traffic') {
      // Jacking a moving car: the driver bails and the law notices.
      addWanted(state, 1);
      state.stats.carsStolen += 1;
      state.message = `You stole a ${car.model}! The law noticed.`;
      state.messageTimer = 3;
    } else if (car.kind === 'parked') {
      addWanted(state, 1);
      state.stats.carsStolen += 1;
      state.message = `You stole a ${car.model}!`;
      state.messageTimer = 3;
    } else if (car.kind === 'police') {
      addWanted(state, 2);
      state.message = 'You stole a police cruiser!';
      state.messageTimer = 3;
    }
    car.kind = 'player';
    player.car = car;
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
  }

  function movePlayerOnFoot(dt, input) {
    const player = state.player;
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + (dx / len) * speed * dt;
    const ny = player.y + (dy / len) * speed * dt;
    player.angle = Math.atan2(dy, dx);
    if (!circleHitsBuilding(state.city, nx, player.y, PLAYER.radius)) player.x = nx;
    if (!circleHitsBuilding(state.city, player.x, ny, PLAYER.radius)) player.y = ny;
    const clamped = clampToWorld(player.x, player.y, 24);
    player.x = clamped.x;
    player.y = Math.min(clamped.y, BEACH.waterTop - 24);
  }

  function collectPickups() {
    const player = state.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - px, p.y - py) < 34) {
        p.taken = true;
        if (p.kind === 'cash') {
          player.money += p.value;
          state.stats.cashFound += p.value;
          state.message = `Found $${p.value} in street cash.`;
          state.events |= EVENT_COIN;
        } else {
          player.health = Math.min(PLAYER.maxHealth, player.health + p.value);
          state.message = `Picked up a medkit (+${p.value} health).`;
          state.events |= EVENT_COIN;
        }
        state.messageTimer = 2.5;
      }
    }
  }

  /** One fixed step. `actions` is the input bitmask taken this frame. */
  function step(dt, input, actions) {
    state.events = 0;
    state.elapsed += dt;
    const player = state.player;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    if (actions & ACTION_ENTER) enterCar();
    if (actions & ACTION_SHOOT) playerShoot(state);

    if (player.onFoot) {
      movePlayerOnFoot(dt, input);
      // Traffic can run the player down; a touch at speed hurts.
      if (player.hurtCooldown <= 0) {
        for (const car of state.cars) {
          if (car.kind === 'parked' || car.kind === 'wreck') continue;
          if (Math.abs(car.speed) > 80 && Math.hypot(car.x - player.x, car.y - player.y) < 34) {
            player.health -= 25;
            player.hurtCooldown = 1;
            state.events |= EVENT_CRASH;
            break;
          }
        }
      }
      // Busted: a cruiser sits on top of the player while wanted.
      if (state.wanted > 0) {
        const near = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - player.x, c.y - player.y) < 44);
        player.bustTimer = near ? player.bustTimer + dt : 0;
        if (player.bustTimer > 2) {
          state.events |= EVENT_BUSTED;
          return state.events;
        }
      } else player.bustTimer = 0;
    } else if (player.car) {
      const car = player.car;
      const { nx, ny } = drivePlayerCar(car, input, dt);
      const crashed = !moveCar(state.city, car, nx, ny, () => { state.events |= EVENT_CRASH; });
      if (crashed && Math.abs(car.speed) > 200) state.events |= EVENT_CRASH;
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Bump traffic cars out of the way.
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked' || other.kind === 'wreck') continue;
        const d = Math.hypot(other.x - car.x, other.y - car.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / d;
          other.x += (other.x - car.x) * push * 0.5;
          other.y += (other.y - car.y) * push * 0.5;
          other.speed *= 0.6;
          if (Math.abs(car.speed) > 240) state.events |= EVENT_CRASH;
        }
      }
      if (car.health <= 0) {
        car.kind = 'wreck';
        player.onFoot = true;
        player.car = null;
        player.x = car.x + 40;
        player.y = car.y + 40;
        state.message = 'Your car is wrecked!';
        state.messageTimer = 3;
      }
    }

    updateTraffic(state, dt, random);
    updatePolice(state, dt);
    updatePeds(state, dt, random);
    for (const ped of state.peds) {
      if (ped.alive && ped.hostile) enemyShoot(state, ped, dt, random);
    }
    updateBullets(state, dt);
    updateParticles(state, dt);
    updateWanted(state, dt, random);
    collectPickups();
    const missionResult = updateMissions(state, dt);
    if (missionResult === 'mission' || missionResult === 'story') state.events |= EVENT_MISSION;
    if (missionResult === 'story') state.events |= EVENT_STORY;
    if (player.health <= 0) state.events |= EVENT_WASTED;
    return state.events;
  }

  reset();
  return { state, reset, step, objective: () => currentObjective(state) };
}

export { STEP };

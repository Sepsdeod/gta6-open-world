// Cars: the player's driving physics, the traffic that fills the avenues,
// and the police cruisers that chase the player. Traffic cars follow the
// road grid — a lane along one avenue or street, turning at intersections —
// so the streets always feel busy without any pathfinding.
import { BEACH, CAR, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';
import { isOnRoad } from './city.js';

const TRAFFIC_COLORS = ['#d94f4f', '#4f7fd9', '#e8e8e8', '#3fae6a', '#e8a13c', '#7a4fd9', '#222831', '#c96a2e'];
const MODELS = ['Sedan', 'Coupe', 'Hatch', 'SUV', 'Pickup', 'Taxi'];

export function makeCar(x, y, angle, color, model, kind) {
  return {
    x, y, angle, speed: 0, color, model: model || 'Sedan', kind: kind || 'traffic',
    axis: 'v', road: x, dir: 1, cruise: 160, health: 100, siren: false, stuck: 0,
  };
}

export function spawnTrafficCar(random, city, nearX, nearY) {
  const vertical = random() < 0.5;
  const road = vertical ? pick(random, ROADS.avenues) : pick(random, ROADS.streets);
  const along = vertical ? range(random, 100, BEACH.sandTop - 100) : range(random, 100, WORLD.width - 100);
  const dir = random() < 0.5 ? -1 : 1;
  const car = makeCar(
    vertical ? road + dir * ROADS.lane : along,
    vertical ? along : road + dir * ROADS.lane,
    vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    pick(random, TRAFFIC_COLORS),
    pick(random, MODELS),
    'traffic',
  );
  car.axis = vertical ? 'v' : 'h';
  car.road = road;
  car.dir = dir;
  car.cruise = range(random, 120, 220);
  if (nearX !== undefined) {
    // Keep new traffic near the action so the player always sees cars.
    if (vertical) car.y = Math.min(Math.max(nearY + range(random, -500, 500), 80), BEACH.sandTop - 80);
    else car.x = Math.min(Math.max(nearX + range(random, -500, 500), 80), WORLD.width - 80);
  }
  return car;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function hitsBuilding(city, x, y, halfLen, halfWid, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (const b of city.buildings) {
    // Test the car's four corners against the building rectangle.
    for (const [lx, ly] of [[halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid]]) {
      const px = x + lx * cos - ly * sin;
      const py = y + lx * sin + ly * cos;
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) return true;
    }
  }
  return false;
}

/** The player's car: arcade physics — accelerate, brake, reverse, steer. */
export function drivePlayerCar(car, input, dt) {
  const up = input.held.up;
  const down = input.held.down;
  if (up) car.speed += CAR.accel * dt;
  else if (down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed *= Math.pow(0.4, dt);
  if (!up && !down && Math.abs(car.speed) < 4) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steer = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120) * dirSign;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  return { nx, ny };
}

/** Move a car, stopping (with a bump) at buildings, the water and the edge. */
export function moveCar(city, car, nx, ny, onCrash) {
  const blocked = hitsBuilding(city, nx, ny, CAR.length / 2, CAR.width / 2, car.angle)
    || ny > BEACH.waterTop - 10 || nx < 20 || nx > WORLD.width - 20 || ny < 20;
  if (blocked) {
    if (Math.abs(car.speed) > 180 && onCrash) onCrash();
    car.speed *= -0.25;
    return false;
  }
  car.x = nx;
  car.y = ny;
  return true;
}

/** Traffic: cruise along its road, turn at intersections, slow for the car ahead. */
export function updateTraffic(state, dt, random) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    // Slow down if another car is right ahead.
    let ahead = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70 && Math.abs(angleDiff(Math.atan2(dy, dx), car.angle)) < 0.5) { ahead = true; break; }
    }
    const target = ahead ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    // At an intersection, sometimes turn onto the crossing road.
    const onAvenue = ROADS.avenues.some((a) => Math.abs(car.x - a) < 12);
    const onStreet = ROADS.streets.some((s) => Math.abs(car.y - s) < 12);
    if (onAvenue && onStreet && random() < dt * 0.25) {
      if (car.axis === 'v') {
        car.axis = 'h';
        car.road = ROADS.streets.reduce((best, s) => (Math.abs(s - car.y) < Math.abs(best - car.y) ? s : best), ROADS.streets[0]);
        car.dir = random() < 0.5 ? -1 : 1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y = car.road + car.dir * ROADS.lane;
      } else {
        car.axis = 'v';
        car.road = ROADS.avenues.reduce((best, a) => (Math.abs(a - car.x) < Math.abs(best - car.x) ? a : best), ROADS.avenues[0]);
        car.dir = random() < 0.5 ? -1 : 1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = car.road + car.dir * ROADS.lane;
      }
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (isOnRoad(nx, ny) || Math.hypot(nx - player.x, ny - player.y) > 900) {
      car.x = nx;
      car.y = ny;
    } else {
      // Drifted off the grid: snap back onto its road.
      if (car.axis === 'v') car.x = car.road + car.dir * ROADS.lane;
      else car.y = car.road + car.dir * ROADS.lane;
    }
    if (car.x < 40 || car.x > WORLD.width - 40 || car.y < 40 || car.y > BEACH.sandTop - 40) {
      // Recycle a car that drove off the map back near the player.
      const fresh = spawnTrafficCar(random, state.city, player.x, player.y);
      Object.assign(car, fresh);
    }
  }
}

/** Police cruisers: steer straight at the player and ram. */
export function updatePolice(state, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const dx = px - car.x;
    const dy = py - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    const diff = angleDiff(wantAngle, car.angle);
    car.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const top = 300 + state.wanted * 45;
    car.speed = Math.min(top, car.speed + 380 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(state.city, nx, ny, CAR.length / 2, CAR.width / 2, car.angle) && ny < BEACH.waterTop - 10) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.4;
      car.angle += 0.6 * dt * (car.stuck % 2 === 0 ? 1 : -1);
      car.stuck += 1;
    }
    car.siren = dist < 900;
    if (dist < 46) {
      // A ram: hurt the player (or their car) and shove the cruiser back.
      if (player.car) {
        player.car.health -= 14 * dt * 10;
        if (player.car.health <= 0) state.events |= 64; // car wrecked
      } else {
        player.health -= 22 * dt * 10;
      }
      car.speed *= -0.3;
      state.events |= 32; // crash
    }
  }
}

export function spawnPoliceCar(state, random) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const angle = random() * Math.PI * 2;
  const car = makeCar(
    Math.min(Math.max(px + Math.cos(angle) * 700, 80), WORLD.width - 80),
    Math.min(Math.max(py + Math.sin(angle) * 700, 80), BEACH.sandTop - 80),
    angle, '#1c4fd7', 'Cruiser', 'police',
  );
  car.speed = 200;
  state.cars.push(car);
  return car;
}

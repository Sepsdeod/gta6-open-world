// Combat: the player's pistol, rival gangsters who shoot back, bullets,
// and the health that decides wasted vs busted. Bullets are simple points
// with a short life; hits are circle tests against peds, cars and the player.
import { addWanted, scarePeds } from './pedestrians.js';

export const EVENT_SHOT = 2;
export const EVENT_CRASH = 32;
export const EVENT_CAR_WRECKED = 64;
export const EVENT_PED_HIT = 128;
export const EVENT_COIN = 1;

const BULLET_SPEED = 900;
const BULLET_LIFE = 0.7;

export function playerShoot(state) {
  const player = state.player;
  if (!player.onFoot || player.shootCooldown > 0) return;
  player.shootCooldown = 0.28;
  const a = player.angle;
  state.bullets.push({
    x: player.x + Math.cos(a) * 20,
    y: player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    life: BULLET_LIFE,
    fromPlayer: true,
  });
  state.particles.push({ x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: 0, vy: 0, life: 0.08, color: '#ffd24d', size: 6 });
  scarePeds(state, player.x, player.y, 320);
  addWanted(state, 1);
  state.events |= EVENT_SHOT;
}

export function enemyShoot(state, ped, dt, random) {
  ped.shootTimer -= dt;
  if (ped.shootTimer > 0) return;
  ped.shootTimer = 0.9 + random() * 0.8;
  const player = state.player;
  const tx = player.car ? player.car.x : player.x;
  const ty = player.car ? player.car.y : player.y;
  const dist = Math.hypot(tx - ped.x, ty - ped.y);
  if (dist > 520) return;
  const a = Math.atan2(ty - ped.y, tx - ped.x) + (random() - 0.5) * 0.35;
  state.bullets.push({
    x: ped.x + Math.cos(a) * 18, y: ped.y + Math.sin(a) * 18,
    vx: Math.cos(a) * BULLET_SPEED * 0.8, vy: Math.sin(a) * BULLET_SPEED * 0.8,
    life: BULLET_LIFE, fromPlayer: false,
  });
  state.events |= EVENT_SHOT;
}

export function updateBullets(state, dt) {
  const player = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.health -= 34;
          b.life = 0;
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, color: '#ff4d4d', size: 8 });
          if (ped.health <= 0) {
            ped.alive = false;
            if (ped.hostile) state.enemiesDown += 1;
            else addWanted(state, 1);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.health -= 12;
          b.life = 0;
          if (car.health <= 0 && car.kind === 'police') {
            car.kind = 'wreck';
            addWanted(state, 1);
          }
          break;
        }
      }
    } else {
      const tx = player.car ? player.car.x : player.x;
      const ty = player.car ? player.car.y : player.y;
      const r = player.car ? 30 : 15;
      if (Math.hypot(tx - b.x, ty - b.y) < r) {
        b.life = 0;
        if (player.car) player.car.health -= 8;
        else player.health -= 9;
        state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, color: '#ff4d4d', size: 8 });
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

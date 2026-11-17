// The wanted system: stars rise when the player commits crimes and fall
// when the player stays out of trouble. Police cruisers spawn to match the
// stars and give up once the heat is gone.
import { WANTED } from './config.js';
import { spawnPoliceCar } from './vehicles.js';

export function updateWanted(state, dt, random) {
  if (state.wanted === 0) return;
  state.wantedTimer += dt;
  // Heat cools off if no police can see the player for a while.
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  const seen = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - px, c.y - py) < 420);
  if (!seen && state.wantedTimer > WANTED.decaySeconds) {
    state.wanted -= 1;
    state.wantedTimer = 0;
    state.message = state.wanted === 0 ? 'You lost the cops.' : `Wanted level down — ${state.wanted} star${state.wanted === 1 ? '' : 's'}.`;
    state.messageTimer = 3;
  }
  const want = WANTED.copsPerStar[state.wanted];
  const have = state.cars.filter((c) => c.kind === 'police').length;
  if (have < want && random() < dt * 0.8) spawnPoliceCar(state, random);
  if (have > want) {
    // Too many cruisers: the farthest one gives up and drives away.
    let far = null;
    let farDist = -1;
    for (const c of state.cars) {
      if (c.kind !== 'police') continue;
      const d = Math.hypot(c.x - px, c.y - py);
      if (d > farDist) { farDist = d; far = c; }
    }
    if (far) state.cars.splice(state.cars.indexOf(far), 1);
  }
}

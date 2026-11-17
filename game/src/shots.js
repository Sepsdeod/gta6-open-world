// The screenshot scenes behind ?shot=cover|street|mission|title. Each one
// sets up a real game state — the same world, rules and renderer the player
// sees — drives it forward a few seconds with a simple autopilot, then hands
// the frame to the renderer. The same seed always gives the same frame.
import { STEP } from './config.js';
import { MISSIONS, startStory } from './missions.js';
import { PLACES } from './city.js';
import { addWanted } from './pedestrians.js';
import { spawnPoliceCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function driveForward(world, seconds) {
  const input = { held: { up: true, down: false, left: false, right: false, run: false } };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, input, 0);
}

function walkForward(world, seconds) {
  const input = { held: { up: true, down: false, left: false, right: false, run: false } };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, input, 0);
}

/** Cover: a police chase in the gold Comet GT through Downtown, 3 stars. */
function stageCover(world) {
  const state = world.state;
  world.reset();
  state.missionIndex = 1;
  state.missionStep = 1;
  MISSIONS[1].steps[0].setup(state);
  const comet = state.cars.find((c) => c.model === 'Comet GT');
  const player = state.player;
  player.x = 1760;
  player.y = 1040;
  player.angle = 0;
  comet.x = 1760;
  comet.y = 1040;
  comet.angle = 0;
  comet.kind = 'player';
  player.car = comet;
  player.onFoot = false;
  player.money = 2840;
  addWanted(state, 3);
  spawnPoliceCar(state, state.random);
  spawnPoliceCar(state, state.random);
  for (const car of state.cars) if (car.kind === 'police') { car.x = 1760 - 180; car.y = 1040 + (car.y > 1040 ? 40 : -40); }
  driveForward(world, 2.2);
  return { screen: SCREEN_PLAY };
}

/** Street: Mara on foot in Downtown, traffic and pedestrians around her. */
function stageStreet(world) {
  const state = world.state;
  world.reset();
  // On the sidewalk beside the avenue, clear of the traffic lanes.
  state.player.x = 1485;
  state.player.y = 800;
  state.player.angle = 0;
  state.player.money = 1250;
  walkForward(world, 1.2);
  // Staging is a still frame, not a crime spree: no heat, no cruisers.
  state.wanted = 0;
  state.wantedTimer = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.message = 'Downtown Solmar Bay — press E near a car to steal it.';
  state.messageTimer = 4;
  return { screen: SCREEN_PLAY };
}

/** Mission: the Dockside Deal firefight — Cobras, wanted stars, objective. */
function stageMission(world) {
  const state = world.state;
  world.reset();
  state.missionIndex = 3;
  state.missionStep = 1;
  MISSIONS[3].steps[0].setup(state);
  state.player.x = PLACES.docks.x + 120;
  state.player.y = PLACES.docks.y + 40;
  state.player.angle = Math.PI;
  state.player.money = 1980;
  addWanted(state, 2);
  walkForward(world, 0.6);
  state.message = "The Cobras jumped Rico's deal. Take the pier back.";
  state.messageTimer = 5;
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any other name stages the title screen.
 */
export function stageShot(name, world) {
  if (name === 'cover') return stageCover(world);
  if (name === 'street') return stageStreet(world);
  if (name === 'mission') return stageMission(world);
  world.reset();
  return { screen: SCREEN_TITLE };
}

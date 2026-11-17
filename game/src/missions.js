// The story of Solmar Bay: five missions for Mara Voss, a driver new to the
// city who owes a debt and works it off for fixer Rico Delgado. Each mission
// is a list of steps; a step is done by reaching its marker, by a timer, or
// by a condition (a stolen car, rivals down, cash grabbed). Finishing a
// mission pays out and starts the next one; finishing all five ends the story
// and leaves the city open for free roam.
import { PLACES } from './city.js';
import { addWanted, makePed } from './pedestrians.js';
import { makeCar } from './vehicles.js';

function arrive(radius) {
  return (state) => {
    const step = currentStep(state);
    if (!step || !step.target) return false;
    const px = state.player.car ? state.player.car.x : state.player.x;
    const py = state.player.car ? state.player.car.y : state.player.y;
    return Math.hypot(px - step.target.x, py - step.target.y) < radius;
  };
}

export const MISSIONS = [
  {
    id: 'sunrise-courier', title: 'Sunrise Courier', reward: 400,
    brief: 'Rico Delgado needs a package moved across town. No questions, no cops.',
    steps: [
      { text: 'Meet Rico at the Marina', target: PLACES.marina, radius: 70 },
      { text: 'Deliver the package downtown', target: PLACES.downtownDrop, radius: 70 },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 600,
    brief: 'A gold Comet GT is parked in Palm Heights. Take it. Bring it to Lou.',
    steps: [
      {
        text: 'Steal the gold Comet GT in Palm Heights', target: PLACES.cometGT, radius: 90,
        setup(state) {
          if (!state.cars.some((c) => c.model === 'Comet GT')) {
            const comet = makeCar(PLACES.cometGT.x, PLACES.cometGT.y, Math.PI / 2, '#ffd24d', 'Comet GT', 'parked');
            comet.health = 200;
            state.cars.push(comet);
          }
        },
        done(state) { return state.player.car && state.player.car.model === 'Comet GT'; },
      },
      { text: "Drive the Comet GT to Lou's Garage", target: PLACES.garage, radius: 80,
        done(state) { return state.player.car && state.player.car.model === 'Comet GT' && arrive(80)(state); } },
    ],
  },
  {
    id: 'heat-wave', title: 'Heat Wave', reward: 500,
    brief: 'The job went loud. Lose the Solmar PD — survive the heat, then vanish.',
    steps: [
      {
        text: 'Survive the police heat — stay alive', target: null, radius: 0,
        setup(state) { addWanted(state, 3); state.missionTimer = 45; },
        done(state) { return state.missionTimer <= 0; },
      },
      { text: 'Shake the cops — reach the hideout', target: PLACES.hideout, radius: 80,
        done(state) { return state.wanted === 0 && arrive(80)(state); } },
    ],
  },
  {
    id: 'dockside-deal', title: 'Dockside Deal', reward: 900,
    brief: 'The Cobras jumped Rico\'s deal at the docks. Take the pier back.',
    steps: [
      {
        text: 'Get to the docks', target: PLACES.docks, radius: 80,
        setup(state) {
          state.enemiesTotal = 5;
          state.enemiesDown = 0;
          for (let i = 0; i < 5; i += 1) {
            state.peds.push(makePed(state.random, PLACES.docks.x + (i - 2) * 60, PLACES.docks.y + (i % 2) * 50 - 25, true));
          }
        },
      },
      { text: 'Deal with the Cobras (0/5)', target: PLACES.docks, radius: 160,
        done(state) { return state.enemiesDown >= state.enemiesTotal; } },
      {
        text: 'Grab the deal cash', target: PLACES.docks, radius: 60,
        setup(state) {
          state.pickups.push({ x: PLACES.docks.x, y: PLACES.docks.y + 60, kind: 'cash', value: 300, taken: false });
        },
        done(state) { return state.pickups.every((p) => p.kind !== 'cash' || p.taken); },
      },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', reward: 2000,
    brief: 'Solmar National Bank. In, grab the vault cash, out — and do not get caught.',
    steps: [
      { text: 'Reach Solmar National Bank', target: PLACES.bank, radius: 80 },
      {
        text: 'Grab the vault cash — hold your ground', target: PLACES.bank, radius: 90,
        setup(state) { addWanted(state, 3); state.missionTimer = 6; },
        done(state) {
          const step = currentStep(state);
          const px = state.player.x;
          const py = state.player.y;
          const inside = step && Math.hypot(px - step.target.x, py - step.target.y) < 90;
          if (!inside) state.missionTimer = 6;
          return state.missionTimer <= 0;
        },
      },
      {
        text: 'Escape to the hideout with the cash', target: PLACES.hideout, radius: 80,
        setup(state) { addWanted(state, 1); state.player.money += 1500; },
        done(state) { return state.wanted === 0 && arrive(80)(state); },
      },
    ],
  },
];

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.missionStep] || null;
}

export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return 'Story complete — free roam Solmar Bay. Find cash, steal cars, stay out of trouble.';
  const step = currentStep(state);
  if (!step) return mission.title;
  if (state.missionIndex === 3 && state.missionStep === 1) {
    return `Deal with the Cobras (${state.enemiesDown}/${state.enemiesTotal})`;
  }
  if (state.missionIndex === 2 && state.missionStep === 0) {
    return `Survive the police heat — ${Math.ceil(state.missionTimer)}s`;
  }
  if (state.missionIndex === 4 && state.missionStep === 1) {
    return `Grab the vault cash — hold your ground (${Math.ceil(state.missionTimer)}s)`;
  }
  return step.text;
}

export function startStory(state) {
  state.missionIndex = 0;
  state.missionStep = 0;
  state.storyDone = false;
  const step = currentStep(state);
  if (step && step.setup) step.setup(state);
}

/** Advance the mission machine one step; returns 'mission' when one completes. */
export function updateMissions(state, dt) {
  const mission = currentMission(state);
  if (!mission) return null;
  if (state.missionTimer > 0) state.missionTimer -= dt;
  const step = currentStep(state);
  if (!step) return null;
  const done = step.done ? step.done(state) : arrive(step.radius || 70)(state);
  if (!done) return null;
  state.missionStep += 1;
  if (state.missionStep >= mission.steps.length) {
    state.player.money += mission.reward;
    state.completedMissions += 1;
    state.message = `${mission.title} complete — +$${mission.reward}`;
    state.messageTimer = 4;
    state.missionIndex += 1;
    state.missionStep = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      state.message = 'STORY COMPLETE — Solmar Bay is yours. Free roam!';
      state.messageTimer = 6;
      return 'story';
    }
    const next = currentStep(state);
    if (next && next.setup) next.setup(state);
    return 'mission';
  }
  const next = currentStep(state);
  if (next && next.setup) next.setup(state);
  return 'step';
}

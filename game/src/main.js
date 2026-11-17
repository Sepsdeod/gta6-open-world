// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// wasted, busted and story-complete screens.
//
// ?seed=N fixes the city and traffic. ?shot=cover|street|mission|title (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_COIN, EVENT_CRASH, EVENT_MISSION, EVENT_SHOT, EVENT_STORY, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}

function applySave(state, data) {
  state.player.money = data.money;
  state.player.health = data.health || 100;
  state.player.x = data.x;
  state.player.y = data.y;
  state.missionIndex = Math.min(data.missionIndex, MISSIONS.length - 1);
  state.completedMissions = data.missionIndex;
  state.missionStep = 0;
  const mission = MISSIONS[state.missionIndex];
  const step = mission && mission.steps[0];
  if (step && step.setup) step.setup(state);
  state.message = `Welcome back, Mara. ${mission ? mission.title : 'Free roam'} continues.`;
  state.messageTimer = 4;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { best: readBest(), saveExists: hasSave(), muted: false };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui, 1.2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let continuePressed = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && !event.repeat) continuePressed = true;
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fromSave) {
    world.reset();
    if (fromSave) {
      const data = loadGame();
      if (data) applySave(world.state, data);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Solmar Bay.');
  }

  function endGame(kind) {
    screen = kind;
    audio.setEngine(0, false);
    audio.setSiren(false);
    if (world.state.completedMissions > best) {
      best = world.state.completedMissions;
      saveBest(best);
    }
    if (kind === SCREEN_WASTED) audio.fail();
    announce(kind === SCREEN_WASTED ? 'Wasted.' : 'Busted.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.state.message = muted ? 'Sound muted (M).' : 'Sound on.';
      world.state.messageTimer = 2;
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      const ok = saveGame(world.state);
      world.state.message = ok ? 'Game saved.' : 'Save failed — storage is off.';
      world.state.messageTimer = 2.5;
    }
    if (screen === SCREEN_TITLE) {
      if (continuePressed && hasSave()) {
        continuePressed = false;
        startGame(true);
      } else if (actions & ACTION_CONFIRM) {
        startGame(false);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setEngine(0, false);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_WASTED || screen === SCREEN_BUSTED)) {
      startGame(false);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_STORY) {
      screen = SCREEN_PLAY;
    }
    return actions;
  }

  function react(events) {
    if (events & EVENT_COIN) audio.pickup();
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION) {
      audio.mission();
      saveGame(world.state);
      if (world.state.completedMissions > best) {
        best = world.state.completedMissions;
        saveBest(best);
      }
    }
    if (events & EVENT_STORY) screen = SCREEN_STORY;
    else if (events & EVENT_WASTED) endGame(SCREEN_WASTED);
    else if (events & EVENT_BUSTED) endGame(SCREEN_BUSTED);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions() || 0;
    if (screen === SCREEN_PLAY) {
      // One-shot actions go to the first step only: a second step in the same
      // frame must not see the same E press and undo the first one.
      let firstStep = true;
      while (accumulator >= STEP) {
        const events = world.step(STEP, input, firstStep ? actions : 0);
        firstStep = false;
        react(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      const player = world.state.player;
      audio.setEngine(player.car ? player.car.speed : 0, !!player.car);
      const policeNear = world.state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - player.x, c.y - player.y) < 700);
      audio.setSiren(policeNear && world.state.wanted > 0);
    } else {
      accumulator = 0;
      audio.setEngine(0, false);
    }
    const ui = { best, saveExists: hasSave(), muted: audio.muted };
    renderer.draw(world.state, screen, ui, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

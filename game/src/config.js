// Solmar Bay — tuning, palette and world constants. Every number the game
// balances on lives here so the other files read like rules, not magic numbers.
export const WORLD = { width: 3200, height: 2400 };

// Streets run on a grid: avenues every 320 px, streets every 300 px.
export const ROADS = {
  avenues: [160, 480, 800, 1120, 1440, 1760, 2080, 2400, 2720, 3040],
  streets: [140, 440, 740, 1040, 1340, 1640, 1940],
  width: 64,
  lane: 15,
};

export const BEACH = { sandTop: 2050, waterTop: 2260 };
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  walkSpeed: 230,
  runSpeed: 330,
  radius: 14,
  maxHealth: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 220,
  maxSpeed: 560,
  maxReverse: 160,
  turnRate: 2.6,
  grip: 0.94,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 26,
  copsPerStar: [0, 2, 3, 4, 6, 8],
};

export const PALETTE = {
  grass: '#7fae62',
  park: '#5d9b4a',
  sand: '#e8d39a',
  water: '#2f7fb8',
  waterDeep: '#1f5f92',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  sidewalk: '#9aa0a8',
  lane: '#e8d44d',
  buildingRoof: ['#b5674e', '#4e7ba6', '#8a6fb0', '#c08a3e', '#5fa08a', '#a65a6e', '#6b7f9e', '#c97b4a'],
  buildingEdge: '#2e2a26',
  windowLit: '#ffd97a',
  windowDark: '#2c3a4a',
  player: '#ffcf3f',
  police: '#1c4fd7',
  taxi: '#f2c230',
  hud: '#101820',
  hudText: '#f4f6f8',
  gold: '#ffd24d',
  danger: '#ff4d4d',
  mission: '#ffe14d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best';

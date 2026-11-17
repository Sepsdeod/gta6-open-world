// Saving: the player's money, story progress and position persist in this
// browser's localStorage. Nothing leaves the machine; a save is a small JSON
// blob, loaded on the title screen's Continue option.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const player = state.player;
    const data = {
      money: player.money,
      missionIndex: state.missionIndex,
      completedMissions: state.completedMissions,
      x: player.x,
      y: player.y,
      health: player.health,
      elapsed: state.elapsed,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

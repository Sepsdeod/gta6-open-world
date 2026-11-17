// Drawing only: the world through a camera that follows the player, the
// HUD (money, health, wanted stars, mission, minimap), and the title,
// pause and end screens. The 1280x720 logical view is scaled to the window.
import { BEACH, CAR, FONT, PALETTE, PLAYER, ROADS, VIEW, WORLD } from './config.js';
import { PLACES, districtAt } from './city.js';
import { currentMission, currentObjective, currentStep } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_STORY = 'story';

const MAP = { x: 16, y: VIEW.height - 166, w: 200, h: 150 };

function angleOf(x, y) { return Math.atan2(y, x); }

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function cameraFor(state) {
    const player = state.player;
    const cx = Math.min(Math.max(player.x - VIEW.width / 2, 0), WORLD.width - VIEW.width);
    const cy = Math.min(Math.max(player.y - VIEW.height / 2, 0), WORLD.height - VIEW.height);
    return { x: cx, y: cy };
  }

  function drawGround(state, cam, time) {
    const { x: cx, y: cy } = cam;
    context.fillStyle = PALETTE.grass;
    context.fillRect(cx, cy, VIEW.width, VIEW.height);
    // Beach and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(cx, Math.max(cy, BEACH.sandTop), VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(cx, Math.max(cy, BEACH.waterTop), VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 8; i += 1) {
      const wy = BEACH.waterTop + 30 + i * 18 + Math.sin(time * 1.4 + i * 2.1) * 4;
      if (wy < cy || wy > cy + VIEW.height) continue;
      context.fillRect(cx, wy, VIEW.width, 3);
    }
    // Park block.
    context.fillStyle = PALETTE.park;
    context.fillRect(1440 + 52, 740 + 52, 320 - 104, 300 - 104);
    // Sidewalks, then asphalt, then lane dashes.
    for (const a of ROADS.avenues) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(a - ROADS.width / 2 - 8, cy, ROADS.width + 16, VIEW.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(a - ROADS.width / 2, cy, ROADS.width, VIEW.height);
    }
    for (const s of ROADS.streets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(cx, s - ROADS.width / 2 - 8, VIEW.width, ROADS.width + 16);
      context.fillStyle = PALETTE.road;
      context.fillRect(cx, s - ROADS.width / 2, VIEW.width, ROADS.width);
    }
    context.fillStyle = PALETTE.lane;
    for (const a of ROADS.avenues) {
      for (let y = Math.floor(cy / 48) * 48; y < cy + VIEW.height; y += 48) {
        context.fillRect(a - 2, y, 4, 24);
      }
    }
    for (const s of ROADS.streets) {
      for (let x = Math.floor(cx / 48) * 48; x < cx + VIEW.width; x += 48) {
        context.fillRect(x, s - 2, 24, 4);
      }
    }
  }

  function drawBuildings(state, cam) {
    for (const b of state.city.buildings) {
      if (b.x > cam.x + VIEW.width || b.x + b.w < cam.x || b.y > cam.y + VIEW.height || b.y + b.h < cam.y) continue;
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      // Windows: a seeded grid, some lit gold.
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const lit = Math.sin(b.seed * 91 + c * 13 + r * 7) > 0.2;
          context.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
          context.fillRect(b.x + 8 + c * ((b.w - 16) / cols), b.y + 8 + r * ((b.h - 16) / rows), 12, 12);
        }
      }
      // Roof label for the bank and the garage.
      if (Math.abs(b.x + b.w / 2 - PLACES.bank.x) < 120 && Math.abs(b.y + b.h / 2 - PLACES.bank.y) < 120) {
        text('BANK', b.x + b.w / 2, b.y + b.h / 2, 20, '#ffffff', 'center', 'middle');
      }
    }
    for (const t of state.city.trees) {
      if (t.x < cam.x || t.x > cam.x + VIEW.width || t.y < cam.y || t.y > cam.y + VIEW.height) continue;
      context.fillStyle = '#3f7a34';
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5a34';
      context.fillRect(t.x - 2, t.y - 2, 4, 4);
    }
  }

  function drawCar(car, time, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 6);
    context.fill();
    context.fillStyle = car.color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    context.fill();
    if (isPlayer) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
      context.stroke();
    }
    context.fillStyle = '#1d2733';
    context.fillRect(-6, -CAR.width / 2 + 3, 14, CAR.width - 6);
    context.fillStyle = '#cfe8ff';
    context.fillRect(CAR.length / 2 - 10, -CAR.width / 2 + 4, 5, CAR.width - 8);
    // Headlights.
    context.fillStyle = '#fff8c0';
    context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 2, 3, 5);
    context.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      context.fillRect(-8, -CAR.width / 2 - 2, 16, 5);
      context.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
      context.fillRect(-8, CAR.width / 2 - 3, 16, 5);
      text('PD', 0, 4, 11, '#ffffff', 'center', 'middle');
    } else if (car.model === 'Taxi') {
      context.fillStyle = '#111111';
      context.fillRect(-8, -5, 16, 10);
      text('TAXI', 0, 4, 8, '#ffd24d', 'center', 'middle');
    }
    if (car.kind === 'wreck') {
      context.fillStyle = 'rgba(20,20,20,0.55)';
      roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
      context.fill();
    }
    context.restore();
  }

  function drawPed(ped, time) {
    if (!ped.alive) {
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.beginPath();
      context.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    context.save();
    context.translate(ped.x, ped.y);
    context.rotate(ped.angle);
    context.fillStyle = ped.pants;
    context.fillRect(-5, -5, 10, 10);
    context.fillStyle = ped.hostile ? '#c22e2e' : ped.color;
    context.beginPath();
    context.arc(2 + bob * 0.3, 0, 8, 0, Math.PI * 2);
    context.fill();
    if (ped.hostile) {
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(20, 0);
      context.stroke();
    }
    context.restore();
  }

  function drawMissionMarker(state, time) {
    const step = currentStep(state);
    if (!step || !step.target) return;
    const t = step.target;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    context.save();
    context.globalAlpha = 0.25;
    context.fillStyle = PALETTE.mission;
    context.fillRect(t.x - 26, t.y - 120, 52, 120);
    context.restore();
    context.save();
    context.translate(t.x, t.y);
    context.rotate(Math.PI / 4);
    context.scale(pulse, pulse);
    context.fillStyle = PALETTE.mission;
    context.strokeStyle = '#111';
    context.lineWidth = 3;
    context.fillRect(-14, -14, 28, 28);
    context.strokeRect(-14, -14, 28, 28);
    context.restore();
    context.fillStyle = '#111';
    context.beginPath();
    context.arc(t.x, t.y, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawWorld(state, time) {
    const cam = cameraFor(state);
    context.save();
    context.translate(-cam.x, -cam.y);
    drawGround(state, cam, time);
    drawBuildings(state, cam);
    // Cash and health pickups.
    for (const p of state.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(time * 3 + p.x) * 3;
      if (p.kind === 'cash') {
        context.fillStyle = '#2fae4e';
        context.fillRect(p.x - 10, p.y - 6 + bob, 20, 12);
        text('$', p.x, p.y + 4 + bob, 12, '#ffffff', 'center', 'middle');
      } else {
        context.fillStyle = '#ffffff';
        context.fillRect(p.x - 9, p.y - 9 + bob, 18, 18);
        context.fillStyle = '#e33';
        context.fillRect(p.x - 2, p.y - 7 + bob, 4, 14);
        context.fillRect(p.x - 7, p.y - 2 + bob, 14, 4);
      }
    }
    drawMissionMarker(state, time);
    for (const car of state.cars) drawCar(car, time, car.kind === 'player');
    for (const ped of state.peds) drawPed(ped, time);
    // The player on foot.
    const player = state.player;
    if (player.onFoot) {
      const bob = Math.sin(time * 8) * 1.5;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(player.x, player.y + 10, 12, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.save();
      context.translate(player.x, player.y + bob * 0.2);
      context.rotate(player.angle);
      context.fillStyle = '#2e3440';
      context.fillRect(-8, -7, 16, 14);
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(2, 0, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#222';
      context.fillRect(8, -2, 12, 4);
      context.restore();
      // Direction ring.
      context.strokeStyle = 'rgba(255,210,77,0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, 20, 0, Math.PI * 2);
      context.stroke();
    }
    // Bullets and particles.
    for (const b of state.bullets) {
      context.fillStyle = '#ffe14d';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life * 4);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size || 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    context.restore();
    return cam;
  }

  function drawMinimap(state, cam) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.save();
    context.fillStyle = 'rgba(10,16,24,0.85)';
    roundRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 8);
    context.fill();
    context.beginPath();
    roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 4);
    context.clip();
    context.fillStyle = '#4a7a3a';
    context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    context.fillStyle = '#2f7fb8';
    context.fillRect(MAP.x, MAP.y + BEACH.waterTop * sy, MAP.w, MAP.h);
    context.strokeStyle = '#c8ccd2';
    context.lineWidth = 2;
    for (const a of ROADS.avenues) {
      context.beginPath();
      context.moveTo(MAP.x + a * sx, MAP.y);
      context.lineTo(MAP.x + a * sx, MAP.y + MAP.h);
      context.stroke();
    }
    for (const s of ROADS.streets) {
      context.beginPath();
      context.moveTo(MAP.x, MAP.y + s * sy);
      context.lineTo(MAP.x + MAP.w, MAP.y + s * sy);
      context.stroke();
    }
    const step = currentStep(state);
    if (step && step.target) {
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(MAP.x + step.target.x * sx, MAP.y + step.target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') {
        context.fillStyle = '#ff4d4d';
        context.fillRect(MAP.x + car.x * sx - 2, MAP.y + car.y * sy - 2, 4, 4);
      }
    }
    const player = state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MAP.x + player.x * sx, MAP.y + player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(MAP.x + player.x * sx, MAP.y + player.y * sy, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
    text('SOLMAR BAY', MAP.x + 2, MAP.y + MAP.h + 18, 12, 'rgba(255,255,255,0.75)', 'left');
  }

  function drawHud(state, time, ui) {
    const player = state.player;
    // Top-left: cash and health.
    context.fillStyle = 'rgba(10,16,24,0.8)';
    roundRect(14, 12, 230, 64, 8);
    context.fill();
    text(`$${player.money.toLocaleString('en-US')}`, 28, 38, 24, '#7dff8a', 'left');
    text(player.car ? `${player.car.model}  ${Math.abs(Math.round(player.car.speed * 0.12))} mph` : 'On foot', 28, 62, 14, '#cfd6dd', 'left');
    context.fillStyle = '#333';
    context.fillRect(150, 24, 80, 12);
    context.fillStyle = player.health > 30 ? '#4ade80' : '#ff4d4d';
    context.fillRect(150, 24, 80 * (player.health / PLAYER.maxHealth), 12);
    // Top-right: wanted stars.
    context.fillStyle = 'rgba(10,16,24,0.8)';
    roundRect(VIEW.width - 214, 12, 200, 44, 8);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 196 + i * 36, 44, 28, i < state.wanted ? '#ffd24d' : 'rgba(255,255,255,0.25)', 'left');
    }
    // Mission banner, top centre.
    const mission = currentMission(state);
    context.fillStyle = 'rgba(10,16,24,0.8)';
    roundRect(VIEW.width / 2 - 260, 12, 520, 64, 8);
    context.fill();
    text(mission ? mission.title.toUpperCase() : 'FREE ROAM', VIEW.width / 2, 34, 16, PALETTE.gold, 'center');
    text(currentObjective(state), VIEW.width / 2, 60, 15, '#f4f6f8', 'center');
    // District + clock line under the banner.
    text(`${districtAt(player.x, player.y)}  •  ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}  •  Missions ${state.completedMissions}/5`, VIEW.width / 2, 92, 13, 'rgba(255,255,255,0.8)', 'center');
    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = 'rgba(10,16,24,0.85)';
      const w = Math.min(640, 24 + state.message.length * 8.4);
      roundRect(VIEW.width / 2 - w / 2, VIEW.height - 96, w, 34, 8);
      context.fill();
      text(state.message, VIEW.width / 2, VIEW.height - 72, 15, '#ffffff', 'center');
    }
    // Controls hint.
    text('WASD move/drive  •  E enter/exit car  •  SPACE shoot  •  SHIFT run  •  P pause  •  Q save  •  M mute', VIEW.width / 2, VIEW.height - 14, 12, 'rgba(255,255,255,0.65)', 'center');
    if (player.car) {
      text('E — exit car', VIEW.width - 20, VIEW.height - 190, 13, '#ffffff', 'right');
    } else {
      text('E — enter car (near one)', VIEW.width - 20, VIEW.height - 190, 13, '#ffffff', 'right');
    }
    if (ui.muted) text('MUTED (M)', VIEW.width - 20, 100, 13, '#ff9d9d', 'right');
    drawMinimap(state);
    // Off-screen mission arrow: point at the target from the screen edge.
    const step = currentStep(state);
    if (step && step.target) {
      const cam = cameraFor(state);
      const tx = step.target.x - cam.x;
      const ty = step.target.y - cam.y;
      if (tx < 0 || tx > VIEW.width || ty < 0 || ty > VIEW.height) {
        const cx = VIEW.width / 2;
        const cy = VIEW.height / 2;
        const a = angleOf(tx - cx, ty - cy);
        const ax = cx + Math.cos(a) * 300;
        const ay = cy + Math.sin(a) * 240;
        context.save();
        context.translate(ax, ay);
        context.rotate(a);
        context.fillStyle = PALETTE.mission;
        context.beginPath();
        context.moveTo(16, 0);
        context.lineTo(-10, -10);
        context.lineTo(-10, 10);
        context.closePath();
        context.fill();
        context.restore();
        text(`${Math.round(Math.hypot(tx - cx, ty - cy) / 10) * 10}m`, ax, ay + 26, 13, PALETTE.mission, 'center');
      }
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(8,12,18,0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = '#141c26';
    roundRect(x, y, width, height, 12);
    context.fill();
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 12);
    context.stroke();
    text(title, VIEW.width / 2, y + 64, 44, accent || PALETTE.gold, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 108 + i * 32, 18, '#dfe6ec', 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 26, 18, PALETTE.gold, 'center');
  }

  function drawTitle(state, ui) {
    drawWorld(state, 1.2);
    context.fillStyle = 'rgba(8,14,22,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR BAY', VIEW.width / 2, 190, 84, '#ffd24d', 'center');
    text('A SUN-SOAKED CRIME STORY  •  AN ORIGINAL OPEN WORLD', VIEW.width / 2, 232, 18, '#ffffff', 'center');
    const lines = [
      'Mara Voss owes a debt in a city that never sleeps. Drive it, steal it,',
      'outrun it — five missions from the Marina to the Big Score.',
      '',
      'WASD move / drive    E enter & steal cars    SPACE shoot    SHIFT run',
      'P pause    Q save    M mute',
      '',
      ui.saveExists ? 'A saved game is waiting — press C to continue it.' : `Best story progress: ${ui.best} / 5 missions`,
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, 300 + i * 30, 18, i === 6 ? PALETTE.gold : '#e8edf2', 'center');
    }
    text('Press ENTER to start a new story', VIEW.width / 2, 560, 22, '#7dff8a', 'center');
    text('An original game. No part of any commercial game is used.', VIEW.width / 2, VIEW.height - 24, 13, 'rgba(255,255,255,0.6)', 'center');
  }

  /** Paint one frame: the world, then the HUD or a screen panel. */
  function draw(state, screen, ui, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e141c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawWorld(state, time);
    drawHud(state, time, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [`${currentMission(state) ? currentMission(state).title : 'Free roam'} — ${currentObjective(state)}`, `Cash $${state.player.money.toLocaleString('en-US')}  •  Missions ${state.completedMissions}/5`], 'Press P to resume  •  Q to save');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Mara went down in the streets of Solmar Bay.', `Cash kept: $${state.player.money.toLocaleString('en-US')}  •  Missions ${state.completedMissions}/5`], 'Press ENTER to try again', '#ff4d4d');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar PD caught up with Mara.', `Cash kept: $${state.player.money.toLocaleString('en-US')}  •  Missions ${state.completedMissions}/5`], 'Press ENTER to try again', '#4f7fd9');
    } else if (screen === SCREEN_STORY) {
      drawPanel('STORY COMPLETE', ['All five missions done. Solmar Bay is yours, Mara.', `Final cash: $${state.player.money.toLocaleString('en-US')}`], 'Press ENTER to keep playing in free roam', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

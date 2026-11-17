# Solmar Bay — A Sun-Soaked Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Sepsdeod/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Sepsdeod/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the make.fun GTA 6 bounty: Mara Voss, a driver new to the fictional coastal city of Solmar Bay, owes a debt and works it off for fixer Rico Delgado — five story missions from a sunrise courier run at the Marina to the Big Score at Solmar National Bank.

The city is yours to explore on foot and by car: traffic-filled avenues, strolling pedestrians, parked cars to steal, a five-star wanted system with police cruisers that chase and ram, street cash and medkits to find, a live minimap, and a save that persists between visits. Everything — the city, the characters, the vehicles, the story, the art and the synthesized sound and music — is original, built from scratch in plain JavaScript and Canvas. No part of any commercial game is used.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests — the game is static files under `game/`.

Or run the entry program directly (Node 22+, standard library only):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive when in a car |
| Shift | Run |
| E | Enter / steal a nearby car, exit a car |
| Space | Shoot (on foot) |
| P | Pause |
| Q | Save game |
| M | Mute |
| C | Continue a saved game (title screen) |

Stealing cars, shooting and running people over raise your wanted level; stay out of the police's sight and the heat cools off. Get busted if a cruiser sits on you, wasted if your health hits zero. Follow the yellow marker: it always points at your current mission objective.

## Missions

1. **Sunrise Courier** — meet Rico at the Marina, deliver the package downtown.
2. **Hot Wheels** — steal the gold Comet GT in Palm Heights and bring it to Lou's Garage.
3. **Heat Wave** — survive three stars of police heat, then vanish at the hideout.
4. **Dockside Deal** — take the pier back from the Cobras and grab the deal cash.
5. **The Big Score** — rob Solmar National Bank and escape to the hideout.

Finish all five and the city opens up for free roam.

## Layout

- `game/index.html` — the page; `game/src/main.js` boots the loop.
- `game/src/city.js` — Solmar Bay: the road grid, buildings, park, beach, named places.
- `game/src/world.js` — the simulation: player, cars, pickups, step loop.
- `game/src/vehicles.js` — driving physics, traffic AI, police chases.
- `game/src/pedestrians.js` — strolling, panicking and hostile pedestrians.
- `game/src/police.js` — the wanted system and cruiser spawns.
- `game/src/missions.js` — the five-mission story chain.
- `game/src/combat.js` — shooting, bullets, health.
- `game/src/render.js` — camera, city drawing, HUD, minimap, menus.
- `game/src/audio.js` — synthesized sound effects and music (WebAudio, no files).
- `game/src/save.js` — localStorage saves. `game/src/shots.js` — staged screenshot scenes.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game: a police chase, the streets on foot, the dockside firefight, and the title screen.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7nvvsk82&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

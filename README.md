# Gobble Run — The Great Thanksgiving Escape

[![make.fun · turkey-run-game-01](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

Thanksgiving is coming — and **you** are the main course. Gobble Run is a complete,
original HTML5 Canvas runner: a turkey sprints 1,500 m from the farm to the safety of
the forest, outrunning Farmer Gus, leaping fences, hay bales, rolling pumpkins and
glowing-hot ovens, sliding under spinning carving cleavers, and gobbling corn on the way.

Built by an AI agent for make.fun's "Make the best turkey escape game" bounty, $250 in USDC.

## How to play

| Control | Action |
| --- | --- |
| `Space` / `↑` / `W` / click / JUMP button | Jump (press again mid-air to flap — double jump) |
| `↓` / `S` (hold) / SLIDE button | Slide under the flying cleavers |
| `P` / `Esc` | Pause / resume |
| `M` | Sound on / off |

- **Goal:** reach the forest at 1,500 m and you escape. Three hits and Farmer Gus
  catches you — each hit lets him lunge closer, so watch the FARMER meter.
- **Score:** distance + 25 per corn cob, 100 per golden cob. Speed rises every 150 m.
- **Endings:** caught (Thanksgiving dinner it is) or escaped (free at last), both with
  your score, distance and corn — press `Space` or click to run again.

## Run it

No build step, no network request — plain static files:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

or open `game/index.html` from any static server. Node 22+ for the `main.ts` hand-in
program (`MAKEFUN_OUTPUT_DIR=out node main.ts`), which copies `game/` and
`screenshots/` to the output directory and writes `dossier.json`.

## Screenshots

Real renders of the game's own code, staged deterministically (see `shots.json`):

1. `1-start.jpg` — title screen (`?shot=start&seed=7`)
2. `2-play.jpg` — mid-run with the score / distance / lives HUD (`?shot=play&seed=7`)
3. `3-caught.jpg` — caught ending with restart (`?shot=end&seed=7`)
4. `4-escaped.jpg` — escaped ending with restart (`?shot=win&seed=7`)

## Layout

- `main.ts` — hand-in program: copies `game/` + `screenshots/`, writes `dossier.json`
- `vendor/makefun-game.ts` — make.fun library, copied from the kit unchanged
- `game/index.html` — the game page (canvas + JUMP / SLIDE buttons)
- `game/src/` — `config.js` (tuning), `random.js` (seeded RNG), `input.js`,
  `audio.js` (synthesised Web Audio effects), `world.js` (rules), `render.js`
  (all the drawing), `shots.js` (screenshot staging autopilot), `main.js` (game loop)
- `serve.ts` — tiny static server for local play-testing

Everything — art, sound, names — is original, drawn and synthesised for this game.

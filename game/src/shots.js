// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by an autopilot that jumps the
// ground obstacles and slides under the flying cleavers, so the frame is what a real game
// looks like and the same seed always gives the same frame. The sloppy pilot jumps late
// and never slides, so it gets caught, as a hurried player is; the good pilot runs all
// the way to the forest for the escape scene.
import { FIELD, GOAL_METRES, STEP, TURKEY } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import {
  SCREEN_OVER_CAUGHT, SCREEN_OVER_ESCAPED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 600;

/**
 * The autopilot's decisions for one step: jump (one-shot) and slide (held). It looks at
 * every obstacle ahead, not just the nearest: while the turkey is clearing one obstacle
 * the next one is already the threat, and a jump planned for the first must not leave
 * the turkey landing on the second.
 */
export function autopilot(state, skill) {
  const player = state.player;
  const front = player.x + player.width;
  const ahead = [];
  for (const o of state.obstacles) {
    if (!o.active) continue;
    if (o.x + o.width < player.x - 20) continue;
    const gap = o.x - front;
    if (gap > 620) continue;
    ahead.push({ o, gap });
  }
  if (ahead.length === 0) return { jump: false, slide: false };

  // Ground obstacles: jump when one is close, or flap again mid-air when the
  // predicted feet at the moment of clearing an obstacle would still be inside it.
  // (Knives are never jumped into: rising through the blade's band is worse.)
  const grounds = ahead.filter((c) => c.o.kind !== 'knife');
  const knives = ahead.filter((c) => c.o.kind === 'knife');
  const late = skill === 'sloppy' ? 55 : state.speed * 0.27;
  if (player.onGround) {
    // A jump that is due beats a slide: sliding into a fence helps nobody.
    for (const { gap } of grounds) {
      if (gap < late && gap > -20) return { jump: true, slide: false };
    }
    // Flying cleavers: slide under the nearest one. The sloppy pilot never slides.
    if (skill !== 'sloppy' && knives.length > 0) {
      const knife = knives.reduce((a, b) => (a.gap < b.gap ? a : b));
      if (knife.gap < 300) return { jump: false, slide: true };
    }
    return { jump: false, slide: false };
  }
  // Airborne: pre-arm the slide when falling toward the ground with a knife ahead,
  // so the slide is already down on the very frame it lands.
  if (skill !== 'sloppy' && knives.length > 0 && player.vy > 400) {
    const knife = knives.reduce((a, b) => (a.gap < b.gap ? a : b));
    if (knife.gap < 260) return { jump: false, slide: true };
  }
  if (player.jumps < 2) {
    for (const { o } of grounds) {
      const tPass = (o.x + o.width - front) / state.speed;
      if (tPass <= 0 || tPass >= 0.6) continue;
      const futureBottom = player.y + player.height + player.vy * tPass + 1300 * tPass * tPass;
      const top = FIELD.groundY - o.height * 0.92;
      if (futureBottom > top - 12) return { jump: true, slide: false };
    }
  }
  return { jump: false, slide: false };
}

function runPilot(world, skill, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const decision = autopilot(world.state, skill);
    const events = world.step(STEP, decision.jump, decision.slide, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, false, false, true);
    world.state.player.invulnerable = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    runPilot(world, 'good', PLAY_SECONDS);
    // Never stage a frame where the turkey is blink-hidden from a recent hit.
    world.state.player.invulnerable = 0;
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER_CAUGHT : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    runPilot(world, 'good', LIMIT_SECONDS);
    world.state.player.invulnerable = 0;
    const won = world.state.won;
    return { screen: won ? SCREEN_OVER_ESCAPED : SCREEN_PLAY, best: world.state.score };
  }
  // end: the sloppy pilot gets caught.
  runPilot(world, 'sloppy', LIMIT_SECONDS);
  world.state.player.invulnerable = 0;
  return { screen: SCREEN_OVER_CAUGHT, best: world.state.score };
}

export const SHOT_GOAL_METRES = GOAL_METRES;
export const SHOT_TURKEY = TURKEY;
export const SHOT_FIELD = FIELD;

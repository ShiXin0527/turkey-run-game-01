// The game's rules and state, with no drawing and no browser in it: the turkey's run,
// the farmer closing in behind, ovens / fences / hay bales / pumpkins / flying knives,
// corn to collect, score, distance, lives and the escape at 1500 m. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.

import {
  CORN, FIELD, GOAL_METRES, LIVES, OBSTACLES, POOL_CORN, POOL_OBSTACLES,
  POOL_PARTICLES, PX_PER_METRE, SPAWN, SPEED, TURKEY,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_LAND = 16;

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createWorld(random) {
  const player = {
    x: TURKEY.x, y: FIELD.groundY - TURKEY.height, width: TURKEY.width, height: TURKEY.height,
    vy: 0, jumps: 0, onGround: true, slideTimer: 0, invulnerable: 0,
  };
  const obstacles = [];
  for (let i = 0; i < POOL_OBSTACLES; i += 1) {
    obstacles.push({ active: false, kind: 'fence', x: 0, y: 0, width: 0, height: 0, spin: 0, smokeTimer: 0 });
  }
  const corns = [];
  for (let i = 0; i < POOL_CORN; i += 1) {
    corns.push({ active: false, golden: false, x: 0, y: 0, size: CORN.size, bob: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL_PARTICLES; i += 1) {
    particles.push({ active: false, kind: 'dust', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, color: '#ffffff' });
  }
  const state = {
    player, obstacles, corns, particles,
    score: 0, lives: LIVES, level: 1, elapsed: 0, distance: 0, metres: 0,
    speed: SPEED.start, cornCount: 0, farmerGap: 170, dustTimer: 0,
    nextSpawnAt: 620, won: false, over: false,
  };

  function reset() {
    player.y = FIELD.groundY - player.height;
    player.vy = 0;
    player.jumps = 0;
    player.onGround = true;
    player.slideTimer = 0;
    player.invulnerable = 0;
    for (const o of obstacles) o.active = false;
    for (const c of corns) c.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.distance = 0;
    state.metres = 0;
    state.speed = SPEED.start;
    state.cornCount = 0;
    state.farmerGap = 170;
    state.dustTimer = 0;
    state.nextSpawnAt = 620;
    state.won = false;
    state.over = false;
  }

  function freeObstacle() {
    for (const o of obstacles) if (!o.active) return o;
    return null;
  }
  function freeCorn() {
    for (const c of corns) if (!c.active) return c;
    return null;
  }
  function spawnParticle(kind, x, y, vx, vy, life, size, color) {
    for (const p of particles) {
      if (p.active) continue;
      p.active = true;
      p.kind = kind;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size; p.color = color;
      return;
    }
  }
  function featherBurst(x, y) {
    const colors = ['#b5541e', '#d2691e', '#e8a33c', '#8a5a2e', '#fff6e5'];
    for (let i = 0; i < 14; i += 1) {
      spawnParticle('feather', x, y, (random() - 0.5) * 360, -random() * 260 - 40,
        0.9 + random() * 0.5, 5 + random() * 5, colors[i % colors.length]);
    }
  }
  function dustPuff() {
    spawnParticle('dust', player.x + 8, FIELD.groundY - 4, -60 - random() * 60, -20 - random() * 40,
      0.5, 6 + random() * 5, 'rgba(214, 186, 150, 0.7)');
  }
  function sparkle(x, y, golden) {
    for (let i = 0; i < 6; i += 1) {
      spawnParticle('spark', x, y, (random() - 0.5) * 200, (random() - 0.5) * 200,
        0.4, 3 + random() * 3, golden ? '#ffd700' : '#ffe98a');
    }
  }

  function placeObstacle(kind, x) {
    const def = OBSTACLES[kind];
    const o = freeObstacle();
    if (!o || !def) return null;
    o.active = true;
    o.kind = kind;
    o.width = def.width;
    o.height = def.height;
    o.x = x;
    o.y = kind === 'knife' ? def.flyY : FIELD.groundY - def.height;
    o.spin = random() * Math.PI * 2;
    o.smokeTimer = 0;
    return o;
  }

  function placeCorn(x, y, golden) {
    const c = freeCorn();
    if (!c) return;
    c.active = true;
    c.golden = !!golden;
    c.x = x;
    c.y = y;
    c.bob = random() * Math.PI * 2;
  }

  function cornArc(cx, topY) {
    // A 5-cob arc over an obstacle: jump through it to collect.
    const dx = [-72, -36, 0, 36, 72];
    const dy = [34, 6, 0, 6, 34];
    for (let i = 0; i < 5; i += 1) placeCorn(cx + dx[i], topY + dy[i], false);
  }

  function spawnPattern() {
    const x = FIELD.width + 60 + random() * 120;
    const m = state.metres;
    const roll = random();
    if (roll < 0.30) {
      // Single ground obstacle, with a corn arc over it half the time.
      const kinds = m < 120 ? ['fence', 'hay', 'pumpkin'] : ['fence', 'hay', 'pumpkin', 'oven', 'oven'];
      const kind = kinds[Math.floor(random() * kinds.length)];
      const o = placeObstacle(kind, x);
      if (o && random() < 0.6) cornArc(o.x + o.width / 2, FIELD.groundY - o.height - 150);
    } else if (roll < 0.48) {
      // Flying cleaver: slide under it.
      placeObstacle('knife', x);
      if (random() < 0.5) {
        for (let i = 0; i < 4; i += 1) placeCorn(x + 120 + i * 44, FIELD.groundY - 46, false);
      }
    } else if (roll < 0.64) {
      // Ground obstacle, then a knife behind it: jump, land, slide.
      const kinds = m < 120 ? ['fence', 'hay'] : ['fence', 'hay', 'pumpkin', 'oven'];
      const kind = kinds[Math.floor(random() * kinds.length)];
      placeObstacle(kind, x);
      placeObstacle('knife', x + 300 + random() * 80);
    } else if (roll < 0.82) {
      // A row of corn on the ground, sometimes with a golden cob.
      const golden = random() < 0.16;
      for (let i = 0; i < 5; i += 1) placeCorn(x + i * 46, FIELD.groundY - 44, golden && i === 2);
    } else {
      // Two ground obstacles in a row, spaced for a double jump.
      placeObstacle('hay', x);
      placeObstacle('fence', x + 240 + random() * 60);
      if (random() < 0.5) cornArc(x + 120, FIELD.groundY - 220);
    }
  }

  function playerBox() {
    // The box follows the turkey: up in the air when jumping, low and short when sliding.
    const sliding = player.slideTimer > 0;
    const h = sliding ? TURKEY.slideHeight : TURKEY.height;
    const y = sliding ? FIELD.groundY - h : player.y;
    return { x: player.x + 8, y, w: player.width - 16, h };
  }

  /**
   * One fixed step. `jump` is a one-shot press, `slideHeld` is held down.
   * With `harmless` set (the title screen's backdrop) the world scrolls and things
   * spawn, but nothing touches the player and nothing scores.
   */
  function step(dt, jump, slideHeld, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.metres = state.distance / PX_PER_METRE;
    state.level = 1 + Math.floor(state.metres / 150);
    state.speed = Math.min(SPEED.max, SPEED.start + SPEED.per150m * Math.floor(state.metres / 150));
    const scroll = state.speed * dt;
    state.distance += scroll;

    // --- turkey physics ---
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.slideTimer > 0) player.slideTimer = Math.max(0, player.slideTimer - dt);
    if (jump) {
      if (player.jumps < TURKEY.maxJumps) {
        player.vy = player.jumps === 0 ? TURKEY.jumpV : TURKEY.doubleJumpV;
        player.jumps += 1;
        player.onGround = false;
        player.slideTimer = 0;
      }
    }
    if (slideHeld && player.onGround) player.slideTimer = TURKEY.slideTime;
    if (!player.onGround || player.vy !== 0) {
      player.vy += TURKEY.gravity * dt;
      player.y += player.vy * dt;
      if (player.y >= FIELD.groundY - player.height) {
        player.y = FIELD.groundY - player.height;
        if (!player.onGround && player.vy > 500) events |= EVENT_LAND;
        player.vy = 0;
        player.jumps = 0;
        player.onGround = true;
      }
    }

    // --- spawning ---
    if (state.distance >= state.nextSpawnAt) {
      spawnPattern();
      const gap = SPAWN.gapMin + random() * (SPAWN.gapMax - SPAWN.gapMin);
      state.nextSpawnAt = state.distance + gap + state.speed * 0.45;
    }

    // --- obstacles scroll, spin, smoke; collisions ---
    const box = playerBox();
    for (const o of obstacles) {
      if (!o.active) continue;
      o.x -= scroll + (o.kind === 'pumpkin' ? OBSTACLES.pumpkin.roll * dt : 0);
      if (o.kind === 'knife') o.spin += dt * 7;
      if (o.kind === 'oven') {
        o.smokeTimer -= dt;
        if (o.smokeTimer <= 0 && o.x < FIELD.width + 40) {
          o.smokeTimer = 0.28;
          spawnParticle('smoke', o.x + o.width / 2, o.y - 6, -30, -70 - random() * 30,
            1.1, 7 + random() * 5, 'rgba(120, 110, 105, 0.55)');
        }
      }
      if (o.x + o.width < -160) {
        o.active = false;
        continue;
      }
      if (harmless) continue;
      // Forgiving hitbox: shrink each side a little.
      const ox = o.x + o.width * 0.08;
      const oy = o.y + o.height * 0.08;
      const ow = o.width * 0.84;
      const oh = o.height * 0.84;
      if (!overlaps(box.x, box.y, box.w, box.h, ox, oy, ow, oh)) continue;
      if (player.invulnerable > 0) continue;
      o.active = false;
      state.lives -= 1;
      player.invulnerable = TURKEY.invulnerable;
      state.farmerGap = Math.max(30, state.farmerGap - 55);
      featherBurst(player.x + player.width / 2, player.y + 20);
      events |= EVENT_HIT;
      if (state.lives <= 0) {
        state.over = true;
        events |= EVENT_OVER;
        break;
      }
    }

    // --- corn scrolls and gets collected ---
    for (const c of corns) {
      if (!c.active) continue;
      c.x -= scroll;
      c.bob += dt * 4;
      if (c.x + c.size < -40) {
        c.active = false;
        continue;
      }
      if (harmless) continue;
      const cy = c.y + Math.sin(c.bob) * 3;
      if (overlaps(box.x, box.y, box.w, box.h, c.x, cy, c.size, c.size)) {
        c.active = false;
        state.cornCount += 1;
        state.score += c.golden ? CORN.goldenPoints : CORN.points;
        sparkle(c.x + c.size / 2, cy + c.size / 2, c.golden);
        events |= EVENT_CORN;
      }
    }

    // --- running dust, farmer recovery, particles ---
    if (player.onGround && !harmless) {
      state.dustTimer -= dt;
      if (state.dustTimer <= 0) {
        state.dustTimer = 0.14;
        dustPuff();
      }
    }
    if (!state.over && !state.won) {
      state.farmerGap = Math.min(170, state.farmerGap + 9 * dt);
    }
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'feather') {
        p.vy += 300 * dt;
        p.vx *= 0.98;
      } else if (p.kind === 'smoke') {
        p.vy -= 12 * dt;
        p.size += 6 * dt;
      } else if (p.kind === 'dust') {
        p.vy -= 20 * dt;
      }
    }

    // --- score from distance, and the win ---
    if (!harmless && !state.over) {
      state.score += Math.round(scroll * 0.12);
      if (state.metres >= GOAL_METRES && !state.won) {
        state.won = true;
        events |= EVENT_WIN;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}

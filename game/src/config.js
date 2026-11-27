// Gobble Run — The Great Thanksgiving Escape: every tuning number and colour in one
// place. The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundY: 600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres of running that win the game: reach the forest and the turkey is free. */
export const GOAL_METRES = 1500;
/** World pixels per metre of distance. */
export const PX_PER_METRE = 16;

export const TURKEY = {
  x: 240,
  width: 74,
  height: 62,
  /** Standing hitbox height; sliding shrinks it so knives fly over. */
  slideHeight: 34,
  gravity: 2600,
  jumpV: -980,
  doubleJumpV: -880,
  maxJumps: 2,
  /** How long a slide lasts once pressed, in seconds. */
  slideTime: 0.55,
  /** Seconds of flashing protection after a hit. */
  invulnerable: 1.6,
};

export const LIVES = 3;

export const SPEED = {
  start: 380,
  max: 680,
  /** Extra px/s per 150 m of distance. */
  per150m: 34,
};

/** Obstacle shapes. Knives fly at head height (slide under); the rest sit on the ground (jump over). */
export const OBSTACLES = {
  fence: { width: 44, height: 62, kind: 'fence' },
  hay: { width: 82, height: 76, kind: 'hay' },
  oven: { width: 112, height: 118, kind: 'oven' },
  pumpkin: { width: 56, height: 54, kind: 'pumpkin', roll: 130 },
  knife: { width: 92, height: 26, kind: 'knife', flyY: 528 },
};

export const CORN = { size: 26, points: 25, goldenPoints: 100 };

/** Seconds of play per difficulty step; spawn gaps shrink as speed grows. */
export const SPAWN = { gapMin: 300, gapMax: 560, cornChance: 0.55 };

/** How many obstacles / pickups / particles can exist at once; pools are allocated once, at boot. */
export const POOL_OBSTACLES = 24;
export const POOL_CORN = 40;
export const POOL_PARTICLES = 160;

export const PALETTE = {
  backdrop: '#2a1608',
  skyTop: ['#ff9d45', '#ffb35c', '#7ec8e3'],
  skyMid: ['#ffd194', '#ffe3a3', '#cfeef7'],
  skyBot: ['#ff7e5f', '#ffe9a8', '#fff3c4'],
  sun: '#fff3b0',
  hillFar: '#8a6b4a',
  hillNear: '#6b8e4e',
  barn: '#7a3b2e',
  barnRoof: '#5d2b21',
  groundTop: '#7fb069',
  ground: '#8a5a33',
  groundDark: '#6f4525',
  fence: '#a9805a',
  hay: '#e9c46a',
  hayBand: '#b98a2f',
  oven: '#23272e',
  ovenGlow: '#ff7b24',
  knife: '#dfe6ee',
  knifeEdge: '#ffffff',
  knifeHandle: '#6b3a1f',
  corn: '#f2c94c',
  cornHusk: '#5da24a',
  golden: '#ffd700',
  turkeyBody: '#8a5a2e',
  turkeyDark: '#6b4423',
  turkeyLight: '#a9713f',
  tail: ['#b5541e', '#d2691e', '#e8a33c', '#8a4b2d', '#c96a2e'],
  head: '#d8c9b0',
  wattle: '#e5534b',
  beak: '#f2a541',
  farmerShirt: '#c94f43',
  farmerOveralls: '#3b5b8c',
  farmerSkin: '#e8b88a',
  farmerHat: '#e9c46a',
  panel: 'rgba(24, 12, 4, 0.82)',
  panelEdge: '#e8a33c',
  text: '#fff6e5',
  muted: '#e8c99a',
  heart: '#e5534b',
  heartEmpty: '#5a3a28',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-run.best';

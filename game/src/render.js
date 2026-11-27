// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Everything is drawn with canvas
// shapes (an original turkey, a farmer, ovens, cleavers, pumpkins, corn) over a scrolling
// autumn farm at sunset that deepens to dusk as the turkey nears the forest.
import { FIELD, FONT, GOAL_METRES, LIVES, PALETTE, TURKEY } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER_CAUGHT = 'over-caught';
export const SCREEN_OVER_ESCAPED = 'over-escaped';

const PANEL = { width: 660, line: 32 };
const LIFE_R = 13;

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function hexLerp(h1, h2, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const a = p(h1);
  const b = p(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function skyColor(stops, t) {
  if (t < 0.5) return hexLerp(stops[0], stops[1], t * 2);
  return hexLerp(stops[1], stops[2], (t - 0.5) * 2);
}

export function createRenderer(canvas, decorRandom) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;

  // Precomputed scenery, seeded so every run paints the same farm.
  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    // Keep clouds below the HUD bar so none of them shows through it, greyed out.
    clouds.push({ x: decorRandom() * 1600, y: 95 + decorRandom() * 130, s: 0.7 + decorRandom() * 0.9 });
  }
  const tufts = [];
  for (let i = 0; i < 40; i += 1) {
    tufts.push({ x: decorRandom() * 900, h: 8 + decorRandom() * 10, lean: (decorRandom() - 0.5) * 8 });
  }
  const trees = [];
  for (let i = 0; i < 14; i += 1) {
    trees.push({ x: decorRandom() * 1600, h: 60 + decorRandom() * 70, w: 26 + decorRandom() * 22 });
  }
  const leaves = [];
  for (let i = 0; i < 26; i += 1) {
    leaves.push({
      x: decorRandom() * 1280, y: decorRandom() * 500, s: 3 + decorRandom() * 4,
      speed: 12 + decorRandom() * 22, sway: decorRandom() * Math.PI * 2,
      color: ['#e8a33c', '#d2691e', '#c94f43', '#e9c46a'][i % 4],
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
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

  function drawSky(state, time) {
    const p = Math.min(1, state.metres / GOAL_METRES);
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, skyColor(PALETTE.skyTop, p));
    grad.addColorStop(0.55, skyColor(PALETTE.skyMid, p));
    grad.addColorStop(1, skyColor(PALETTE.skyBot, p));
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Low sun sliding down as the run goes on.
    const sunX = 980 - p * 260;
    const sunY = 130 + p * 130;
    const glow = context.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    glow.addColorStop(0, 'rgba(255, 243, 176, 0.95)');
    glow.addColorStop(0.35, 'rgba(255, 214, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 130, sunY - 130, 260, 260);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
    // Drifting clouds.
    context.fillStyle = 'rgba(255, 246, 229, 0.85)';
    for (const c of clouds) {
      const cx = (((c.x - state.distance * 0.12 - time * 6) % 1700) + 1700) % 1700 - 220;
      context.beginPath();
      context.ellipse(cx, c.y, 52 * c.s, 15 * c.s, 0, 0, Math.PI * 2);
      context.ellipse(cx + 34 * c.s, c.y + 5, 38 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHills(state) {
    const p = Math.min(1, state.metres / GOAL_METRES);
    // Far hills.
    context.fillStyle = hexLerp(PALETTE.hillFar, '#5d4030', p * 0.6);
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.lineTo(x, FIELD.groundY - 46 - Math.sin((x + state.distance * 0.2) / 260) * 26);
    }
    context.lineTo(FIELD.width, FIELD.groundY);
    context.closePath();
    context.fill();
    // Tree line.
    context.fillStyle = hexLerp(PALETTE.hillNear, '#4a5d3a', p * 0.5);
    for (const t of trees) {
      const tx = (((t.x - state.distance * 0.35) % 1600) + 1600) % 1600 - 160;
      context.beginPath();
      context.moveTo(tx, FIELD.groundY);
      context.lineTo(tx + t.w / 2, FIELD.groundY - t.h);
      context.lineTo(tx + t.w, FIELD.groundY);
      context.closePath();
      context.fill();
    }
    // The farmhouse barn, left behind early in the run.
    const barnX = 1020 - state.distance * 0.3;
    if (barnX > -260) {
      context.fillStyle = PALETTE.barn;
      context.fillRect(barnX, FIELD.groundY - 130, 180, 130);
      context.fillStyle = PALETTE.barnRoof;
      context.beginPath();
      context.moveTo(barnX - 12, FIELD.groundY - 130);
      context.lineTo(barnX + 90, FIELD.groundY - 188);
      context.lineTo(barnX + 192, FIELD.groundY - 130);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff6e5';
      context.fillRect(barnX + 70, FIELD.groundY - 78, 40, 78);
      context.strokeStyle = '#5d2b21';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(barnX + 70, FIELD.groundY - 78);
      context.lineTo(barnX + 110, FIELD.groundY);
      context.moveTo(barnX + 110, FIELD.groundY - 78);
      context.lineTo(barnX + 70, FIELD.groundY);
      context.stroke();
      context.fillStyle = '#ffd194';
      context.fillRect(barnX + 24, FIELD.groundY - 112, 26, 26);
      context.fillRect(barnX + 130, FIELD.groundY - 112, 26, 26);
    }
    // The forest at the end: big trees closing in on the right once close.
    if (state.metres > 1250) {
      const q = Math.min(1, (state.metres - 1250) / 250);
      for (let i = 0; i < 5; i += 1) {
        const tx = FIELD.width - 40 - i * 90 - (1 - q) * 500 + ((state.distance * 0.05) % 40);
        const th = 190 + i * 26;
        context.fillStyle = i % 2 ? '#3d5a2e' : '#2f4a26';
        context.beginPath();
        context.moveTo(tx - 55, FIELD.groundY);
        context.lineTo(tx, FIELD.groundY - th);
        context.lineTo(tx + 55, FIELD.groundY);
        context.closePath();
        context.fill();
        context.fillStyle = '#5d4030';
        context.fillRect(tx - 8, FIELD.groundY - 46, 16, 46);
      }
    }
  }

  function drawGround(state) {
    // Dirt with a grass strip on top; tufts and pebbles scroll past.
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.groundDark;
    context.fillRect(0, FIELD.groundY + 46, FIELD.width, 6);
    context.fillRect(0, FIELD.groundY + 88, FIELD.width, 4);
    context.fillStyle = PALETTE.groundTop;
    context.fillRect(0, FIELD.groundY, FIELD.width, 12);
    context.strokeStyle = '#5d8a44';
    context.lineWidth = 2;
    for (const t of tufts) {
      const x = (((t.x - state.distance) % 1320) + 1320) % 1320 - 20;
      context.beginPath();
      context.moveTo(x, FIELD.groundY + 12);
      context.lineTo(x + t.lean, FIELD.groundY + 12 - t.h);
      context.moveTo(x + 6, FIELD.groundY + 12);
      context.lineTo(x + 6 - t.lean, FIELD.groundY + 12 - t.h * 0.8);
      context.stroke();
    }
    // Fence posts in the mid-ground.
    context.fillStyle = PALETTE.fence;
    const spacing = 190;
    const off = (state.distance * 0.6) % spacing;
    for (let x = -off; x < FIELD.width + spacing; x += spacing) {
      context.fillRect(x, FIELD.groundY - 34, 8, 34);
      context.fillRect(x, FIELD.groundY - 26, 190, 5);
      context.fillRect(x, FIELD.groundY - 14, 190, 5);
    }
    // Drifting autumn leaves.
    for (const leaf of leaves) {
      const lx = (((leaf.x - state.distance * 0.45 - state.elapsed * leaf.speed) % 1400) + 1400) % 1400 - 60;
      const ly = (leaf.y + state.elapsed * 26 + Math.sin(state.elapsed * 1.4 + leaf.sway) * 12) % 560;
      context.save();
      context.translate(lx, ly);
      context.rotate(Math.sin(state.elapsed * 2 + leaf.sway) * 0.8);
      context.fillStyle = leaf.color;
      context.beginPath();
      context.ellipse(0, 0, leaf.s, leaf.s * 0.6, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawCorn(c) {
    const y = c.y + Math.sin(c.bob) * 3;
    const cx = c.x + c.size / 2;
    const cy = y + c.size / 2;
    if (c.golden) {
      const glow = context.createRadialGradient(cx, cy, 2, cx, cy, 30);
      glow.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
      glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(cx - 30, cy - 30, 60, 60);
    }
    context.fillStyle = c.golden ? PALETTE.golden : PALETTE.corn;
    context.beginPath();
    context.ellipse(cx, cy, c.size * 0.42, c.size * 0.55, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(160, 110, 20, 0.55)';
    for (let r = -1; r <= 1; r += 1) {
      for (let i = 0; i < 3; i += 1) {
        context.fillRect(cx + r * 7 - 1.5, cy - 8 + i * 8, 3, 3);
      }
    }
    context.fillStyle = PALETTE.cornHusk;
    context.beginPath();
    context.moveTo(cx - 8, cy + 8);
    context.lineTo(cx - 14, cy + 18);
    context.lineTo(cx - 2, cy + 12);
    context.closePath();
    context.moveTo(cx + 8, cy + 8);
    context.lineTo(cx + 14, cy + 18);
    context.lineTo(cx + 2, cy + 12);
    context.closePath();
    context.fill();
  }

  function drawFence(o) {
    context.fillStyle = '#8a5a33';
    context.fillRect(o.x, o.y + 6, 10, o.height - 6);
    context.fillRect(o.x + o.width - 10, o.y + 6, 10, o.height - 6);
    context.fillStyle = PALETTE.fence;
    context.fillRect(o.x, o.y + 10, o.width, 10);
    context.fillRect(o.x, o.y + 34, o.width, 10);
  }

  function drawHay(o) {
    context.fillStyle = PALETTE.hay;
    context.beginPath();
    context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.hayBand;
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2 - 6, o.height / 2 - 6, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(160, 120, 40, 0.6)';
    context.lineWidth = 2;
    for (let i = -2; i <= 2; i += 1) {
      context.beginPath();
      context.moveTo(o.x + o.width / 2 + i * 14, o.y + 8);
      context.lineTo(o.x + o.width / 2 + i * 14, o.y + o.height - 8);
      context.stroke();
    }
  }

  function drawOven(o, time) {
    // A black farm oven, door glowing orange-hot, chimney puffing.
    context.fillStyle = '#16191f';
    roundRect(o.x, o.y, o.width, o.height, 8);
    context.fill();
    context.fillStyle = '#2e333c';
    context.fillRect(o.x + 8, o.y + 6, o.width - 16, 18);
    context.fillStyle = PALETTE.ovenGlow;
    const flicker = 0.75 + Math.sin(time * 9 + o.x) * 0.15;
    context.globalAlpha = flicker;
    roundRect(o.x + 16, o.y + 34, o.width - 32, 54, 6);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = 'rgba(60, 10, 0, 0.85)';
    context.fillRect(o.x + 16, o.y + 56, o.width - 32, 5);
    context.fillRect(o.x + o.width / 2 - 2, o.y + 34, 4, 54);
    context.fillStyle = '#c9ced6';
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.arc(o.x + 26 + i * 26, o.y + 14, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#0e1114';
    context.fillRect(o.x + o.width / 2 - 14, o.y - 26, 28, 28);
    context.fillStyle = PALETTE.ovenGlow;
    context.globalAlpha = 0.5 + Math.sin(time * 6) * 0.2;
    context.beginPath();
    context.moveTo(o.x + 20, o.y - 2);
    context.lineTo(o.x + 30, o.y - 18);
    context.lineTo(o.x + 40, o.y - 2);
    context.moveTo(o.x + o.width - 40, o.y - 2);
    context.lineTo(o.x + o.width - 30, o.y - 16);
    context.lineTo(o.x + o.width - 20, o.y - 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawPumpkin(o) {
    context.save();
    context.translate(o.x + o.width / 2, o.y + o.height / 2);
    context.rotate((o.x * 0.02) % (Math.PI * 2));
    context.fillStyle = '#e07b24';
    context.beginPath();
    context.ellipse(0, 0, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#b85c14';
    context.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.ellipse(i * 9, 0, 10, o.height / 2 - 4, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = '#3a2208';
    context.beginPath();
    context.moveTo(-14, -8);
    context.lineTo(-6, -1);
    context.lineTo(-16, 0);
    context.closePath();
    context.moveTo(14, -8);
    context.lineTo(6, -1);
    context.lineTo(16, 0);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(-14, 10);
    context.lineTo(14, 10);
    context.lineTo(0, 18);
    context.closePath();
    context.fill();
    context.restore();
    context.fillStyle = '#5da24a';
    context.fillRect(o.x + o.width / 2 - 3, o.y - 8, 6, 12);
  }

  function drawKnife(o) {
    context.save();
    context.translate(o.x + o.width / 2, o.y + o.height / 2);
    context.rotate(o.spin);
    // Cleaver: wide steel blade, bright edge, wooden handle.
    context.fillStyle = PALETTE.knife;
    context.beginPath();
    context.moveTo(-46, -12);
    context.lineTo(14, -12);
    context.lineTo(26, 0);
    context.lineTo(14, 12);
    context.lineTo(-46, 12);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.knifeEdge;
    context.fillRect(-46, 9, 60, 3);
    context.fillStyle = PALETTE.knifeHandle;
    roundRect(20, -8, 28, 16, 5);
    context.fill();
    context.fillStyle = '#dfe6ee';
    context.beginPath();
    context.arc(-34, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Speed glint.
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(o.x + o.width + 6, o.y + o.height / 2);
    context.lineTo(o.x + o.width + 26, o.y + o.height / 2);
    context.stroke();
  }

  function drawTurkey(player, time, sliding) {
    const cx = player.x + player.width / 2;
    const ground = FIELD.groundY;
    const airborne = !player.onGround;
    const runPhase = player.onGround ? time * 14 : 0;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.save();
    if (sliding) {
      // Low slide: body flattened, tail swept back, head stretched forward.
      context.translate(cx, ground - 16);
      context.fillStyle = PALETTE.turkeyBody;
      context.beginPath();
      context.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.tail[1];
      for (let i = 0; i < 3; i += 1) {
        context.save();
        context.rotate(Math.PI + 0.5 - i * 0.35);
        context.beginPath();
        context.ellipse(-34, 0, 22, 8, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      context.fillStyle = PALETTE.head;
      context.beginPath();
      context.arc(44, -8, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.beak;
      context.beginPath();
      context.moveTo(54, -10);
      context.lineTo(68, -5);
      context.lineTo(54, -2);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.wattle;
      context.beginPath();
      context.ellipse(50, 4, 4, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1c1c1c';
      context.beginPath();
      context.arc(47, -11, 2.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    const bobY = airborne ? 0 : Math.sin(runPhase) * 2;
    context.translate(cx, player.y + player.height + bobY);
    // Legs.
    const legSwing = airborne ? 0.5 : Math.sin(runPhase) * 0.7;
    context.strokeStyle = '#e8a33c';
    context.lineWidth = 5;
    context.lineCap = 'round';
    const legLen = airborne ? 12 : 20;
    context.beginPath();
    context.moveTo(-10, -8);
    context.lineTo(-10 + Math.sin(legSwing) * 12, -8 + legLen);
    context.moveTo(10, -8);
    context.lineTo(10 + Math.sin(legSwing + Math.PI) * 12, -8 + legLen);
    context.stroke();
    // Tail fan: five feathers spread behind.
    for (let i = 0; i < 5; i += 1) {
      const angle = Math.PI + (i - 2) * 0.34;
      const len = 46 - Math.abs(i - 2) * 5;
      context.save();
      context.rotate(angle - Math.PI / 2);
      context.fillStyle = PALETTE.tail[i];
      context.beginPath();
      context.ellipse(-len * 0.55, 0, len * 0.55, 11, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 246, 229, 0.5)';
      context.beginPath();
      context.ellipse(-len * 0.92, 0, 7, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Body.
    context.fillStyle = PALETTE.turkeyBody;
    context.beginPath();
    context.ellipse(0, -26, 34, 28, -0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.turkeyLight;
    context.beginPath();
    context.ellipse(8, -18, 20, 16, -0.12, 0, Math.PI * 2);
    context.fill();
    // Wing (flaps in the air).
    const flap = airborne ? Math.sin(time * 22) * 0.9 - 0.4 : Math.sin(runPhase) * 0.12;
    context.save();
    context.translate(-4, -30);
    context.rotate(flap);
    context.fillStyle = PALETTE.turkeyDark;
    context.beginPath();
    context.ellipse(-6, 0, 20, 10, -0.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Neck and head.
    context.fillStyle = PALETTE.head;
    context.beginPath();
    context.ellipse(26, -56, 11, 15, 0.25, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(32, -70, 12, 0, Math.PI * 2);
    context.fill();
    // Beak, wattle, eye.
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(42, -72);
    context.lineTo(56, -68);
    context.lineTo(42, -63);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.wattle;
    context.beginPath();
    context.ellipse(38, -58, 4, 8, 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(35, -73, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1c1c1c';
    context.beginPath();
    context.arc(36, -73, 2.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawFarmer(state, time) {
    // Farmer Gus runs in from the left; the smaller the gap, the closer (and bigger) he is.
    const gap = state.farmerGap;
    const scale = 1 + ((170 - gap) / 170) * 0.22;
    const fx = TURKEY.x - gap - 92 * scale;
    const fy = FIELD.groundY;
    const phase = time * 13;
    context.save();
    context.translate(fx + 46 * scale, fy);
    context.scale(scale, scale);
    // Legs.
    context.strokeStyle = PALETTE.farmerOveralls;
    context.lineWidth = 9;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-8, -52);
    context.lineTo(-8 + Math.sin(phase) * 16, 0);
    context.moveTo(8, -52);
    context.lineTo(8 + Math.sin(phase + Math.PI) * 16, 0);
    context.stroke();
    // Overalls + plaid shirt.
    context.fillStyle = PALETTE.farmerOveralls;
    context.fillRect(-20, -96, 40, 48);
    context.fillStyle = PALETTE.farmerShirt;
    context.fillRect(-22, -118, 44, 28);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(-22, -110, 44, 4);
    context.fillRect(-22, -100, 44, 4);
    // Arms: one pumping, one waving a pitchfork.
    context.strokeStyle = PALETTE.farmerShirt;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(-20, -112);
    context.lineTo(-34, -92 + Math.sin(phase) * 8);
    context.stroke();
    context.strokeStyle = '#8a6b4a';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(20, -112);
    context.lineTo(34, -168);
    context.stroke();
    context.strokeStyle = '#c9ced6';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(28, -168);
    context.lineTo(22, -184);
    context.moveTo(34, -168);
    context.lineTo(34, -186);
    context.moveTo(40, -168);
    context.lineTo(46, -184);
    context.stroke();
    // Head: beard, angry eyes, straw hat.
    context.fillStyle = PALETTE.farmerSkin;
    context.beginPath();
    context.arc(0, -132, 17, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8e0d0';
    context.beginPath();
    context.ellipse(2, -120, 13, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#1c1c1c';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-10, -142);
    context.lineTo(-3, -139);
    context.moveTo(10, -142);
    context.lineTo(3, -139);
    context.stroke();
    context.fillStyle = '#1c1c1c';
    context.beginPath();
    context.arc(-6, -135, 2, 0, Math.PI * 2);
    context.arc(6, -135, 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerHat;
    context.beginPath();
    context.ellipse(0, -146, 26, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, -150, 15, 9, 0, Math.PI, 0);
    context.fill();
    context.restore();
    // "!" when he lunges close.
    if (gap < 70) {
      text('!', fx + 92 * scale + 6, fy - 150, 30, '#ff5340', 'left', '800');
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') {
        context.globalAlpha = a * 0.5;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
      } else if (p.kind === 'feather') {
        context.globalAlpha = a;
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.life * 6);
        context.fillStyle = p.color;
        context.beginPath();
        context.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      } else if (p.kind === 'spark') {
        context.globalAlpha = a;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2);
        context.fill();
      } else {
        context.globalAlpha = a * 0.7;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function drawHeart(x, y, filled) {
    context.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
    context.beginPath();
    context.moveTo(x, y + 8);
    context.bezierCurveTo(x - 14, y - 4, x - 6, y - 14, x, y - 6);
    context.bezierCurveTo(x + 6, y - 14, x + 14, y - 4, x, y + 8);
    context.fill();
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    // Top bar.
    context.fillStyle = 'rgba(24, 12, 4, 0.55)';
    roundRect(12, 10, FIELD.width - 24, 64, 10);
    context.fill();
    text(`SCORE ${state.score.toLocaleString('en-US')}`, 28, 20, 26, PALETTE.text, 'left', '800');
    text(`CORN x${state.cornCount}   SPEED LV ${state.level}`, 28, 50, 15, PALETTE.muted, 'left');
    // Distance progress, centre.
    const p = Math.min(1, state.metres / GOAL_METRES);
    const barX = FIELD.width / 2 - 150;
    text(`${Math.floor(state.metres).toLocaleString('en-US')} m / ${GOAL_METRES.toLocaleString('en-US')} m`, FIELD.width / 2, 16, 17, PALETTE.text, 'center', '700');
    context.fillStyle = 'rgba(255, 246, 229, 0.25)';
    roundRect(barX, 42, 300, 12, 6);
    context.fill();
    context.fillStyle = '#ffb35c';
    roundRect(barX, 42, 300 * p, 12, 6);
    context.fill();
    // Barn icon at the start of the bar, pine tree at the forest end.
    context.fillStyle = '#8a5a33';
    context.fillRect(barX - 34, 40, 16, 10);
    context.fillStyle = '#5d2b21';
    context.beginPath();
    context.moveTo(barX - 36, 40);
    context.lineTo(barX - 26, 31);
    context.lineTo(barX - 16, 40);
    context.closePath();
    context.fill();
    context.fillStyle = '#2f5a26';
    context.beginPath();
    context.moveTo(barX + 318, 52);
    context.lineTo(barX + 326, 32);
    context.lineTo(barX + 334, 52);
    context.closePath();
    context.fill();
    context.fillStyle = '#5d4030';
    context.fillRect(barX + 324, 52, 4, 5);
    context.fillStyle = PALETTE.turkeyBody;
    context.beginPath();
    context.arc(barX + 300 * p, 48, 7, 0, Math.PI * 2);
    context.fill();
    // Lives + farmer meter, right.
    for (let i = 0; i < LIVES; i += 1) drawHeart(FIELD.width - 150 + i * 34, 26, i < state.lives);
    text('FARMER', FIELD.width - 152, 48, 13, PALETTE.muted, 'left', '700');
    context.fillStyle = 'rgba(255, 246, 229, 0.25)';
    roundRect(FIELD.width - 96, 50, 76, 9, 4);
    context.fill();
    const danger = 1 - state.farmerGap / 170;
    context.fillStyle = danger > 0.6 ? '#ff5340' : '#ffb35c';
    roundRect(FIELD.width - 96, 50, 76 * danger, 9, 4);
    context.fill();
    // Best + hints (best sits on its own dark pill so it reads over any sky).
    context.fillStyle = 'rgba(24, 12, 4, 0.55)';
    roundRect(FIELD.width - 178, 84, 154, 26, 8);
    context.fill();
    text(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, FIELD.width - 101, 90, 15, PALETTE.text, 'center', '700');
    text('SPACE / CLICK jump · ↓ slide · P pause · M sound', 28, FIELD.height - 30, 15, 'rgba(255,246,229,0.75)', 'left');
  }

  function drawPanel(title, lines, prompt, accent, time) {
    const height = 150 + lines.length * PANEL.line + 66;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, PANEL.width, height, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 66, 46, accent || PALETTE.text, 'center', '900');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 116 + i * PANEL.line, 20, PALETTE.muted, 'center');
    }
    const pulse = 0.65 + Math.sin(time * 4) * 0.35;
    context.globalAlpha = pulse;
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.corn, 'center', '700');
    context.globalAlpha = 1;
  }

  function drawField(state, time) {
    drawSky(state, time);
    drawHills(state);
    drawGround(state);
    for (const c of state.corns) if (c.active) drawCorn(c);
    for (const o of state.obstacles) {
      if (!o.active) continue;
      if (o.kind === 'fence') drawFence(o);
      else if (o.kind === 'hay') drawHay(o);
      else if (o.kind === 'oven') drawOven(o, time);
      else if (o.kind === 'pumpkin') drawPumpkin(o);
      else if (o.kind === 'knife') drawKnife(o);
    }
    drawFarmer(state, time);
    const sliding = state.player.slideTimer > 0;
    drawTurkey(state.player, time, sliding);
    drawParticles(state);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    if (shake > 0) {
      shake -= 0.016;
      shakeX = (Math.random() - 0.5) * shake * 30;
      shakeY = (Math.random() - 0.5) * shake * 30;
    } else {
      shakeX = 0;
      shakeY = 0;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state, time);
    if (screen === SCREEN_TITLE) {
      drawPanel('GOBBLE RUN',
        ['Thanksgiving is coming — and YOU are the main course.',
         'Outrun Farmer Gus, leap the ovens, duck the cleavers.',
         'Reach the forest 1,500 m away and live to gobble another day.',
         'SPACE / CLICK jump (twice = flap) · ↓ slide · P pause',
         `Best score: ${best.toLocaleString('en-US')}`],
        'Press SPACE or CLICK to run', PALETTE.corn, time);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The farmer waits for no turkey.'], 'Press P to resume', PALETTE.text, time);
    } else if (screen === SCREEN_OVER_CAUGHT) {
      context.fillStyle = 'rgba(80, 10, 0, 0.35)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('CAUGHT!',
        ['Farmer Gus got you. The oven was already hot.',
         `Score ${state.score.toLocaleString('en-US')} · Distance ${Math.floor(state.metres).toLocaleString('en-US')} m · Corn x${state.cornCount}`,
         `Best ${Math.max(best, state.score).toLocaleString('en-US')}`],
        'Press SPACE or CLICK to run again', '#ff6b57', time);
    } else if (screen === SCREEN_OVER_ESCAPED) {
      context.fillStyle = 'rgba(255, 200, 90, 0.18)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('ESCAPED!',
        ['You made it to the forest — free, alive, and never',
         'going back to that farm. Happy Thanksgiving, turkey!',
         `Score ${state.score.toLocaleString('en-US')} · Distance ${Math.floor(state.metres).toLocaleString('en-US')} m · Corn x${state.cornCount}`,
         `Best ${Math.max(best, state.score).toLocaleString('en-US')}`],
        'Press SPACE or CLICK to run again', '#ffd700', time);
    }
  }

  function bump(amount) {
    shake = Math.max(shake, amount);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, bump };
}

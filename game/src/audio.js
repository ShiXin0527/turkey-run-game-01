// Tiny synthesised sound effects (Web Audio, no files, no network): a gobble, a jump
// chirp, a corn pop, a hit thud and short win / lose jingles. Everything is a no-op
// until the first user gesture creates the audio context, and M toggles mute.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    jump() {
      tone(320, 0.16, 'square', 0.06, 640);
    },
    flap() {
      tone(420, 0.12, 'square', 0.05, 760);
    },
    corn() {
      tone(880, 0.09, 'sine', 0.1, 1320);
    },
    golden() {
      tone(660, 0.12, 'sine', 0.1, 990);
      setTimeout(() => tone(990, 0.14, 'sine', 0.1, 1320), 90);
    },
    hit() {
      tone(140, 0.25, 'sawtooth', 0.16, 60);
    },
    gobble() {
      // Gobble-gobble: four quick low blips.
      [0, 110, 220, 330].forEach((delay, i) => {
        setTimeout(() => tone(i % 2 ? 220 : 180, 0.09, 'square', 0.09, 140), delay);
      });
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.12), i * 130);
      });
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.25, 'triangle', 0.11), i * 150);
      });
    },
  };
}

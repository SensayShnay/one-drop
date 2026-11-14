// One Drop — the snowfield.
//
// Water's one structured state. Everywhere else in the piece it is a surface or
// a volume; here it arrives as objects, each one built and each one different,
// and the thing that makes a snowflake a snowflake is that it is the same six
// times round.
//
// The view looks down at the water, so snow does not fall down the screen. It
// falls towards you: a flake starts far off, small and soft-edged, and sharpens
// as it comes until it touches the surface. What you do in that time decides
// how you hear it. Catch it in the air and it rings out, the whole crystal at
// once. Let it land and it rings under its breath and leaves a ring on the
// water instead.
//
// A flake's sound is not decoration on its shape; it is read off it. The genome
// that grows the arms is the same genome that picks the notes:
//
//   how many times it branched  ->  how many notes it has
//   how wide it branched        ->  how far apart they are
//   how big it grew             ->  how low it sits
//
// so a tight little flake is a high close cluster, and a broad open one is a
// wide bright spread, and you can see which you are about to hear.

import { mark } from './marks.js';

const MAX_FLAKES = 22;
const FALL = [6.0, 12.0];         // seconds from far off to the surface

// A cold scale: a minor pentatonic with the second left in, which gives the
// close intervals the small flakes need without ever going sour.
const SCALE = [0, 2, 3, 7, 10];
const ROOT = 523.25;              // C5, and up two octaves from there
const DEGREES = [];
for (let o = 0; o < 2; o++) for (const s of SCALE) DEGREES.push(o * 12 + s);
DEGREES.push(24);                 // eleven of them

const rnd = (a, b) => a + Math.random() * (b - a);

export class Snow {
  constructor(sound, surface, layerEl, centre, radius) {
    this.sound = sound; this.surface = surface; this.layer = layerEl;
    this.cx = centre.x; this.cy = centre.y; this.cr = radius;
    this.flakes = [];
    this.next = 0;
    this.near = 0;
  }

  // ---------- growing one ----------
  // Six arms, each with a few generations of side branches. Three numbers decide
  // everything about it, and those same three decide what it plays.
  grow(wx, wy) {
    const levels = 2 + Math.floor(Math.random() * 3);     // 2..4 branchings
    const angle  = rnd(22, 68);                           // how wide they go
    const size   = rnd(0.55, 1.35);                       // how big it got

    // notes: one per branching, spaced by how wide the branching was
    const step = 1 + Math.round((angle - 22) / 46 * 2);   // 1..3 scale degrees
    const span = (levels - 1) * step;
    // bigger flakes start lower down the scale
    const room = Math.max(0, DEGREES.length - 1 - span);
    const base = Math.round((1.35 - size) / 0.8 * room);
    const chord = [];
    for (let i = 0; i < levels; i++)
      chord.push(ROOT * Math.pow(2, DEGREES[Math.min(DEGREES.length - 1, base + i * step)] / 12));

    const f = {
      wx, wy, levels, angle, size, chord,
      t: 0,                                   // 0 far off, 1 touching the water
      sx: null, sy: null,                     // where it last was on screen
      fall: rnd(FALL[0], FALL[1]),
      sway: Math.random() * Math.PI * 2,
      spin: rnd(-26, 26),
      el: document.createElement('div'),
    };
    f.el.className = 'flake';
    f.el.innerHTML = this.render(f);
    this.layer.appendChild(f.el);
    this.flakes.push(f);
    return f;
  }

  // one arm, drawn pointing up, then turned five more times
  render(f) {
    const R = 44, arm = [`M0 0 L0 ${-R}`];
    for (let j = 1; j <= f.levels; j++) {
      const at = R * (j / (f.levels + 1));          // how far out this pair sits
      const len = R * 0.34 * (1 - j / (f.levels + 1.4));
      const a = f.angle * Math.PI / 180;
      const dx = Math.sin(a) * len, dy = Math.cos(a) * len;
      arm.push(`M0 ${-at} l${dx.toFixed(1)} ${-dy.toFixed(1)}`);
      arm.push(`M0 ${-at} l${(-dx).toFixed(1)} ${-dy.toFixed(1)}`);
    }
    const d = arm.join(' ');
    let g = '';
    for (let k = 0; k < 6; k++) g += `<path transform="rotate(${k * 60})" d="${d}"/>`;
    return `<svg viewBox="-50 -50 100 100">${g}</svg>`;
  }

  // ---------- what it says ----------
  // Outward from the middle, a note for each branching, in the order it grew.
  ring(f, level, pan) {
    const s = this.sound;
    if (!s.ready || !s.ctx) return;
    const t0 = s.ctx.currentTime + 0.01;
    f.chord.forEach((hz, i) => {
      s.crystal(hz, t0 + i * 0.062, level * (0.9 - i * 0.12), pan + (i - 1) * 0.07,
                s.master, 2.4 + f.size * 1.6);
    });
  }

  // caught in the air: the whole crystal, close to your ear
  take(f) {
    const pan = Math.max(-1, Math.min(1, (f.sx / innerWidth - 0.5) * 2));
    this.ring(f, 0.3, pan);
    if (f.sx != null) {
      this.surface.quiet = true;
      this.surface.drop(f.sx, f.sy, 11, 0.04);
      this.surface.quiet = false;
    }
    this.remove(f, true);
  }

  // let it land: under its breath, and a ring on the water instead
  land(f) {
    const pan = Math.max(-1, Math.min(1, (f.sx / innerWidth - 0.5) * 2));
    this.ring(f, 0.1, pan);
    // only the heavier ones leave a ring; the small ones are taken by the water
    // without it noticing
    if (f.size > 0.85 && f.sx != null) {
      this.surface.drop(f.sx, f.sy, 7 + f.size * 11, 0.012 + f.size * 0.016);
    }
    this.remove(f, false);
  }

  remove(f, caught) {
    f.el.classList.add(caught ? 'taken' : 'melting');
    setTimeout(() => { try { f.el.remove(); } catch {} }, 700);
    const i = this.flakes.indexOf(f);
    if (i >= 0) this.flakes.splice(i, 1);
  }

  // ---------- catching one ----------
  // The nearest flake under your finger, if it is close enough and still in the
  // air. Returns true if one was taken, so the water knows not to ripple as well.
  catchAt(sx, sy) {
    if (this.near < 0.25) return false;
    let best = null, bestD = 46;
    for (const f of this.flakes) {
      if (f.t > 0.97 || f.sx == null) continue;
      const d = Math.hypot(f.sx - sx, f.sy - sy);
      // a flake close to the surface is easier to catch than one far off
      if (d < bestD * (0.55 + f.t * 0.75)) { best = f; bestD = d; }
    }
    if (!best) return false;
    this.take(best);
    return true;
  }

  clearAll() {
    for (const f of [...this.flakes]) this.remove(f, false);
  }

  // ---------- each frame ----------
  update(world, near, dt, now) {
    this.near = near || 0;
    const show = this.near > 0.08;
    this.layer.style.opacity = show ? Math.min(1, this.near * 1.5).toFixed(2) : 0;
    if (!show) { if (this.flakes.length) this.clearAll(); return; }

    // It snows harder the further in you are. Flakes come down across the view
    // rather than across the area: the area is about twice as wide as the
    // screen, so scattering them over it put most of the snow where you were
    // not looking and left the air in front of you nearly empty.
    if ((this.next -= dt) <= 0) {
      this.next = rnd(0.22, 0.75) / (0.35 + this.near);
      if (this.flakes.length < MAX_FLAKES) {
        const across = 1.3 * (innerWidth / innerHeight), down = 1.3;
        this.grow(world.at(world.x + (Math.random() - 0.5) * across),
                  world.at(world.y + (Math.random() - 0.5) * down));
      }
    }

    const ch = innerHeight, cw = innerWidth, ox = cw / 2, oy = ch / 2;
    for (const f of [...this.flakes]) {
      f.t += dt / f.fall;
      if (f.t >= 1) { this.land(f); continue; }
      // it is not falling down the screen; it is coming towards you, and the
      // air moves it about on the way
      f.sway += dt * 0.6;
      const wobble = Math.sin(f.sway) * 0.055 * (1 - f.t);
      const sx = f.sx = ox + world.dx(f.wx + wobble) * ch;
      const sy = f.sy = oy + world.dy(f.wy + Math.cos(f.sway * 0.7) * 0.03 * (1 - f.t)) * ch;
      if (sx < -70 || sx > cw + 70 || sy < -70 || sy > ch + 70) { f.el.style.opacity = 0; continue; }

      const scale = (0.22 + f.t * 0.78) * f.size;
      const fade = Math.min(1, f.t * 3.2) * (1 - Math.pow(f.t, 7)) * 0.95;
      f.el.style.transform =
        `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) ` +
        `scale(${scale.toFixed(3)}) rotate(${(f.spin * f.t).toFixed(1)}deg)`;
      f.el.style.opacity = fade.toFixed(2);
      // far off it is a smudge; it only becomes a crystal as it arrives
      f.el.style.filter = f.t < 0.72 ? `blur(${((0.72 - f.t) * 4.2).toFixed(2)}px)` : 'none';

      mark({ k: 'flake', x: sx, y: sy, r: 46 * scale, a: fade, arms: 6 });
    }
  }
}

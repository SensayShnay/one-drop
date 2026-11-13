// One Drop — the soundings.
// Stones laid on the bed of the deep. They make no sound of their own, but any
// ripple that passes over one makes it ring, so the deep is played by the water.

import { mark } from './marks.js';

// The key and the scale are yours to set. Down here the water is deep enough
// that the whole thing can be retuned without anything else noticing.
export const SCALES = {
  'minor pentatonic': [0, 3, 5, 7, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  'dorian':           [0, 2, 3, 5, 7, 9, 10],
  'aeolian':          [0, 2, 3, 5, 7, 8, 10],
  'lydian':           [0, 2, 4, 6, 7, 9, 11],
  'japanese':         [0, 1, 5, 7, 8],
  'whole tone':       [0, 2, 4, 6, 8, 10],
};
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE = 130.81;                 // C3, and the key counts up from there
const OCTAVES = 3;
const MAX_STONES = 14;
const NOTES = [];
let SCALE = SCALES['minor pentatonic'];
let ROOT = BASE * Math.pow(2, 2 / 12);   // D3 to begin with, as it always was
function rebuild() {
  NOTES.length = 0;
  for (let o = 0; o < OCTAVES; o++) for (const s of SCALE) NOTES.push(o * 12 + s);
  NOTES.push(OCTAVES * 12);          // and the octave at the top to finish on
}
rebuild();

export class Soundings {
  constructor(sound, surface, layerEl, centre, radius) {
    this.sound = sound;
    this.surface = surface;
    this.layer = layerEl;
    this.cy = centre.y; this.cr = radius;
    this.stones = [];
    this.fronts = [];
    this.load();
  }

  // pitch comes from how deep the stone lies: low at the bottom
  // retuning: the stones keep their places and take their new notes
  setKey(name) {
    const i = KEYS.indexOf(name);
    if (i < 0) return;
    ROOT = BASE * Math.pow(2, i / 12);
    this.retune();
  }
  setScale(name) {
    if (!SCALES[name]) return;
    SCALE = SCALES[name];
    rebuild();
    this.retune();
  }
  retune() {
    for (const st of this.stones) st.freq = this.noteFor(st.wy);
  }

  noteFor(wy) {
    const t = Math.max(-1, Math.min(1, (wy - this.cy) / this.cr));
    const i = Math.round((1 - (t + 1) / 2) * (NOTES.length - 1));
    return ROOT * Math.pow(2, NOTES[i] / 12);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('onedrop.stones') || '[]');
      for (const st of saved) this.attach(st.wx, st.wy);
    } catch {}
  }
  save() {
    try {
      localStorage.setItem('onedrop.stones',
        JSON.stringify(this.stones.map(s => ({ wx: s.wx, wy: s.wy }))));
    } catch {}
  }

  attach(wx, wy) {
    const el = document.createElement('div');
    el.className = 'stone';
    el.innerHTML = '<i></i>';
    this.layer.appendChild(el);
    const stone = { wx, wy, el, freq: this.noteFor(wy), born: performance.now() };
    this.stones.push(stone);
    // the deep holds only so many; the oldest sinks away
    while (this.stones.length > MAX_STONES) {
      const old = this.stones.shift();
      old.el.classList.add('going');
      setTimeout(() => old.el.remove(), 900);
    }
    return stone;
  }

  place(wx, wy) {
    const stone = this.attach(wx, wy);
    this.save();
    // it sounds once as it settles, so you hear what you have put down
    this.ring(stone, 0.34, 0);
    return stone;
  }

  // let them all go: the stones sink one after another
  clearAll() {
    const going = this.stones.slice();
    this.stones = [];
    this.fronts = [];
    this.save();
    going.forEach((st, i) => {
      setTimeout(() => {
        st.el.classList.add('going');
        const s = this.sound;
        if (s.ready && s.ctx) s.soft(st.freq / 2, s.ctx.currentTime + 0.01, 0.12, 0, s.master);
        setTimeout(() => st.el.remove(), 900);
      }, i * 110);
    });
  }

  // a tap on a stone lifts it out again
  removeNear(wx, wy, within = 0.045) {
    let best = null, bd = within;
    for (const s of this.stones) {
      const d = Math.hypot(s.wx - wx, s.wy - wy);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return false;
    best.el.classList.add('going');
    setTimeout(() => best.el.remove(), 900);
    this.stones = this.stones.filter(s => s !== best);
    this.save();
    return true;
  }

  // every ripple worth the name sets off across the deep
  addFront(wx, wy, strength) {
    if (this.fronts.length > 22) this.fronts.shift();
    this.fronts.push({ wx, wy, r: 0, strength, rung: new Set() });
  }

  ring(stone, level, pan) {
    const s = this.sound;
    if (!s.ready || !s.ctx) return;
    s.soft(stone.freq, s.ctx.currentTime + 0.01, level * 0.62, pan, s.master);
    stone.el.classList.add('ringing');
    clearTimeout(stone.t);
    stone.t = setTimeout(() => stone.el.classList.remove('ringing'), 420);
    const r = stone.el.getBoundingClientRect();
    if (r.width) {
      // the stone troubles the water, but that ripple must not go on to strike
      // other stones, or the pool would set itself off for ever
      this.surface.quiet = true;
      this.surface.drop(r.left + r.width / 2, r.top + r.height / 2, 9, 0.02 + level * 0.05);
      this.surface.quiet = false;
    }
  }

  update(world, near) {
    const cw = innerWidth, ch = innerHeight, cx = cw / 2, cyp = ch / 2;
    // place the stones on screen
    for (const st of this.stones) {
      const sx = cx + (st.wx - world.x) * ch, sy = cyp + (st.wy - world.y) * ch;
      const on = sx > -60 && sx < cw + 60 && sy > -60 && sy < ch + 60;
      st.el.style.display = on ? 'grid' : 'none';
      if (on) st.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
      st.el.style.opacity = (0.25 + near * 0.75).toFixed(2);
      if (on) mark({ k: 'stone', x: sx, y: sy, r: (st.size || 22) / 2,
                     lit: st.lit || 0, a: 0.25 + near * 0.75 });
    }
    // carry the wavefronts outward at exactly the speed the water moves
    const step = this.surface.waveStep();
    for (const f of this.fronts) {
      f.r += step;
      if (near < 0.12) continue;
      for (let i = 0; i < this.stones.length; i++) {
        if (f.rung.has(i)) continue;
        const st = this.stones[i];
        const d = Math.hypot(st.wx - f.wx, st.wy - f.wy);
        if (f.r >= d) {
          f.rung.add(i);
          // quieter the further it had to travel, and the fainter the ripple
          const level = Math.min(0.5, f.strength * 1.7 / (1 + d * 2.2)) * near;
          if (level > 0.012) {
            const pan = Math.max(-1, Math.min(1, (st.wx - world.x) * 2.2));
            this.ring(st, level, pan);
          }
        }
      }
    }
    this.fronts = this.fronts.filter(f => f.r < 2.6);
  }
}

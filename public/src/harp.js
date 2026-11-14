// One Drop — the rain harp.
// Leaves laid out across the water. You do not play them; the rain does. Each
// leaf sounds when a drop lands on it, so the weather is the performer and you
// only decide which notes are available to it.

import { mark } from './marks.js';

const SCALE = [0, 3, 5, 7, 10];
const ROOT = 196.00;   // G3
const NOTES = [];
for (let o = 0; o < 2; o++) for (const s of SCALE) NOTES.push(o * 12 + s);
NOTES.push(24);

const MAX_LEAVES = 12;

// Six species, told apart by outline, proportion and vein.
const rr = (r, a, b) => r(a, b).toFixed(0);
const SPECIES = [
  { name: 'willow',   vein: 'mid',  scale: 1.15, aspect: [0.22, 0.32], green: '78, 118, 92',
    shape: r => `${rr(r,2,7)}% ${rr(r,48,60)}% ${rr(r,2,7)}% ${rr(r,48,60)}%` },
  { name: 'lance',    vein: 'mid',  scale: 1.0,  aspect: [0.42, 0.58], green: '70, 124, 100',
    shape: r => `${rr(r,2,8)}% ${rr(r,64,82)}% ${rr(r,22,38)}% ${rr(r,64,82)}%` },
  { name: 'lily',     vein: 'rays', scale: 1.15, aspect: [0.95, 1.08], green: '58, 112, 96',
    shape: r => `${rr(r,44,50)}% ${rr(r,44,50)}% ${rr(r,44,50)}% ${rr(r,6,16)}%` },
  { name: 'heart',    vein: 'mid',  scale: 0.95, aspect: [0.82, 0.98], green: '84, 128, 96',
    shape: r => `${rr(r,66,84)}% ${rr(r,66,84)}% ${rr(r,4,12)}% ${rr(r,66,84)}%` },
  { name: 'oval',     vein: 'mid',  scale: 0.92, aspect: [0.62, 0.78], green: '66, 118, 104',
    shape: r => `${rr(r,42,52)}% ${rr(r,42,52)}% ${rr(r,42,52)}% ${rr(r,42,52)}%` },
  { name: 'fan',      vein: 'rays', scale: 0.98, aspect: [1.05, 1.3],  green: '92, 130, 88',
    shape: r => `${rr(r,58,76)}% ${rr(r,58,76)}% ${rr(r,10,22)}% ${rr(r,10,22)}%` },
];

export class Harp {
  constructor(sound, surface, layerEl, centre, radius) {
    this.sound = sound; this.surface = surface; this.layer = layerEl;
    this.cx = centre.x; this.cr = radius;
    this.leaves = [];
    this.load();
  }

  // pitch runs across the water: low on the left, high on the right
  noteFor(wx) {
    const t = Math.max(-1, Math.min(1, (wx - this.cx) / this.cr));
    const i = Math.round((t + 1) / 2 * (NOTES.length - 1));
    return ROOT * Math.pow(2, NOTES[i] / 12);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('onedrop.leaves') || '[]');
      for (const l of saved) this.attach(l.wx, l.wy, SPECIES.find(s => s.name === l.sp));
    } catch {}
  }
  save() {
    try {
      localStorage.setItem('onedrop.leaves',
        JSON.stringify(this.leaves.map(l => ({ wx: l.wx, wy: l.wy, sp: l.sp && l.sp.name }))));
    } catch {}
  }

  attach(wx, wy, species) {
    const el = document.createElement('div');
    el.className = 'leaf';
    el.innerHTML = '<i></i>';
    // leaves of different species, each with its own outline and proportions
    const r = (a, b) => a + Math.random() * (b - a);
    const sp = species || SPECIES[Math.floor(Math.random() * SPECIES.length)];
    el.classList.add('sp-' + sp.vein);
    el.style.setProperty('--shape', sp.shape(r));
    el.style.setProperty('--tilt', r(-180, 180).toFixed(1) + 'deg');
    el.style.setProperty('--lean', r(100, 200).toFixed(0) + 'deg');
    el.style.setProperty('--veer', r(-18, 18).toFixed(1) + 'deg');
    el.style.setProperty('--green', sp.green);
    this.layer.appendChild(el);
    const leaf = { wx, wy, el, sp, freq: this.noteFor(wx),
                   size: (0.033 + Math.random() * 0.015) * sp.scale,
                   aspect: sp.aspect[0] + Math.random() * (sp.aspect[1] - sp.aspect[0]) };
    this.leaves.push(leaf);
    while (this.leaves.length > MAX_LEAVES) {
      const old = this.leaves.shift();
      old.el.classList.add('going');
      setTimeout(() => old.el.remove(), 900);
    }
    return leaf;
  }

  place(wx, wy) {
    const leaf = this.attach(wx, wy);
    this.save();
    this.pluck(leaf, 0.4);
    return leaf;
  }

  removeNear(wx, wy, within = 0.05) {
    let best = null, bd = within;
    for (const l of this.leaves) {
      const d = Math.hypot(l.wx - wx, l.wy - wy);
      if (d < bd) { bd = d; best = l; }
    }
    if (!best) return false;
    best.el.classList.add('going');
    setTimeout(() => best.el.remove(), 900);
    this.leaves = this.leaves.filter(l => l !== best);
    this.save();
    return true;
  }

  clearAll() {
    const going = this.leaves.slice();
    this.leaves = [];
    this.save();
    going.forEach((l, i) => setTimeout(() => {
      l.el.classList.add('going');
      setTimeout(() => l.el.remove(), 900);
    }, i * 90));
  }

  // A leaf under rain is the softest thing in the piece, so it speaks with an
  // electric piano rather than the round tone the stones and the ice use: a
  // short bright bark and then a long quiet ring. The water that lands on it is
  // still there underneath, but only just, because the tine is the attack now.
  pluck(leaf, level) {
    const s = this.sound;
    if (!s.ready || !s.ctx) return;
    const pan = Math.max(-1, Math.min(1, (leaf.wx - this.cx) * 1.1));
    s.rhodes(leaf.freq, s.ctx.currentTime + 0.01, level * 0.52, pan, s.master, 2.5);
    const rate = Math.max(0.62, Math.min(1.95, leaf.freq / 420 + (Math.random() - 0.5) * 0.06));
    s.play('hit_droplet', level * 0.2, pan, rate);
    leaf.el.classList.add('struck');
    clearTimeout(leaf.t);
    leaf.t = setTimeout(() => leaf.el.classList.remove('struck'), 380);
    const r = leaf.el.getBoundingClientRect();
    if (r.width) {
      this.surface.quiet = true;
      this.surface.drop(r.left + r.width / 2, r.top + r.height / 2, 9 + level * 20, 0.02 + level * 0.07);
      this.surface.quiet = false;
    }
  }

  // called for every drop of rain that lands: does it find a leaf?
  rainOn(wx, wy, strength, near) {
    if (near < 0.2 || !this.leaves.length) return false;
    for (const l of this.leaves) {
      if (Math.hypot(l.wx - wx, l.wy - wy) < l.size) {
        this.pluck(l, Math.min(0.5, 0.14 + strength * 1.6) * near);
        return true;
      }
    }
    return false;
  }

  update(world, near) {
    const cw = innerWidth, ch = innerHeight, cx = cw / 2, cy = ch / 2;
    for (const l of this.leaves) {
      const sx = cx + world.dx(l.wx) * ch, sy = cy + world.dy(l.wy) * ch;
      const on = sx > -60 && sx < cw + 60 && sy > -60 && sy < ch + 60;
      l.el.style.display = on ? 'grid' : 'none';
      if (on) {
        l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
        const h = l.size * 2 * ch;
        l.el.style.height = h.toFixed(0) + 'px';
        l.el.style.width = (h * l.aspect).toFixed(0) + 'px';
      }
      l.el.style.opacity = (0.2 + near * 0.8).toFixed(2);
      if (on) mark({ k: 'leaf', x: sx, y: sy, r: l.size * ch, aspect: l.aspect,
                     rot: ((l.spin || 0) * Math.PI) / 180, lit: l.lit || 0,
                     a: 0.2 + near * 0.8 });
    }
  }
}

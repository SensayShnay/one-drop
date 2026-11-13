// One Drop — the creek.
// Shallow water running downhill over rocks. The flow comes down in surges, and
// every rock the water breaks on rings as the surge reaches it. Where a rock sits
// across the stream is its note, and how far down it sits is when it sounds, so
// moving one rock changes both what it plays and where it falls in the bar.

import { mark } from './marks.js';

const NOTES = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
const BASE = 783.99;                 // the chime was tuned to G5, so this rings at rate 1
const MAX_ROCKS = 12;
const PERIOD = 3.2;                  // seconds for one surge to run the length of the creek
// Both axes have to fit on the screen you are holding, or half the notes and
// half the bar would be somewhere you cannot see. Across is narrower than down,
// because a phone is.
const ACROSS = 0.20;                 // screen heights either side of the middle
const DOWN = 0.45;

export class Creek {
  constructor(sound, surface, layerEl, surgeEl, centre, radius) {
    this.sound = sound; this.surface = surface;
    this.layer = layerEl; this.surgeEl = surgeEl;
    this.cx = centre.x; this.cy = centre.y; this.cr = radius;
    this.rocks = [];
    this.phase = 0;
    this.buildCrest();
    this.load();
  }

  // The surge is a crest of moving water, not a line. One body of water with
  // thickness that swells and thins along its length, a bright edge where it
  // catches the light, and a strand or two of chop riding on it. They all share
  // the same long swells, so it reads as one front rather than three ribbons,
  // and it fades out at either side instead of running off the screen.
  buildCrest() {
    const svg = this.surgeEl;
    if (!svg) return;
    svg.innerHTML =
      '<defs><linearGradient id="crestfade" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#dcf0fa" stop-opacity="0"/>' +
      '<stop offset="0.16" stop-color="#dcf0fa" stop-opacity="0.9"/>' +
      '<stop offset="0.84" stop-color="#dcf0fa" stop-opacity="0.9"/>' +
      '<stop offset="1" stop-color="#dcf0fa" stop-opacity="0"/></linearGradient></defs>';
    const mk = cls => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('class', cls);
      svg.appendChild(el);
      return el;
    };
    this.body = mk('crest-body');
    this.edge = mk('crest-edge');
    this.chop = [mk('crest-chop'), mk('crest-chop')];
    this.chop[1].style.opacity = 0.45;
    this.reseed();
  }

  // the shape of this pass: long swells everyone rides, chop on top of them
  reseed() {
    const pick = (n, amp, freq) => {
      const w = [];
      for (let i = 0; i < n; i++)
        w.push({ f: (freq + Math.random() * freq) * (i + 1),
                 a: (amp / (i + 1)) * (0.5 + Math.random()),
                 p: Math.random() * Math.PI * 2,
                 s: (0.25 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1) });
      return w;
    };
    this.swell = pick(3, 18, 0.5);          // the front itself, long and shallow
    this.thick = pick(2, 5.5, 1.0);          // where it piles up and where it thins
    this.ripple = [pick(3, 4.4, 2.2), pick(3, 3.8, 3.0)];
    this.t = this.t || 0;
  }

  sum(waves, u, t) {
    let v = 0;
    for (const w of waves) v += Math.sin(u * w.f * Math.PI * 2 + w.p + t * w.s) * w.a;
    return v;
  }

  drawCrest(sy, dt) {
    const cw = innerWidth;
    this.t += dt;
    const N = 84, step = cw / N;          // fine enough that the curve never shows its corners
    const top = [], bot = [];
    let edge = '';
    for (let i = 0; i <= N; i++) {
      const x = i * step, u = i / N;
      const y = sy + this.sum(this.swell, u, this.t);
      const th = 5.5 + Math.abs(this.sum(this.thick, u, this.t * 0.8));
      top.push([x, y - th * 0.45]);
      bot.push([x, y + th * 0.55]);
      edge += (i ? 'L' : 'M') + x.toFixed(1) + ',' + (y - th * 0.45).toFixed(1);
    }
    let d = '';
    for (let i = 0; i < top.length; i++) d += (i ? 'L' : 'M') + top[i][0].toFixed(1) + ',' + top[i][1].toFixed(1);
    for (let i = bot.length - 1; i >= 0; i--) d += 'L' + bot[i][0].toFixed(1) + ',' + bot[i][1].toFixed(1);
    this.body.setAttribute('d', d + 'Z');
    this.edge.setAttribute('d', edge);
    mark({ k: 'crest', pts: top, w: 1.6, a: 0.5 });
    for (let k = 0; k < this.chop.length; k++) {
      let c = '';
      const chopPts = [];
      for (let i = 0; i <= N; i++) {
        const x = i * step, u = i / N;
        const y = sy + this.sum(this.swell, u, this.t) + this.sum(this.ripple[k], u, this.t) + (k ? 6 : -5);
        c += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
        chopPts.push([x, y]);
      }
      this.chop[k].setAttribute('d', c);
      mark({ k: 'crest', pts: chopPts, w: 0.9, a: 0.35 });
    }
  }

  // across the stream is the note: low on the near bank, high on the far one
  noteFor(wx) {
    const t = Math.max(0, Math.min(1, (wx - (this.cx - ACROSS)) / (ACROSS * 2)));
    return NOTES[Math.round(t * (NOTES.length - 1))];
  }

  // and how far down it sits is when in the bar it sounds
  timeFor(wy) {
    const t = (wy - (this.cy - DOWN)) / (DOWN * 2);
    return ((t % 1) + 1) % 1;
  }

  load() {
    try {
      for (const r of JSON.parse(localStorage.getItem('onedrop.rocks') || '[]'))
        this.attach(r.wx, r.wy, r.size);
    } catch {}
  }
  save() {
    try {
      localStorage.setItem('onedrop.rocks',
        JSON.stringify(this.rocks.map(r => ({ wx: r.wx, wy: r.wy, size: r.size }))));
    } catch {}
  }

  attach(wx, wy, size) {
    const el = document.createElement('div');
    el.className = 'rock';
    // no two rocks the same shape, the way no two in a creek are
    const s = size || (0.5 + Math.random() * 0.5);
    const a = 42 + Math.random() * 16, b = 38 + Math.random() * 20;
    el.style.borderRadius = `${a}% ${100 - a}% ${b}% ${100 - b}% / ${b}% ${a}% ${100 - a}% ${100 - b}%`;
    el.innerHTML = '<i></i>';                      // the water breaking over it
    this.layer.appendChild(el);
    const rock = { wx, wy, size: s, el, wake: el.querySelector('i'), lit: 0, last: -1 };
    this.rocks.push(rock);
    return rock;
  }

  place(wx, wy) {
    if (this.rocks.length >= MAX_ROCKS) return null;
    const rock = this.attach(wx, wy);
    this.save();
    const s = this.sound;
    if (s.ready && s.ctx) s.play('hit_flowchime', 0.3, this.panAt(wx), 0.94 + Math.random() * 0.14);
    return rock;
  }

  nearest(wx, wy, within = 0.06) {
    let best = null, bd = within;
    for (const r of this.rocks) {
      const d = Math.hypot(r.wx - wx, r.wy - wy);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  lift(rock) {
    const i = this.rocks.indexOf(rock);
    if (i < 0) return false;
    this.rocks.splice(i, 1);
    rock.el.classList.add('going');
    setTimeout(() => rock.el.remove(), 700);
    this.save();
    const s = this.sound;
    if (s.ready && s.ctx) s.play('hit_droplet', 0.2, this.panAt(rock.wx), 0.8);
    return true;
  }

  clearAll() {
    for (const r of this.rocks) {
      r.el.classList.add('going');
      setTimeout(el => el.remove(), 700, r.el);
    }
    this.rocks = [];
    this.save();
    const s = this.sound;
    if (s.ready && s.ctx) s.play('hit_flowchime', 0.26, 0, 0.78);
  }

  panAt(wx) { return Math.max(-1, Math.min(1, (wx - this.cx) / ACROSS)); }

  // the water reaches a rock and breaks over it
  strike(rock, near) {
    rock.lit = 1;
    const s = this.sound;
    if (!s.ready || !s.ctx) return;
    const freq = this.noteFor(rock.wx);
    const gain = (0.17 + rock.size * 0.2) * near;
    s.play('hit_creekchime', gain, this.panAt(rock.wx), freq / BASE, s.creek);
  }

  update(world, near, dt, now) {
    const ch = innerHeight, cw = innerWidth, sx0 = cw / 2, sy0 = ch / 2;
    const show = near > 0.1;
    this.layer.style.opacity = show ? Math.min(1, near * 1.4).toFixed(2) : 0;

    // the surge runs the length of the creek and comes round again
    const was = this.phase;
    this.phase = (this.phase + dt / PERIOD) % 1;
    const wrapped = this.phase < was;

    for (const rock of this.rocks) {
      const at = this.timeFor(rock.wy);
      // it fires when the surge passes it, once each time round
      const passed = wrapped ? (at >= was || at < this.phase) : (at >= was && at < this.phase);
      if (passed && show) {
        this.strike(rock, near);
        const sx = sx0 + (rock.wx - world.x) * ch, sy = sy0 + (rock.wy - world.y) * ch;
        if (sx > -60 && sx < cw + 60 && sy > -60 && sy < ch + 60) {
          this.surface.quiet = true;
          this.surface.drop(sx, sy, 10 + rock.size * 16, 0.05 + rock.size * 0.1);
          this.surface.quiet = false;
        }
      }
      rock.lit *= Math.pow(0.1, dt);

      const sx = sx0 + (rock.wx - world.x) * ch, sy = sy0 + (rock.wy - world.y) * ch;
      const px = (26 + rock.size * 34);
      const on = show && sx > -px && sx < cw + px && sy > -px && sy < ch + px;
      rock.el.style.display = on ? 'block' : 'none';
      if (!on) continue;
      rock.el.style.width = px.toFixed(0) + 'px';
      rock.el.style.height = (px * 0.82).toFixed(0) + 'px';
      rock.el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
      rock.el.style.setProperty('--lit', rock.lit.toFixed(2));
      mark({ k: 'rock', x: sx, y: sy, r: px / 2, lit: rock.lit, a: Math.min(1, near * 1.4) });
    }

    // the crest of the surge, coming down the creek
    if (show && this.surgeEl) {
      if (wrapped) this.reseed();                        // no two passes the same
      const wy = (this.cy - DOWN) + this.phase * DOWN * 2;
      this.drawCrest(sy0 + (wy - world.y) * ch, dt);
      this.surgeEl.style.opacity = (0.5 * near).toFixed(3);
    } else if (this.surgeEl) this.surgeEl.style.opacity = 0;
  }
}

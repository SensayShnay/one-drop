// One Drop — the singing bowls.
// Five of them, standing in the cove where they have always stood. They are not
// something you carry about: they are fixtures, and the water plays them.
//
// Each bowl holds its own water. The rim is a wall in the wave simulation, so a
// ripple started inside one stays inside and goes round and round, and the open
// water outside breaks against it instead of washing through. Touch inside a
// bowl and it rings. Touch anywhere else and the ripple travels out across the
// cove, and every bowl it reaches rings as it arrives, nearest first. Rub a slow
// circle inside one and it sings the way a wet finger round a rim does.

// low notes in big bowls, laid out around the cove so all five sit on one screen
import { mark } from './marks.js';

const BOWLS = [
  { note: 'G', file: 'bowl_g', wx: -0.158, wy: -0.118, r: 0.105 },
  { note: 'B', file: 'bowl_b', wx:  0.004, wy: -0.288, r: 0.092 },
  { note: 'C', file: 'bowl_c', wx:  0.160, wy: -0.098, r: 0.079 },
  { note: 'D', file: 'bowl_d', wx:  0.104, wy:  0.106, r: 0.067 },
  { note: 'F', file: 'bowl_f', wx: -0.072, wy:  0.112, r: 0.056 },
];

const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Bowls {
  constructor(sound, surface, layerEl, centre) {
    this.sound = sound; this.surface = surface; this.layer = layerEl;
    this.cx = centre ? centre.x : 0; this.cy = centre ? centre.y : 0;
    this.bowls = BOWLS.map(b => ({ ...b, wx: b.wx + this.cx, wy: b.wy + this.cy,
                                   lit: 0, sing: 0, el: null }));
    this.fronts = [];
    this.pts = [];
    this.rubbing = false;
    this.energy = 0;            // what the map asks, to know whether to hold still
    this.inside = null;         // the bowl a finger is working in
    for (const b of this.bowls) {
      const el = document.createElement('div');
      el.className = 'bowl';
      el.innerHTML = '<i></i><b></b>';
      el.querySelector('b').textContent = b.note;
      layerEl.appendChild(el);
      b.el = el;
    }
  }

  at(wx, wy) {
    for (const b of this.bowls) if (Math.hypot(b.wx - wx, b.wy - wy) < b.r) return b;
    return null;
  }

  // a ripple of any substance travels the cove and rings what it reaches
  addFront(wx, wy, strength) {
    const held = this.at(wx, wy);
    if (this.fronts.length > 20) this.fronts.shift();
    // a ripple raised inside a bowl cannot leave it, so it only ever rings that one
    this.fronts.push({ wx, wy, r: 0, strength, held, rung: new Set() });
  }

  ring(b, level, pan) {
    const s = this.sound;
    b.lit = Math.min(1.4, b.lit + level * 2.4);
    if (!s.ready || !s.ctx) return;
    s.strikeBowl(this.bowls.indexOf(b), Math.min(0.9, level));
  }

  // touching the water inside a bowl: it rings, and the ripple stays in it
  tap(wx, wy, sx, sy) {
    const b = this.at(wx, wy);
    if (!b) return null;
    this.ring(b, 0.5, Math.max(-1, Math.min(1, (b.wx - this.cx) * 2.4)));
    this.surface.drop(sx, sy, 13, 0.3);
    return b;
  }

  // ----- rubbing one of them -----
  feed(x, y, t) {
    this.pts.push({ x, y, t });
    if (this.pts.length > 26) this.pts.shift();
  }

  read(now) {
    const pts = this.pts.filter(p => now - p.t < 650);
    if (pts.length < 5) return null;
    let mx = 0, my = 0;
    for (const p of pts) { mx += p.x; my += p.y; }
    mx /= pts.length; my /= pts.length;
    let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
    for (const p of pts) {
      const u = p.x - mx, v = p.y - my;
      Suu += u * u; Svv += v * v; Suv += u * v;
      Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u;
    }
    const det = Suu * Svv - Suv * Suv;
    if (Math.abs(det) < 1e-6) return null;
    const b1 = (Suuu + Suvv) / 2, b2 = (Svvv + Svuu) / 2;
    const cx = (b1 * Svv - b2 * Suv) / det + mx;
    const cy = (b2 * Suu - b1 * Suv) / det + my;
    const radii = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
    const R = radii.reduce((a, c) => a + c, 0) / radii.length;
    if (!isFinite(R) || R < 1 || R > 340) return null;
    let err = 0;
    for (const r of radii) err += Math.abs(r - R);
    err /= radii.length;
    let absTurn = 0, netTurn = 0;
    for (let i = 1; i < pts.length; i++) {
      const a0 = Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
      const a1 = Math.atan2(pts[i].y - cy, pts[i].x - cx);
      const d = wrap(a1 - a0);
      absTurn += Math.abs(d); netTurn += d;
    }
    const secs = Math.max(0.05, (pts[pts.length - 1].t - pts[0].t) / 1000);
    return { cx, cy, radius: R, speed: absTurn / secs,
             roundness: Math.max(0, 1 - err / Math.max(8, R * 0.5)),
             coherence: absTurn > 0.001 ? Math.abs(netTurn) / absTurn : 0,
             turned: absTurn, dir: Math.sign(netTurn) };
  }

  update(now, dt, near, touching, world) {
    const ch = innerHeight, cw = innerWidth, ox = cw / 2, oy = ch / 2;

    // keep the walls where the bowls are, in the simulation's own coordinates
    const rims = [];
    for (const b of this.bowls) {
      const sx = ox + (b.wx - world.x) * ch, sy = oy + (b.wy - world.y) * ch;
      b.sx = sx; b.sy = sy;
      if (near > 0.06 && sx > -200 && sx < cw + 200 && sy > -200 && sy < ch + 200)
        rims.push([sx / cw, 1 - sy / ch, b.r]);
    }
    this.surface.rims = rims;

    // a slow circle inside a bowl sets it singing and keeps it going
    const r = touching ? this.read(now) : null;
    const on = this.energy > 0.1;
    const held = r ? this.at(world.x + (r.cx - ox) / ch, world.y + (r.cy - oy) / ch) : null;
    const rubbing = !!r && !!held
      && r.coherence > (on ? 0.5 : 0.62) && r.roundness > (on ? 0.6 : 0.72)
      && r.turned > (on ? 0.4 : 0.62) && r.speed > (on ? 0.6 : 0.85);
    this.rubbing = rubbing;
    if (rubbing) {
      const push = Math.min(1, (r.speed - 0.6) / 9) * r.coherence * r.roundness;
      this.energy = Math.min(1, this.energy + push * dt * 1.5);
      this.inside = held;
      this.bright = Math.max(0, Math.min(1, (this.bright === undefined ? 0.5 : this.bright)
        + r.dir * dt * 0.22));
    } else {
      this.energy *= Math.pow(0.5, dt / 2.6);
    }
    if (this.energy < 0.02) this.inside = null;
    const level = this.energy * near;
    this.sound.setBowl(this.inside ? this.bowls.indexOf(this.inside) : -1,
                       level, this.bright === undefined ? 0.5 : this.bright);
    this.sound.setBowlDuck(Math.min(1, level * 1.5));

    // the fronts, carried at exactly the speed the water moves
    const step = this.surface.waveStep();
    for (const f of this.fronts) {
      f.r += step;
      if (near < 0.1) continue;
      for (let i = 0; i < this.bowls.length; i++) {
        if (f.rung.has(i)) continue;
        const b = this.bowls[i];
        if (f.held && f.held !== b) { f.rung.add(i); continue; }   // walled in
        const d = Math.hypot(b.wx - f.wx, b.wy - f.wy);
        if (f.r >= Math.max(0, d - b.r)) {
          f.rung.add(i);
          const level = Math.min(0.55, f.strength * 1.6 / (1 + d * 2.4)) * near;
          if (level > 0.014) this.ring(b, level, Math.max(-1, Math.min(1, (b.wx - world.x) * 2.2)));
        }
      }
    }
    this.fronts = this.fronts.filter(f => f.r < 2.4);

    // and how they look, standing there
    for (const b of this.bowls) {
      b.lit *= Math.pow(0.22, dt);
      const singing = this.inside === b ? this.energy : 0;
      const glow = Math.min(1, b.lit + singing);
      const px = b.r * 2 * ch;
      const on2 = near > 0.04 && b.sx > -px && b.sx < cw + px && b.sy > -px && b.sy < ch + px;
      b.el.style.display = on2 ? 'grid' : 'none';
      if (!on2) continue;
      b.el.style.width = b.el.style.height = px.toFixed(0) + 'px';
      b.el.style.transform = `translate(${b.sx.toFixed(0)}px, ${b.sy.toFixed(0)}px) translate(-50%, -50%)`;
      b.el.style.setProperty('--lit', glow.toFixed(3));
      b.el.style.opacity = (0.25 + near * 0.75).toFixed(2);
      mark({ k: 'bowl', x: b.sx, y: b.sy, r: px / 2, lit: glow, note: b.note,
             a: 0.25 + near * 0.75 });
    }
  }
}

// One Drop — the ice.
// Press and it cracks: arms run out from under your finger, wandering and
// branching, and the longer you hold the further they go and the lower the note
// when they settle. Cracks stay. A new one cannot cross an old one, so the sheet
// fills up and later cracks come out shorter, until it has had enough and gives
// way. Keep pressing after a crack has run as far as it can and the ice starts
// to melt instead, leaving a hole of open water that drips until it freezes shut.

import { mark } from './marks.js';

const SCALE = [0, 3, 5, 7, 10];
const ROOT = 174.61;                 // F3
const NOTES = [];
for (let o = 0; o < 3; o++) for (const s of SCALE) NOTES.push(o * 12 + s);

const MAX_ARM = 0.5;                 // how far one arm can run, in screen heights
const STEP = 0.0035;                 // how much it grows per frame: ~2.4s to full reach
const GIVE_WAY = 18;                 // total length the sheet can carry
const RUN = 0.55;                    // how fast a drip travels a crack, heights/sec
const HOP = 0.55;                    // what is left of it after each hole it passes
const FAINT = 0.16;                  // below this it has died out
const SEEK = 0.22;                   // how far off a hole will draw a crack to itself

// how many steps a crack runs before it turns
const kink = () => 7 + Math.floor(Math.random() * 22);

export class Ice {
  constructor(sound, surface, svgEl, holesEl, centre, radius) {
    this.sound = sound; this.surface = surface; this.svg = svgEl; this.holesEl = holesEl;
    this.cx = centre.x; this.cy = centre.y; this.r = radius;
    this.cracks = [];
    this.holes = [];
    this.press = null;
    this.total = 0;
    this.breaking = 0;
    this.pulses = [];
    this.wx = 0; this.wy = 0;
  }

  // ----- pressing -----
  beginPress(wx, wy) {
    if (this.breaking > 0) return null;
    const arms = 2 + Math.floor(Math.random() * 3);
    const a0 = Math.random() * Math.PI * 2;
    const crack = {
      el: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      branches: [], length: 0, lit: 1, fade: 1,
    };
    for (let i = 0; i < arms; i++) {
      const a = a0 + (i / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      crack.branches.push({ pts: [[wx, wy]], x: wx, y: wy, dir: a, alive: true, run: 0, hold: kink() });
    }
    crack.el.setAttribute('class', 'crack');
    this.svg.appendChild(crack.el);
    this.cracks.push(crack);
    this.press = { wx, wy, crack, since: 0, melting: null, sinceTick: 0 };
    return crack;
  }

  endPress() {
    const p = this.press;
    this.press = null;
    if (!p) return;
    for (const b of p.crack.branches) b.alive = false;
    this.settle(p.crack);
    // a press that went all the way leaves a hole where your finger was, and
    // every arm that reached another hole has just strung a line between them
    const origin = (p.melting && p.melting.r > 0.02) ? this.keepHole(p.melting) : null;
    const reached = p.crack.branches.filter(b => b.reached);
    for (const b of reached) this.join(origin, b.reached, b.pts, p.crack);
    for (let i = 0; i < reached.length; i++) {
      for (let j = i + 1; j < reached.length; j++) {
        this.join(reached[i].reached, reached[j].reached,
                  reached[i].pts.slice().reverse().concat(reached[j].pts), p.crack);
      }
    }
  }

  // a drip sets off along every crack leading out of this hole
  send(hole, energy, from) {
    if (energy < FAINT || this.pulses.length > 24) return;
    for (const l of hole.links) {
      if (l.to === from || l.to.now <= 0.004) continue;
      this.pulses.push({ path: l.path, i: 0, to: l.to, from: hole, e: energy,
                         crack: l.crack, rate: RUN / STEP, el: null });
    }
  }

  // what a hole sounds like, whether it dripped by itself or a drip reached it
  ring(hole, gain, near) {
    const s = this.sound;
    hole.lit = 1;
    if (!s.ready || !s.ctx) return;
    const pan = Math.max(-1, Math.min(1, (hole.wx - this.wx) * 2));
    const f = this.freqForHole(hole.now);
    const dest = s.ice;
    // the note itself, and a fifth above it a moment later: a hole answering itself
    s.soft(f, s.ctx.currentTime + 0.01, gain * 0.85 * near, pan, dest, 2.2);
    s.soft(f * 1.4983, s.ctx.currentTime + 0.055, gain * 0.3 * near, pan * -0.6, dest, 1.6);
    s.play('hit_droplet', gain * 0.3 * near, pan, 1.1 + Math.random() * 0.35);
  }

  // What does this point run into? A hole comes back as the hole itself, because
  // reaching one is not just a stop: it joins that hole to the crack. A crack
  // does not block itself: its arms all start from the one point your finger was
  // on, so they would stop each other dead before any had run anywhere.
  hitAt(x, y, own) {
    for (const h of this.holes) {
      if (Math.hypot(h.wx - x, h.wy - y) < h.now + 0.014) return h;
    }
    for (const c of this.cracks) {
      if (c === own) continue;
      for (const b of c.branches) {
        const pts = b.pts;
        for (let i = Math.max(0, pts.length - 400); i < pts.length; i++) {
          const q = pts[i];
          if (Math.abs(q[0] - x) < 0.011 && Math.abs(q[1] - y) < 0.011) return 'crack';
        }
      }
    }
    return null;
  }

  growCrack(crack, dt, now) {
    let grew = 0;
    const steps = Math.max(1, Math.round(dt * 60));
    for (let s = 0; s < steps; s++) {
      for (const b of crack.branches) {
        if (!b.alive) continue;
        // ice does not wander: it runs nearly straight and then turns all at once
        b.dir += (Math.random() - 0.5) * 0.06;
        if (--b.hold <= 0) {
          b.dir += (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.75);
          b.hold = kink();
        }
        // a hole is a weak point in the sheet, and a crack running near one bends
        // toward it rather than past it, which is how the web gets strung
        let pull = null, pd = SEEK;
        for (const h of this.holes) {
          const d = Math.hypot(h.wx - b.x, h.wy - b.y);
          if (d < pd) { pd = d; pull = h; }
        }
        if (pull) {
          const want = Math.atan2(pull.wy - b.y, pull.wx - b.x);
          const off = ((want - b.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          if (Math.abs(off) < 1.2) b.dir += off * 0.12;   // only if it was headed that way
        }
        const nx = b.x + Math.cos(b.dir) * STEP;
        const ny = b.y + Math.sin(b.dir) * STEP;
        // it stops at the edge of the sheet, at open water, or at an older crack
        if (Math.hypot(nx - this.cx, ny - this.cy) > this.r * 1.15 || b.run > MAX_ARM) {
          b.alive = false; continue;
        }
        const into = this.hitAt(nx, ny, crack);
        if (into) {
          b.alive = false;
          if (into !== 'crack') { b.reached = into; b.pts.push([into.wx, into.wy]); }
          continue;
        }
        b.x = nx; b.y = ny; b.run += STEP; b.pts.push([nx, ny]);
        crack.length += STEP; this.total += STEP; grew += STEP;
        // now and then an arm splits in two
        if (b.run > 0.08 && Math.random() < 0.004 && crack.branches.length < 6) {
          crack.branches.push({ pts: [[nx, ny]], x: nx, y: ny,
            dir: b.dir + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.6),
            alive: true, run: b.run * 0.5, hold: kink() });
          const sd = this.sound;
          if (sd.ready && sd.ctx) sd.grain('hit_icestab', 0.17, Math.max(-1, Math.min(1, (nx - this.cx) * 0.9)),
                                           1.1 + Math.random() * 0.5, 0.11, true);
        }
      }
    }
    return grew;
  }

  reach(crack) {
    let m = 0;
    for (const b of crack.branches) if (b.run > m) m = b.run;
    return Math.min(1, m / MAX_ARM);
  }

  // The sound of it running, in two parts. On top, the snapping: short pieces
  // cut from the transients of real ice, falling in pitch as the crack travels.
  // Under it, every few, the low groan of the sheet sliding against itself.
  tick(crack, pan) {
    const s = this.sound;
    if (!s.ready || !s.ctx) return;
    const t = this.reach(crack);
    s.grain('tex_icechitter', 0.2 + Math.random() * 0.14, pan,
            1.45 - t * 0.8 + Math.random() * 0.3, 0.045 + Math.random() * 0.06, true);
    if (Math.random() < 0.34) {
      s.grain('tex_iceslide', 0.11 + Math.random() * 0.07, pan * 0.6,
              1.05 - t * 0.35 + Math.random() * 0.15, 0.13 + Math.random() * 0.1);
    }
  }

  // when it stops, the sheet rings at a pitch set by how far the crack ran
  settle(crack) {
    const s = this.sound;
    if (!s.ready || !s.ctx || crack.length < 0.02) return;
    const t = this.reach(crack);
    const n = NOTES[Math.round((1 - t) * (NOTES.length - 1))];
    const freq = ROOT * Math.pow(2, n / 12);
    const pan = Math.max(-1, Math.min(1, (crack.branches[0].pts[0][0] - this.cx) * 1.1));
    s.strike(freq, s.ctx.currentTime + 0.01, 0.58 + t * 0.5, pan, s.master, 'hit_iceshot');
    s.play('hit_iceglass', 0.32 + t * 0.22, pan, 0.72 + (1 - t) * 0.55);
    if (this.total > GIVE_WAY) this.giveWay();
  }

  // too much of it is broken: the whole sheet goes, and then freezes over again
  giveWay() {
    const s = this.sound;
    if (s.ready && s.ctx) s.play('hit_icebreak', 0.5, 0, 0.85 + Math.random() * 0.2);
    this.breaking = 1;
    for (const c of this.cracks) c.going = true;
    for (const h of this.holes) h.closing = true;
    this.surface.drop(innerWidth / 2, innerHeight / 2, innerHeight * 0.4, 0.22, true);
    if (navigator.vibrate) { try { navigator.vibrate([18, 60, 30]); } catch {} }
  }

  // ----- holes -----
  keepHole(m) {
    const hole = { wx: m.wx, wy: m.wy, r: m.r, born: performance.now(),
                   life: 7000 + m.r * 120000, nextDrip: 0, lit: 0, links: [],
                   el: document.createElement('div') };
    hole.el.className = 'hole';
    this.holesEl.appendChild(hole.el);
    this.holes.push(hole);
    return hole;
  }

  // A crack that runs from one hole to another joins them, and the path it took
  // is the path a drip will take. Both ends get it, each with the way round it
  // would travel, so a drip can set off in either direction.
  join(a, b, pts, crack) {
    if (!a || !b || a === b) return;
    if (a.links.some(l => l.to === b)) return;
    const len = pts.length * STEP;
    a.links.push({ to: b, path: pts, len, crack });
    b.links.push({ to: a, path: pts.slice().reverse(), len, crack });
  }

  freqForHole(r) {
    const t = Math.max(0, Math.min(1, (r - 0.018) / 0.07));
    const n = NOTES[Math.round((1 - t) * (NOTES.length - 1))];
    return ROOT * 2 * Math.pow(2, n / 12);
  }

  // A hole can be closed on its own: touch the open water in one and it freezes
  // over from the edge in, while the rest of the sheet stays as you left it.
  closeAt(wx, wy) {
    for (const h of this.holes) {
      const r = h.now === undefined ? h.r : h.now;
      if (Math.hypot(h.wx - wx, h.wy - wy) < r + 0.02) {
        if (h.closing) return h;
        h.closing = true;
        const s = this.sound;
        if (s.ready && s.ctx) {
          const pan = Math.max(-1, Math.min(1, (h.wx - this.wx) * 2));
          // it goes up as it shuts, the way a bottle does as it fills
          s.soft(this.freqForHole(r), s.ctx.currentTime + 0.01, 0.3, pan, s.ice, 1.4);
          s.grain('tex_icechitter', 0.17, pan, 0.8, 0.14, true);
          s.play('hit_iceglass', 0.2, pan, 1.35);
        }
        return h;
      }
    }
    return null;
  }

  // let it all go and start again on clean ice
  refreeze() {
    for (const c of this.cracks) c.going = true;
    for (const h of this.holes) h.closing = true;
    for (const p of this.pulses) if (p.el) p.el.remove();
    this.pulses = [];
    this.breaking = 1; this.gentle = true;
    const s = this.sound;
    if (s.ready && s.ctx) s.play('hit_iceshot', 0.3, 0, 0.55);
  }

  update(world, near, dt, now) {
    const cw = innerWidth, ch = innerHeight, cx = cw / 2, cy = ch / 2;
    this.wx = world.x; this.wy = world.y;
    const show = near > 0.12;
    this.svg.style.opacity = show ? (0.35 + near * 0.55).toFixed(2) : 0;

    // the sheet giving way, and freezing over clean
    if (this.breaking > 0) {
      this.breaking -= dt * 0.45;
      if (this.breaking <= 0) {
        for (const c of this.cracks) c.el.remove();
        this.cracks = []; this.total = 0; this.breaking = 0; this.gentle = false;
      }
    }

    // a press: the crack runs, and when it has run as far as it can the ice melts
    if (this.press) {
      const p = this.press;
      p.since += dt;
      const grew = this.growCrack(p.crack, dt, now);
      p.crack.lit = 1;
      if (grew > 0) {
        p.sinceTick += grew;
        if (p.sinceTick > 0.03) {
          p.sinceTick = 0;
          this.tick(p.crack, Math.max(-1, Math.min(1, world.dx(p.wx) * 2)));
        }
      }
      if (grew === 0 || this.reach(p.crack) >= 1) {
        // the crack has run as far as it is going to; now the warmth of a
        // finger starts to tell, and the ice under it gives up
        if (!p.melting) p.melting = { wx: p.wx, wy: p.wy, r: 0.012 };
        p.melting.r = Math.min(0.05, p.melting.r + dt * 0.022);
        if (now > (this.meltSound || 0)) {
          this.meltSound = now + 430;
          if (this.sound.ready) this.sound.play('hit_droplet', 0.11, 0, 1.8 + Math.random() * 0.5);
        }
      }
    }

    // draw the cracks where they actually lie
    for (const c of this.cracks) {
      c.lit *= Math.pow(0.3, dt);
      if (c.going) c.fade -= dt * 0.5;
      if (!show) { c.el.setAttribute('d', ''); continue; }
      let d = '';
      const scr = [];
      for (const b of c.branches) {
        const pts = b.pts;
        if (pts.length < 2) continue;
        d += `M${(cx + world.dx(pts[0][0]) * ch).toFixed(1)},${(cy + world.dy(pts[0][1]) * ch).toFixed(1)}`;
        if (scr.length) mark({ k: 'crack', pts: scr.splice(0), w: 1 + c.lit * 1.6,
                               a: Math.max(0, Math.min(1, (0.62 + c.lit * 0.38) * c.fade)) });
        scr.push([cx + world.dx(pts[0][0]) * ch, cy + world.dy(pts[0][1]) * ch]);
        // every third point is plenty; the wander is finer than the eye needs
        for (let i = 2; i < pts.length; i += 3) {
          d += `L${(cx + world.dx(pts[i][0]) * ch).toFixed(1)},${(cy + world.dy(pts[i][1]) * ch).toFixed(1)}`;
          scr.push([cx + world.dx(pts[i][0]) * ch, cy + world.dy(pts[i][1]) * ch]);
        }
        const last = pts[pts.length - 1];
        d += `L${(cx + world.dx(last[0]) * ch).toFixed(1)},${(cy + world.dy(last[1]) * ch).toFixed(1)}`;
      }
      c.el.setAttribute('d', d);
      if (scr.length > 1) mark({ k: 'crack', pts: scr, w: 1 + c.lit * 1.6,
                                 a: Math.max(0, Math.min(1, (0.62 + c.lit * 0.38) * c.fade)) });
      c.el.style.opacity = Math.max(0, Math.min(1, (0.62 + c.lit * 0.38) * c.fade)).toFixed(2);
      c.el.style.strokeWidth = (1 + c.lit * 1.6).toFixed(2);
    }

    // the hole still opening under the finger
    const opening = this.press && this.press.melting;
    if (opening) {
      if (!this.openEl) {
        this.openEl = document.createElement('div');
        this.openEl.className = 'hole';
        this.holesEl.appendChild(this.openEl);
      }
      const px = opening.r * 2 * ch;
      const sx = cx + world.dx(opening.wx) * ch, sy = cy + world.dy(opening.wy) * ch;
      this.openEl.style.display = 'block';
      this.openEl.style.width = this.openEl.style.height = px.toFixed(0) + 'px';
      this.openEl.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
    } else if (this.openEl) { this.openEl.remove(); this.openEl = null; }

    // the holes that are already there: they drip, and they close over
    let openArea = 0;
    for (const h of this.holes) {
      const age = (now - h.born) / h.life;
      h.now = h.r * Math.max(0, 1 - age * age);
      openArea += h.now * h.now;
      const sx = cx + world.dx(h.wx) * ch, sy = cy + world.dy(h.wy) * ch;
      const px = h.now * 2 * ch;
      const on = show && px > 2 && sx > -px && sx < cw + px && sy > -px && sy < ch + px;
      h.el.style.display = on ? 'block' : 'none';
      if (on) {
        h.el.style.width = h.el.style.height = px.toFixed(0) + 'px';
        h.el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
        mark({ k: 'hole', x: sx, y: sy, r: px / 2, lit: h.lit, a: 1 });
      }
      h.lit *= Math.pow(0.08, dt);
      if (h.lit > 0.01) h.el.style.boxShadow =
        `0 0 0 1px rgba(196,228,244,${(0.5 + h.lit * 0.5).toFixed(2)}), 0 0 ${(18 + h.lit * 34).toFixed(0)}px rgba(150,206,236,${(0.3 + h.lit * 0.5).toFixed(2)})`;
      else if (h.wasLit) { h.el.style.boxShadow = ''; h.wasLit = false; }
      if (h.lit > 0.01) h.wasLit = true;
      if (show && now > h.nextDrip && h.now > 0.012) {
        h.nextDrip = now + (420 + h.now * 9000) * (0.75 + Math.random() * 0.5);
        this.ring(h, 0.3, near);
        this.send(h, 1, null);          // and it runs out along every crack from here
      }
    }
    // a drip travelling the cracks, and ringing whatever hole it arrives at
    for (const p of this.pulses) {
      p.i += p.rate * dt;
      if (p.crack) p.crack.lit = Math.max(p.crack.lit, p.e * 0.8);  // the crack lights as it passes
      const done = p.i >= p.path.length - 1;
      if (!done && show) {
        const q = p.path[Math.floor(p.i)];
        if (!p.el) {
          p.el = document.createElement('div');
          p.el.className = 'spark';
          this.holesEl.appendChild(p.el);
        }
        p.el.style.opacity = Math.min(1, p.e).toFixed(2);
        p.el.style.transform =
          `translate(${(cx + world.dx(q[0]) * ch).toFixed(0)}px, ${(cy + world.dy(q[1]) * ch).toFixed(0)}px) translate(-50%, -50%)`;
        mark({ k: 'spark', x: cx + world.dx(q[0]) * ch, y: cy + world.dy(q[1]) * ch,
               a: Math.min(1, p.e) });
      }
      if (done) {
        if (p.el) { p.el.remove(); p.el = null; }
        if (p.to.now > 0.004) {
          this.ring(p.to, 0.26 * p.e, near);
          this.send(p.to, p.e * HOP, p.from);     // and on through the rest of the web
        }
        p.spent = true;
      }
    }
    this.pulses = this.pulses.filter(p => !p.spent);

    this.holes = this.holes.filter(h => {
      if (h.closing) h.r *= Math.pow(0.06, dt);
      if (h.now > 0.004) return true;
      h.el.remove();
      for (const o of this.holes) o.links = o.links.filter(l => l.to !== h);
      return false;
    });
    this.sound.setMelt(Math.min(1, openArea * 90) * near);
  }
}

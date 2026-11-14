// One Drop — the cycle.
// A single drop floats in the cove. Touch it and you go with it: up, across,
// down, along, out, and back here. You never stop being water, so the surface
// never has to stop being the surface; only what it is made of changes.

const STAGES = [
  { key: 'still', fig: '<path d="M8 50 h104"/><circle cx="60" cy="50" r="7"/><circle cx="60" cy="50" r="16"/><circle cx="60" cy="50" r="26"/><path d="M60 18 c0 0 -5 7 -5 11 a5 5 0 0 0 10 0 c0 -4 -5 -11 -5 -11 z"/>', secs: 11,
    line: 'One drop. It has been here longer than the valley has.',
    s: { w: { cove: 1 }, drops: [2600, 0.05, 20], damp: 0.994 } },

  { key: 'rising', fig: '<path d="M8 62 h104"/><circle cx="96" cy="18" r="9"/><path d="M96 4 v-3M96 35 v3M82 18 h-3M113 18 h3"/><path d="M26 56 c6 -8 -6 -14 0 -22 c6 -8 -6 -14 0 -22"/><path d="M46 58 c6 -8 -6 -14 0 -22 c6 -8 -6 -14 0 -22"/><path d="M66 60 c6 -8 -6 -14 0 -22"/>', secs: 15,
    line: 'The sun takes it. No sound, no weight, nothing left behind.',
    s: { pale: 0.8, daylight: 1, warm: 0.4, w: { cove: 0.3 }, lift: -0.055,
         drops: [1700, 0.03, 10], damp: 0.9975 } },

  { key: 'cloud', fig: '<path d="M34 46 a13 13 0 0 1 2 -26 a18 18 0 0 1 34 -4 a14 14 0 0 1 16 16 a11 11 0 0 1 -4 14 z"/><circle cx="40" cy="30" r="2.4"/><circle cx="54" cy="24" r="2.4"/><circle cx="66" cy="32" r="2.4"/><circle cx="56" cy="37" r="2.4"/><path d="M30 58 v8M46 60 v9M62 58 v8M78 60 v9"/>', secs: 15,
    line: 'A mile up, with a thousand others, cold enough to hold together.',
    s: { pale: 1, daylight: 0.85, w: {}, lift: -0.02, drift: 0.05,
         drops: [900, 0.02, 9], damp: 0.9985 } },

  { key: 'falling', fig: '<path d="M16 8 l-5 14M34 6 l-5 16M52 10 l-5 14M70 6 l-5 16M88 10 l-5 14"/><path d="M26 56 c18 -22 52 -24 70 -6 c-20 18 -54 16 -70 6 z"/><path d="M26 56 c22 -4 46 -8 70 -6"/><path d="M96 50 l14 16"/>', secs: 14,
    line: 'Then it is heavy again, and falls, and lands on a leaf.',
    s: { pale: 0.25, storm: 1, churn: 1, daylight: 0.4, w: { rain: 1 }, lift: 0.12,
         drops: [70, 0.11, 13], damp: 0.991 } },

  { key: 'stream', fig: '<path d="M10 16 c22 10 6 22 26 30 c20 8 10 20 30 24 c16 3 28 -2 44 -8"/><ellipse cx="38" cy="38" rx="9" ry="6"/><ellipse cx="66" cy="54" rx="11" ry="7"/><ellipse cx="22" cy="60" rx="7" ry="5"/>', secs: 14,
    line: 'Down the leaf, into the creek, under the stones. Always the lowest way.',
    s: { w: { river: 1 }, daylight: 0.55, flow: 0.55, drift: 0.22,
         drops: [320, 0.07, 11], damp: 0.9935 } },

  { key: 'ocean', fig: '<path d="M6 14 c14 -8 26 8 40 0 c14 -8 26 8 40 0 c10 -6 18 2 28 0"/><path d="M6 30 c14 -8 26 8 40 0 c14 -8 26 8 40 0"/><path d="M10 48 h100M18 62 h84M30 74 h60"/><path d="M60 20 v40M60 60 l-5 -7M60 60 l5 -7"/>', secs: 16,
    line: 'A river, then salt, then dark, and no hurry at all.',
    s: { w: { deep: 1 }, daylight: 0.15, swell: true,
         drops: [1500, 0.05, 90], damp: 0.9965 } },

  { key: 'ice', fig: '<path d="M6 46 h108"/><path d="M6 46 l12 -14 l14 10 l16 -16 l18 14 l16 -12 l14 12 l18 -8"/><path d="M40 20 v-12M34 12 l6 -4 l6 4M78 26 v-14M72 18 l6 -4 l6 4"/><path d="M20 58 h18M50 62 h22M84 58 h16"/>', secs: 13,
    line: 'Somewhere it freezes and waits a hundred years.',
    s: { frost: 1, daylight: 0.5, w: { deep: 0.3 }, damp: 0.99985,
         drops: [4200, 0.02, 14] } },

  { key: 'return', fig: '<path d="M8 54 h104"/><circle cx="56" cy="54" r="9"/><circle cx="56" cy="54" r="19"/><circle cx="56" cy="54" r="30"/><path d="M56 14 c0 0 -6 9 -6 14 a6 6 0 0 0 12 0 c0 -5 -6 -14 -6 -14 z"/>', secs: 13,
    line: 'And it comes back here, to this water, under your hand.',
    s: { w: { cove: 1 }, drops: [2200, 0.06, 22], damp: 0.994 } },
];

const lerp = (a, b, k) => a + (b - a) * k;

export class Story {
  constructor(sound, surface, dropEl, lineEl, figEl) {
    this.sound = sound; this.surface = surface; this.dropEl = dropEl; this.lineEl = lineEl;
    this.figEl = figEl;
    this.active = false;
    this.wx = 1.15; this.wy = 0.85;   // open water, clear of everything else
    this.i = 0; this.t = 0;
    this.cur = { pale: 0, frost: 0, storm: 0, churn: 0, daylight: 0, warm: 0, damp: 0.994,
                 w: { cove: 1, rain: 0, river: 0, deep: 0, hollow: 0 } };
    this.nextDrop = 0;
  }

  begin() {
    if (this.active) return;
    this.active = true;
    this.i = 0; this.t = 0; this.nextDrop = 0;
    this.dropEl.classList.add('gone');
    document.body.classList.add('cycling');
    const arrived = document.getElementById('arrived');
    if (arrived) arrived.classList.remove('show');   // one thing to read at a time
    this.say(STAGES[0].line, STAGES[0].fig);
  }

  end() {
    this.active = false;
    document.body.classList.remove('cycling');
    this.dropEl.classList.remove('gone');
    this.lineEl.style.opacity = 0;
    if (this.figEl) { this.figEl.style.opacity = 0; this.figEl.innerHTML = ''; }
    this.surface.pale = 0; this.surface.frost = 0;
  }

  // the line, and a drawing of what is happening to the water
  say(text, fig) {
    this.lineEl.textContent = text;
    this.lineEl.style.opacity = 0.92;
    if (!this.figEl) return;
    if (fig) {
      this.figEl.innerHTML = '<svg viewBox="0 0 120 80">' + fig + '</svg>';
      this.figEl.style.opacity = 1;
      // sit it above the line, however many lines the line turns out to be
      const top = this.lineEl.getBoundingClientRect().top;
      if (top > 1) this.figEl.style.bottom = Math.round(innerHeight - top + 16) + 'px';
    } else { this.figEl.style.opacity = 0; }
  }

  // where the waiting drop sits on screen, and whether it can be touched.
  // Nothing of the water's own shows before you have woken it.
  place(world, near, awake = true) {
    // it waits in open water, so it shows whenever it is on screen
    const sx = innerWidth / 2 + world.dx(this.wx) * innerHeight;
    const sy = innerHeight / 2 + world.dy(this.wy) * innerHeight;
    const on = awake && !this.active &&
               sx > -40 && sx < innerWidth + 40 && sy > -40 && sy < innerHeight + 40;
    this.dropEl.style.display = on ? 'grid' : 'none';
    if (on) {
      this.dropEl.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
      this.dropEl.style.opacity = '0.9';
    }
  }

  // Stepping through it by hand, for when you want to look at one part of it
  // rather than wait the whole way round.
  step(d) {
    if (!this.active) return;
    const i = this.i + d;
    if (i < 0) return;
    if (i >= STAGES.length) { this.end(); return; }
    this.i = i; this.t = 0;
    this.lineEl.style.opacity = 0.92;
    this.say(STAGES[i].line, STAGES[i].fig);
  }
  at() { return { i: this.i, of: STAGES.length }; }

  // Drives everything while it runs: the look of the water, what you can hear,
  // and how the surface itself behaves.
  update(dt, now, world, smoothW) {
    if (!this.active || this.i >= STAGES.length) return false;
    const st = STAGES[this.i];
    this.t += dt;
    // the line arrives with the stage and leaves before the next one
    const fade = st.secs - this.t;
    if (fade < 2.2) this.lineEl.style.opacity = Math.max(0, fade / 2.2 * 0.92).toFixed(3);
    if (this.t > st.secs) {
      this.i++;
      if (this.i >= STAGES.length) { this.end(); return false; }
      this.t = 0;
      this.say(STAGES[this.i].line, STAGES[this.i].fig);
    }
    const g = STAGES[this.i].s;
    const k = Math.min(1, dt * 0.55);          // everything arrives slowly
    const c = this.cur;
    c.pale = lerp(c.pale, g.pale || 0, k);
    c.frost = lerp(c.frost, g.frost || 0, k);
    c.storm = lerp(c.storm, g.storm || 0, k);
    c.churn = lerp(c.churn, g.churn || 0, k);
    c.daylight = lerp(c.daylight, g.daylight === undefined ? 0.2 : g.daylight, k);
    c.warm = lerp(c.warm, g.warm || 0, k);
    c.damp = lerp(c.damp, g.damp || 0.994, k);
    for (const key of ['cove', 'rain', 'river', 'deep', 'hollow', 'ice']) {
      c.w[key] = lerp(c.w[key] || 0, (g.w && g.w[key]) || 0, k);
      smoothW[key] = c.w[key];                 // the rest of the app follows these
    }

    const S = this.surface;
    S.pale = c.pale; S.frost = c.frost;
    S.storm = c.storm; S.churn = c.churn;
    S.daylight = c.daylight; S.warm = c.warm; S.moon = 1;
    S.damp = c.damp;
    S.region[0] = c.w.rain; S.region[1] = c.w.river;
    S.region[2] = c.w.cove; S.region[3] = c.w.deep;
    S.hollow = c.w.hollow;

    // the drop is carried: up through the air, down with the rain, along with the stream
    if (g.lift) { world.y += g.lift * dt; S.shift[1] -= g.lift * dt * innerHeight; }
    if (g.flow) { S.shift[0] -= g.flow * dt * innerHeight; world.x += g.flow * dt * 0.35; }
    if (g.drift) { world.x += g.drift * dt * 0.4; S.shift[0] -= g.drift * dt * 0.4 * innerHeight; }

    // and the water keeps moving in whatever way that stage moves
    if (g.drops && now > this.nextDrop) {
      const [gap, strength, size] = g.drops;
      this.nextDrop = now + gap * (0.5 + Math.random());
      const x = innerWidth * Math.random(), y = innerHeight * Math.random();
      S.drop(x, y, size * (0.6 + Math.random() * 0.8), strength * (0.6 + Math.random() * 0.8));
    }
    if (g.swell && now > (this.nextSwell || 0)) {
      this.nextSwell = now + 3200 + Math.random() * 2600;
      S.drop(innerWidth * Math.random(), innerHeight * Math.random(), innerHeight * 0.5, 0.05);
    }
    return true;
  }
}

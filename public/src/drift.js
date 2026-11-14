// One Drop — what does not belong.
// Now and then something drifts in that is not water. You can lift it out. Each
// one has a line attached to it, said once and then let go.
//
// The lines are checked, not invented. Sources, for anyone who asks:
//   rivers and plastic   theoceancleanup.com/updates/quantifying-global-plastic-inputs-from-rivers-into-oceans/
//   riparian buffers     extension.umn.edu/agroforestry/riparian-buffers

// Each kind of thing has its own lines. They are drawn without repeating until
// that kind has nothing left to say, so you are not told the same thing twice in
// an afternoon. The facts are checked, not invented; sources at the top of file.
import { mark } from './marks.js';

const LINES = {
  plastic: [
    'Rivers carry somewhere between one and three million tonnes of plastic to the sea every year. All of it was dropped on land first.',
    'This will outlast everyone who ever touched it.',
    'Just over a thousand rivers carry most of it. Small ones, running through towns.',
    'It does not rot so much as break up, into pieces too small to pick out again.',
    'Out here it is rubbish. Caught in your hand it is just a thing somebody put down.',
  ],
  sheen: [
    'A few drops spread into a sheen you could measure in metres.',
    'Most of the oil that reaches water never came from a spill. It washed off a road.',
    'The rainbow is the thinnest part of it: light split by a film a few molecules thick.',
    'It sits on the surface, which is exactly where everything breathes.',
  ],
  foam: [
    'Fertiliser that missed the lawn ends up here, and feeds this.',
    'What grows on the surface takes the oxygen from everything underneath it.',
    'A bloom can turn clear water to soup in a week, and take all summer to clear.',
    'Nothing here is poisoned. There is just too much of something that belonged in small amounts.',
  ],
  line: [
    'Fishing line stays long after the knot is forgotten.',
    'It is invisible in water. That is the point of it, and the trouble with it.',
    'Birds find it before people do.',
  ],
  can: [
    'Aluminium comes back as aluminium, over and over. Carry it home wet.',
    'It would have been here in eighty years. It is in your hand instead.',
  ],
};
const KINDS = Object.keys(LINES);

// said instead of the usual line when you reach a round number
const MILESTONES = {
  5:  'Five things out of the water.',
  10: 'A band of trees along a bank holds the soil and keeps the water cold enough for trout.',
  25: 'Thirty-five feet of planting along a stream is the least that does any good. A hundred feet is better.',
  50: 'Fifty. None of this was ever one person\u2019s job, and here you are anyway.',
  100: 'A hundred things. The water is not keeping score, but somebody should.',
};

export class Drift {
  constructor(sound, surface, layerEl, lineEl) {
    this.sound = sound; this.surface = surface; this.layer = layerEl; this.lineEl = lineEl;
    this.items = [];
    this.clarity = 1;
    this.next = performance.now() + 25000 + Math.random() * 40000;
    this.lifted = Number(localStorage.getItem('onedrop.lifted') || 0);
    this.lineUntil = 0;
    this.queues = {};       // what each kind still has left to say
  }

  // one line at a time, and never the same one twice until the rest have had a turn
  lineFor(kind) {
    let q = this.queues[kind];
    if (!q || !q.length) {
      q = LINES[kind].slice();
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      this.queues[kind] = q;
    }
    return q.pop();
  }

  spawn(world, now) {
    const t = { kind: KINDS[Math.floor(Math.random() * KINDS.length)] };
    const ang = Math.random() * Math.PI * 2;
    const el = document.createElement('div');
    el.className = 'thing ' + t.kind;
    el.innerHTML = PARTS[t.kind] || '<i></i>';
    el.style.setProperty('--spin', (Math.random() * 360).toFixed(0) + 'deg');
    if (t.kind === 'plastic') el.style.setProperty('--torn', tornEdge());
    this.layer.appendChild(el);
    const item = {
      ...t, el,
      wx: world.at(world.x + Math.cos(ang) * 0.75),
      wy: world.at(world.y + Math.sin(ang) * 0.75),
      vx: (Math.random() - 0.5) * 0.012,
      vy: (Math.random() - 0.5) * 0.012,
      born: now, size: 26 + Math.random() * 16,
    };
    el.addEventListener('pointerdown', e => { e.stopPropagation(); this.lift(item); });
    this.items.push(item);
  }

  lift(item) {
    if (item.going) return;
    item.going = true;
    item.el.classList.add('lifting');
    const r = item.el.getBoundingClientRect();
    if (r.width) this.surface.drop(r.left + r.width / 2, r.top + r.height / 2, 20, 0.2);
    const s = this.sound;
    if (s.ready && s.ctx) s.soft(196 * Math.pow(2, Math.floor(Math.random() * 3) / 3), s.ctx.currentTime + 0.02, 0.3, 0, s.master);
    setTimeout(() => { item.el.remove(); this.items = this.items.filter(i => i !== item); }, 900);
    this.clarity = Math.min(1, this.clarity + 0.14);
    this.lifted++;
    try { localStorage.setItem('onedrop.lifted', String(this.lifted)); } catch {}
    // the line comes when it is lifted, not when it drifts in
    this.say(MILESTONES[this.lifted] || this.lineFor(item.kind));
    if (this.onLift) this.onLift(this.lifted);
    if (navigator.vibrate) { try { navigator.vibrate(14); } catch {} }
  }

  say(text) {
    this.lineEl.textContent = text;
    this.lineEl.style.opacity = 0.92;
    this.lineUntil = performance.now() + 7000;
  }

  update(world, dt, now, storm) {
    // a storm washes things in; otherwise they arrive rarely
    if (now > this.next) {
      this.next = now + 40000 + Math.random() * 70000;
      if (this.items.length < 4 && Math.random() < 0.55 + storm * 0.4) this.spawn(world, now);
    }
    const cw = innerWidth, ch = innerHeight;
    for (const it of this.items) {
      it.wx += it.vx * dt; it.wy += it.vy * dt;
      const sx = cw / 2 + world.dx(it.wx) * ch, sy = ch / 2 + world.dy(it.wy) * ch;
      const on = sx > -80 && sx < cw + 80 && sy > -80 && sy < ch + 80;
      it.el.style.display = on ? 'grid' : 'none';
      if (on) {
        it.el.style.width = it.el.style.height = it.size + 'px';
        it.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
        mark({ k: 'thing', x: sx, y: sy, r: it.size / 2, rot: Math.random() * 0.02,
               rgb: ({ plastic: '206,206,198', sheen: '150,140,190', foam: '214,226,220',
                       line: '198,210,214', can: '176,184,190' })[it.kind],
               a: it.going ? 0.3 : 0.75 });
      }
    }
    // the water dulls while things are left in it, and clears as they are taken out
    const want = Math.max(0.45, 1 - this.items.filter(i => !i.going).length * 0.16);
    this.clarity += (want - this.clarity) * Math.min(1, dt * 0.12);
    if (this.lineUntil && now > this.lineUntil) { this.lineEl.style.opacity = 0; this.lineUntil = 0; }
  }
}

// every scrap is torn differently
function tornEdge() {
  const n = 7 + Math.floor(Math.random() * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const r = 0.30 + Math.random() * 0.2;
    pts.push(`${(50 + Math.cos(a) * r * 100).toFixed(0)}% ${(50 + Math.sin(a) * r * 100).toFixed(0)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

const PARTS = {
  plastic: '<i></i>',
  sheen:   '<i></i>',
  foam:    '<i></i><i class="b"></i><i class="c"></i>',
  line:    '<svg viewBox="0 0 40 40"><path d="M6 24 C12 8 20 34 26 16 C30 6 36 14 34 24"/></svg>',
  can:     '<i></i>',
};

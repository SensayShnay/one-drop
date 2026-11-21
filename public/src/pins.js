// One Drop — pins.
// Sounds left on the water. Each floats at a fixed place in the world; drift near
// and it surfaces.
//
// Nothing here is kept between visits. There used to be a store on the device,
// but a save that fails is invisible, and Safari throws the whole store away
// after a week without a visit, so what looked like keeping was really a slow
// way of losing. A pin lasts as long as the page does; keeping one for good is a
// job for the shared water, when there is one.

import { mark } from './marks.js';

// Two pins are here from the start, so the water is never empty.
const SEEDED = [
  { id: 'seed-pond', name: 'a pond at dusk', file: 'bed_pond', wx: 0.08, wy: 0.62, seeded: true },
  { id: 'seed-spring', name: 'a spring',     file: 'tex_pouring', wx: -0.10, wy: -0.68, seeded: true },
];

export class Pins {
  constructor(sound, surface, layerEl) {
    this.sound = sound;
    this.surface = surface;
    this.layer = layerEl;
    this.pins = [];       // {id, name, wx, wy, blob?, file?, el, buffer, node, gain, pan, playing}
    this.onHold = null;   // callback(pin) when one is held down long enough to dissolve
  }

  load() {
    for (const p of SEEDED) this.attach({ ...p });
  }

  forget(pin) {
    this.detach(pin);
  }

  attach(pin) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = '<i></i><em></em>';
    el.querySelector('em').textContent = pin.name || '';
    this.layer.appendChild(el);
    pin.el = el;
    pin.near = 0;
    this.pins.push(pin);

    // tap to hear it up close; drag to move it; hold to let it dissolve
    let holdTimer = 0, held = false, downAt = 0, drag = null;
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      downAt = performance.now(); held = false;
      drag = { ox: e.clientX, oy: e.clientY, moved: 0, wx: pin.wx, wy: pin.wy };
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('holding');
      holdTimer = setTimeout(() => {
        held = true;
        el.classList.add('dissolving');
        if (navigator.vibrate) try { navigator.vibrate(24); } catch {}
        setTimeout(() => this.forget(pin), 450);
      }, 1300);
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.ox, dy = e.clientY - drag.oy;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (drag.moved < 7) return;
      // once it is moving it is being carried, not tapped or held
      clearTimeout(holdTimer);
      el.classList.remove('holding');
      el.classList.add('carrying');
      pin.wx = drag.wx + dx / innerHeight;
      pin.wy = drag.wy + dy / innerHeight;
    });
    const up = e => {
      e && e.stopPropagation();
      clearTimeout(holdTimer);
      el.classList.remove('holding', 'carrying');
      const moved = drag && drag.moved >= 7;
      drag = null;
      if (moved) return;
      if (!held && performance.now() - downAt < 1300) this.touch(pin);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { clearTimeout(holdTimer); el.classList.remove('holding'); });
    return pin;
  }

  detach(pin) {
    if (pin.node) { try { pin.node.stop(); } catch {} pin.node = null; }
    if (pin.el && pin.el.parentNode) pin.el.parentNode.removeChild(pin.el);
    this.pins = this.pins.filter(p => p !== pin);
  }

  add(blob, name, wx, wy) {
    return this.attach({
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || '', wx, wy, blob, created: Date.now(),
    });
  }

  // A pin carries a real recording, so it ought to be possible to take it with
  // you. Seeded pins are part of the app rather than yours, so they have nothing
  // to hand over.
  download(pin) {
    if (!pin.blob) return false;
    const ext = ({ 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
                   'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
                   'video/webm': 'webm', 'audio/aac': 'aac', 'audio/flac': 'flac' })[pin.blob.type]
                 || (pin.blob.type.split('/')[1] || 'webm').split(';')[0];
    const stem = (pin.name || 'a sound from the water')
      .replace(/[^\w \-]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'pin';
    const url = URL.createObjectURL(pin.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${stem}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  }

  moveTo(pin, wx, wy) {
    pin.wx = wx; pin.wy = wy;
  }

  rename(pin, name) {
    pin.name = name;
    pin.el.querySelector('em').textContent = name;
  }

  // resolve the sound for a pin, once, on demand
  async buffer(pin) {
    if (pin.buffer) return pin.buffer;
    if (pin._loading) return null;
    pin._loading = true;
    try {
      if (pin.file) pin.buffer = await this.sound.load(pin.file);
      else if (pin.blob) {
        const data = await pin.blob.arrayBuffer();
        pin.buffer = await new Promise((ok, fail) => this.sound.ctx.decodeAudioData(data, ok, fail));
      }
    } catch (e) { console.warn('pins: could not decode', pin.id, e); pin.broken = true; }
    pin._loading = false;
    return pin.buffer;
  }

  // a tap: hear it clearly for a moment
  async touch(pin) {
    const buf = await this.buffer(pin);
    if (!buf || !this.sound.ctx) return;
    const ctx = this.sound.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.3);
    src.connect(g).connect(this.sound.master);
    src.start();
    src.stop(ctx.currentTime + Math.min(buf.duration, 12));
    g.gain.setValueAtTime(0.7, ctx.currentTime + Math.min(buf.duration, 12) - 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + Math.min(buf.duration, 12));
    const r = pin.el.getBoundingClientRect();
    this.surface.drop(r.left + r.width / 2, r.top + r.height / 2, 26, 0.22);
  }

  // called every frame: place the pins, fade their sound by how close you are
  update(world, dt, now) {
    const cw = innerWidth, ch = innerHeight;
    const cx = cw / 2, cy = ch / 2;
    for (const pin of this.pins) {
      const dx = world.dx(pin.wx), dy = world.dy(pin.wy);
      const d = Math.hypot(dx, dy);
      const sx = cx + dx * ch, sy = cy + dy * ch;
      const m = 22;
      const onScreen = sx > m && sx < cw - m && sy > m && sy < ch - m;
      const near = 1 - Math.min(1, Math.max(0, (d - 0.25) / 1.0));
      pin.near += (near - pin.near) * Math.min(1, dt * 2);
      if (onScreen) {
        pin.el.style.display = 'grid';
        pin.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
        pin.el.style.opacity = (0.3 + pin.near * 0.7).toFixed(2);
        mark({ k: 'pin', x: sx, y: sy, r: 4 + pin.near * 3,
               lit: pin.near, a: 0.3 + pin.near * 0.7 });
        pin.el.classList.toggle('close', pin.near > 0.55);
        pin.el.classList.remove('far', 'warm');
      } else if (d < 3.2) {
        // out of sight but not out of reach: a glint at the edge, pointing the way
        const ux = dx / (d || 1e-6), uy = dy / (d || 1e-6);
        const k = Math.min((cw / 2 - m) / Math.abs(ux || 1e-6), (ch / 2 - m) / Math.abs(uy || 1e-6));
        pin.el.style.display = 'grid';
        pin.el.style.transform = `translate(${(cx + ux * k).toFixed(1)}px, ${(cy + uy * k).toFixed(1)}px) translate(-50%, -50%)`;
        pin.el.style.opacity = Math.max(0.05, 0.1 + 0.62 * (1 - Math.min(1, d / 1.4))).toFixed(2);
        pin.el.classList.add('far');
        pin.el.classList.toggle('warm', d < 0.5); // right there, just past the frame
        pin.el.classList.remove('close');
      } else {
        pin.el.style.display = 'none';
      }
      if (pin.broken) continue;

      // sound: starts when you're within reach, fades with distance
      const want = d < 1.25;
      if (want && !pin.node && this.sound.ctx && this.sound.ready) this.start(pin);
      if (pin.node) {
        const level = Math.pow(Math.max(0, 1 - Math.max(0, d - 0.2) / 1.05), 1.6);
        pin.gain.gain.setTargetAtTime(level * 0.55, this.sound.ctx.currentTime, 0.4);
        if (pin.pan) pin.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, dx * 1.2)), this.sound.ctx.currentTime, 0.4);
        if (d > 1.6) { const n = pin.node; pin.node = null; setTimeout(() => { try { n.stop(); } catch {} }, 900); }
      }
      // a pin at rest still troubles the water a little
      if (onScreen && pin.near > 0.25 && now > (pin.nextRipple || 0)) {
        pin.nextRipple = now + 1600 + Math.random() * 2600;
        this.surface.drop(sx, sy, 10 + Math.random() * 14, 0.02 + pin.near * 0.035);
      }
    }
  }

  async start(pin) {
    const buf = await this.buffer(pin);
    if (!buf || pin.node || !this.sound.ctx) return;
    const ctx = this.sound.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(g);
    if (p) g.connect(p).connect(this.sound.master); else g.connect(this.sound.master);
    src.start(ctx.currentTime, Math.random() * Math.max(0.01, buf.duration - 0.1));
    pin.node = src; pin.gain = g; pin.pan = p;
  }
}

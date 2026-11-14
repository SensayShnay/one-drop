// One Drop — sound.
// Web Audio. Nothing plays until the first touch unlocks the context.

// What the water plays by itself. Splash and the two swishes are deliberately
// absent: they only sound when a sequencer track is set to them.
const HITS = {
  tiny:   ['hit_droplet', 'hit_drop'],
  small:  ['hit_drop', 'hit_drop135', 'hit_drips_short'],
  medium: ['hit_bubbles', 'hit_spacedrops'],
  big:    ['hit_deepsplash', 'hit_lunge'],
};
// looping layers, keyed by what drives them
const LAYERS = {
  cove:    { file: 'bed_pier',       level: 0.52 },  // water against stone, the sound of home
  rain:    { file: 'tex_drops',      level: 0.76 },  // the rain itself, and under the harp it is the whole weather
  river:   { file: 'tex_moves',      level: 0.50 },  // only when the water is being moved
  pour:    { file: 'tex_pouring',    level: 0.30 },
  deep:    { file: 'bed_underwater', level: 0.50 },
  cavedrips: { file: 'tex_cavedrips', level: 0.34 },   // the only thing heard in the hollow
  ice:       { file: 'bed_ice',       level: 0.46 },   // cold wind, and the sheet working against itself
  icemelt:   { file: 'tex_icemelt',   level: 0.34 },   // only once there is open water
  creek:     { file: 'bed_creek',     level: 0.38 },   // chimes carried along by shallow water
  // Snow deadens everything it falls on, so the snowfield is nearly silent: a
  // thin cold wind a long way off, and otherwise only what the flakes say.
  snow:      { file: 'bed_ice',       level: 0.20 },
  // There used to be a pond bed and a bed of keys under the rain harp. Both are
  // gone: under the rain there should be rain, and then only what the leaves say.
};

export class Sound {
  // the five bowls, in pitch order; each was tuned to its own named note, since
  // a real bowl is not made to A440 and these five did not agree with each other
  static BOWLS = [
    { note: 'G', file: 'bowl_g' },
    { note: 'B', file: 'bowl_b' },
    { note: 'C', file: 'bowl_c' },
    { note: 'D', file: 'bowl_d' },
    { note: 'F', file: 'bowl_f' },
  ];

  constructor(base = './audio/') {
    this.base = base;
    this.ctx = null;
    this.buffers = new Map();
    this.layers = new Map();
    this.ready = false;
  }

  // Must be called from a user gesture.
  async wake() {
    if (this.ctx) { if (this.ctx.state !== 'running') await this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const silent = this.ctx.createBufferSource();
    silent.buffer = this.ctx.createBuffer(1, 1, 22050);
    silent.connect(this.ctx.destination); silent.start(0);
    await this.ctx.resume();

    // master chain: everything -> submerge (lowpass) -> soft limiter -> out
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.submerge = this.ctx.createBiquadFilter();
    this.submerge.type = 'lowpass'; this.submerge.frequency.value = 18000; this.submerge.Q.value = 0.6;
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.25;
    // cavern: a generated stone-room reverb, mixed in more the deeper you go
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeCavern(3.2, 2.4);
    this.wet = this.ctx.createGain(); this.wet.gain.value = 0.12;
    this.master.connect(this.submerge);
    this.submerge.connect(this.comp);
    this.submerge.connect(this.reverb).connect(this.wet).connect(this.comp);
    // chorus: two slowly wandering delay lines, spread left and right
    this.chorusWet = this.ctx.createGain(); this.chorusWet.gain.value = 0;
    this.chorusVoices = [
      { delay: 0.014, rate: 0.33, depth: 0.0032, pan: -0.75 },
      { delay: 0.023, rate: 0.47, depth: 0.0021, pan: 0.75 },
    ].map(v => {
      const d = this.ctx.createDelay(0.1); d.delayTime.value = v.delay;
      const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = v.rate;
      const amt = this.ctx.createGain(); amt.gain.value = v.depth;
      lfo.connect(amt).connect(d.delayTime); lfo.start();
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      this.submerge.connect(d);
      if (pan) { pan.pan.value = v.pan; d.connect(pan).connect(this.chorusWet); } else d.connect(this.chorusWet);
      return { d, lfo, amt };
    });
    this.chorusWet.connect(this.comp);
    this.comp.connect(this.ctx.destination);
    // every looping bed runs through here, so the ambience can be set aside
    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = this.ambientOff ? 0 : 1;
    this.ambientBus.connect(this.master);
    // the sequencer has its own bus so it can fade with the region
    this.seqBus = this.ctx.createGain(); this.seqBus.gain.value = 0;
    this.seqBus.connect(this.master);
    // echo: a tempo-synced feedback delay on the sequencer, dark like a cave wall
    this.echoDelay = this.ctx.createDelay(2); this.echoDelay.delayTime.value = (60 / 68) * 0.75;
    this.echoFilt = this.ctx.createBiquadFilter(); this.echoFilt.type = 'lowpass'; this.echoFilt.frequency.value = 2200;
    this.echoFb = this.ctx.createGain(); this.echoFb.gain.value = 0.25;
    this.echoWet = this.ctx.createGain(); this.echoWet.gain.value = 0;
    this.seqBus.connect(this.echoDelay);
    this.echoDelay.connect(this.echoFilt);
    this.echoFilt.connect(this.echoFb).connect(this.echoDelay);
    this.echoFilt.connect(this.echoWet).connect(this.master);

    // one missing file should not take the rest of the water down with it
    const hitNames = [...new Set(Object.values(HITS).flat())];
    await Promise.all(hitNames.map(n => this.load(n).catch(e => console.warn('sound:', e.message))));
    this.ready = true;

    // layers trickle in: cove first so the opening isn't silent, then the rest
    await this.load(LAYERS.cove.file).catch(e => console.warn('sound:', e.message));
    this.startLayer('cove');
    const every = Object.values(LAYERS).flatMap(l => l.files || [l.file]);
    Promise.all(every.map(n => this.load(n).catch(e => console.warn('sound:', e.message))))
      .then(() => {
        for (const k of Object.keys(LAYERS)) if (k !== 'cove') this.startLayer(k);
        // the sequencer may ask for any of these, and the storm for its big wave
        for (const n of ['hit_rim', 'hit_swish06', 'hit_swish12', 'tex_bigwave'])
          this.load(n).catch(() => {});
        this.load('hit_icecavern').catch(() => {});
        this.load('hit_icebreak').catch(() => {});
        // what the ice is made of: the two the cracks are cut from, and the hits
        for (const n of ['tex_icechitter', 'tex_iceslide', 'hit_iceglass', 'hit_iceshot', 'hit_icestab'])
          this.load(n).catch(() => {});
        for (const b of Sound.BOWLS) this.load(b.file).catch(() => {});
        for (const n of ['hit_creekchime', 'hit_flowchime']) this.load(n).catch(() => {});
      });
  }

  async load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const res = await fetch(this.base + name + '.m4a');
    if (!res.ok) throw new Error('missing ' + name);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
    this.buffers.set(name, buf);
    return buf;
  }

  // strength 0..1 picks the family; pan from x (-1..1)
  hit(strength, pan = 0) {
    if (!this.ready) return;
    const fam = strength < 0.18 ? 'tiny' : strength < 0.42 ? 'small' : strength < 0.75 ? 'medium' : 'big';
    const names = HITS[fam];
    this.play(names[Math.floor(Math.random() * names.length)], 0.25 + strength * 0.6, pan, 0.85 + Math.random() * 0.3 - strength * 0.15);
  }

  play(name, gain = 0.5, pan = 0, rate = 1, dest = null) {
    const buf = this.buffers.get(name); if (!buf) return;
    const out = dest || this.master;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    src.connect(g);
    if (p) { p.pan.value = pan * 0.7; g.connect(p).connect(out); } else g.connect(out);
    src.start();
  }

  // Where the sharp edges are in a sample. A recording of small sounds is mostly
  // the silence between them, so a grain cut at random lands on nothing far more
  // often than it lands on a click. Worked out once per sample and kept.
  onsets(name) {
    if (!this._onsets) this._onsets = new Map();
    if (this._onsets.has(name)) return this._onsets.get(name);
    const buf = this.buffers.get(name); if (!buf) return null;
    const d = buf.getChannelData(0), sr = buf.sampleRate, n = 256;
    const out = [];
    let prev = 1e-9;
    for (let i = 0; i + n < d.length; i += n) {
      let e = 0;
      for (let j = i; j < i + n; j++) e += d[j] * d[j];
      e = Math.sqrt(e / n) + 1e-9;
      if (e > prev * 2.5 && e > 0.015) out.push(i / sr);
      prev = e;
    }
    this._onsets.set(name, out);
    return out;
  }

  // a short piece cut out of a sample, for sounds built out of many small
  // pieces: ice running, grit, anything that needs a texture rather than a hit.
  // A quick envelope either end so the cut never clicks. With snap, the piece is
  // taken from one of the sample's own transients rather than from anywhere.
  grain(name, gain = 0.1, pan = 0, rate = 1, dur = 0.08, snap = false) {
    const buf = this.buffers.get(name); if (!buf) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const span = Math.max(0, buf.duration - dur * rate - 0.02);
    const on = snap ? this.onsets(name) : null;
    const off = on && on.length
      ? Math.min(span, Math.max(0, on[(Math.random() * on.length) | 0] - 0.004))
      : Math.random() * span;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.008, dur * 0.2));
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(g);
    if (p) { p.pan.value = pan * 0.7; g.connect(p).connect(this.master); } else g.connect(this.master);
    src.start(t, off, dur * rate + 0.02);
    src.stop(t + dur + 0.02);
  }

  // a layer loops with a crossfade so the seam never shows; starts silent
  startLayer(key) {
    if (this.layers.has(key)) return;
    const L = LAYERS[key];
    // a layer is one file, or a handful taken in turn at random
    const pool = (L.files || [L.file]).filter(n => this.buffers.has(n));
    if (!pool.length) return;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    out.connect(L.dry ? this.master : (this.ambientBus || this.master));
    let next = ctx.currentTime + 0.05;
    const schedule = () => {
      const buf = this.buffers.get(pool[(Math.random() * pool.length) | 0]);
      const xf = Math.min(3, buf.duration * 0.25);
      const len = buf.duration - xf;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, next);
      g.gain.linearRampToValueAtTime(1, next + xf);
      g.gain.setValueAtTime(1, next + len);
      g.gain.linearRampToValueAtTime(0, next + len + xf);
      src.connect(g).connect(out);
      src.start(next); src.stop(next + len + xf);
      next += len;
      timer = setTimeout(schedule, Math.max(250, (len - 1) * 1000));
    };
    let timer; schedule();
    this.layers.set(key, { out, target: 0 });
  }

  // weights: {cove, rain, river, deep} each 0..1, plus storm 0..1.
  // stir is how much water is actually being moved about right now.
  setMix(w, storm = 0, stir = 0) {
    if (!this.ctx) return;
    // while it is raining the rest of the water steps back and lets the rain have it
    const wet = Math.min(1, (w.rain || 0) * 1.3 + storm * 0.5);
    const dry = 1 - 0.72 * wet;
    // the hollow is its own world: the open water does not follow you in, so
    // everything but the dripping steps aside as you go deeper
    const out = 1 - Math.min(1, (w.hollow || 0) * 1.25);
    const want = {
      cove: w.cove * dry * out,
      rain: w.rain * (1.05 + storm * 0.45) * out,
      // moving water is only heard while something is moving it, and a drift alone
      // is not enough: it takes a proper push
      river: w.river * Math.min(1.2, Math.max(0, stir - 0.14) * 1.25) * dry * out,
      pour: (w.river * 0.8 + storm * 0.4) * dry * out,
      deep: w.deep * dry * out,
      cavedrips: (w.hollow || 0) * 0.95,
      ice: (w.ice || 0) * out,
      icemelt: (this.melt || 0) * out,
      creek: (w.creek || 0) * out,
      snow: (w.snow || 0) * out,
    };
    const t = this.ctx.currentTime;
    const duck = 1 - 0.78 * (this.duck || 0);
    for (const [k, layer] of this.layers) {
      const lvl = Math.min(1.2, want[k] || 0) * LAYERS[k].level * duck;
      if (Math.abs(lvl - layer.target) > 0.003) {
        layer.out.gain.setTargetAtTime(lvl, t, 1.2);
        layer.target = lvl;
      }
    }
    this.setSubmerge(w.deep);
    this.setCavern(w.deep * 0.8 + w.river * 0.25 + (w.creek || 0) * 0.15 + (w.hollow || 0) * 0.95 + (w.ice || 0) * 0.7);
  }

  // 0 = surface air, 1 = fully under
  setSubmerge(amount) {
    if (!this.submerge) return;
    const f = 18000 * Math.pow(0.04, amount); // 18k -> ~720 Hz
    this.submerge.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.6);
  }

  makeCavern(seconds, decay) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const env = Math.pow(1 - i / n, decay);
        // early slap from stone, then a dark tail
        const slap = (i % Math.floor(sr * 0.047) < 40) && i < sr * 0.4 ? 0.6 : 0;
        const w = (Math.random() * 2 - 1);
        lp += (w - lp) * 0.18; // darken the tail
        d[i] = (lp * 1.6 + slap * w) * env;
      }
    }
    return buf;
  }

  // ----- the echo cave -----
  // While you sing, your voice comes straight back off the walls. What you sang is
  // kept, and afterwards the cave gives it back in pieces, at other pitches.
  openCave(stream) {
    if (this.cave) return this.cave;
    const ctx = this.ctx;
    const src = ctx.createMediaStreamSource(stream);
    const cut = ctx.createBiquadFilter();          // keep the rumble out of the loop
    cut.type = 'highpass'; cut.frequency.value = 180; cut.Q.value = 0.0001;
    const inGain = ctx.createGain(); inGain.gain.value = 0.5;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6;

    // the walls: a long dark slapback that answers a little behind you
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.34;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1900; tone.Q.value = 0.0001;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const out = ctx.createGain(); out.gain.value = 0.55;

    src.connect(cut).connect(inGain);
    inGain.connect(analyser);
    inGain.connect(delay);
    delay.connect(tone);
    tone.connect(fb).connect(delay);
    tone.connect(out).connect(this.master);
    if (this.caveVerb) tone.connect(this.caveVerb);

    this.cave = { stream, src, inGain, analyser, delay, out, data: new Uint8Array(analyser.fftSize) };
    return this.cave;
  }

  closeCave() {
    if (!this.cave) return;
    const c = this.cave, t = this.ctx.currentTime;
    c.out.gain.setTargetAtTime(0, t, 0.5);
    setTimeout(() => { try { c.src.disconnect(); c.out.disconnect(); } catch {} }, 3000);
    this.cave = null;
  }

  // how loud you are, 0..1
  caveLevel() {
    if (!this.cave) return 0;
    const c = this.cave;
    c.analyser.getByteTimeDomainData(c.data);
    let sum = 0;
    for (let i = 0; i < c.data.length; i++) { const v = (c.data[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / c.data.length) * 4.5);
  }

  // Give a recording back in pieces: short grains at other pitches, thinning out,
  // all of it poured through a big stone room.
  scatter(buf, { seconds = 16, level = 0.5, onGrain } = {}) {
    const ctx = this.ctx;
    if (!this.caveVerb) {
      this.caveVerb = ctx.createConvolver();
      this.caveVerb.buffer = this.makeCavern(5.5, 2.0);
      this.caveWet = ctx.createGain(); this.caveWet.gain.value = 0.85;
      this.caveVerb.connect(this.caveWet).connect(this.master);
    }
    const bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(this.caveVerb);
    bus.connect(this.master);                       // a little of it dry, up close
    const SEMIS = [-12, -7, -5, 0, 0, 5, 7, 12];
    const t0 = ctx.currentTime + 0.25;
    let t = t0, n = 0;
    while (t < t0 + seconds && n < 170) {
      const prog = (t - t0) / seconds;
      const dur = 0.1 + Math.random() * 0.28;
      const rate = Math.pow(2, SEMIS[Math.floor(Math.random() * SEMIS.length)] / 12);
      const off = Math.random() * Math.max(0.01, buf.duration - dur * rate - 0.02);
      const amp = (0.45 + Math.random() * 0.55) * (1 - prog * 0.85) * level;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.playbackRate.value = rate;
      const pan = Math.random() * 1.6 - 0.8;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(g);
      if (p) { p.pan.value = pan; g.connect(p).connect(bus); } else g.connect(bus);
      src.start(t, off, dur * rate + 0.02);
      if (onGrain) setTimeout(() => onGrain(amp, pan), Math.max(0, (t - ctx.currentTime) * 1000));
      t += (0.05 + Math.random() * 0.2) * (1 + prog * 3);   // it thins as it dies away
      n++;
    }
    setTimeout(() => { try { bus.disconnect(); } catch {} }, (seconds + 8) * 1000);
    return n;
  }

  // ----- the singing bowl -----
  // Five real bowls, recorded being rung round the rim. Each one loops through
  // the steady part of its own recording for as long as you keep rubbing, so the
  // sound is the bowl itself rather than an impression of one. The first turn of
  // a bowl plays its real onset before the loop takes over.
  bowlUp() {
    if (this.bowlBus || !this.ctx) return;
    const ctx = this.ctx;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1400; tone.Q.value = 0.0001;
    const out = ctx.createGain(); out.gain.value = 1;
    tone.connect(out).connect(this.master);
    this.bowlBus = { tone, out, voices: new Map(), level: 0 };
  }

  // which of the five, how loud, and how bright. -1 for none.
  setBowl(index, level, bright) {
    if (level < 0.001 && !this.bowlBus) return;
    this.bowlUp();
    const B = this.bowlBus, ctx = this.ctx, t = ctx.currentTime;
    B.level = level;
    B.tone.frequency.setTargetAtTime(700 + bright * 3200, t, 0.4);
    for (let i = 0; i < Sound.BOWLS.length; i++) {
      const want = (i === index) ? level : 0;
      let v = B.voices.get(i);
      if (!v) {
        if (want < 0.001) continue;
        const buf = this.buffers.get(Sound.BOWLS[i].file); if (!buf) continue;
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        // loop the steady middle, so the seam never lands on the attack or the fade
        src.loopStart = Math.min(1.6, buf.duration * 0.15);
        src.loopEnd = Math.max(src.loopStart + 1, buf.duration - 1.2);
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(g).connect(B.tone);
        src.start();
        v = { src, g, want: 0 };
        B.voices.set(i, v);
      }
      if (Math.abs(want - v.want) > 0.002) {
        v.want = want;
        // it comes up as you rub and keeps ringing a good while after you stop
        v.g.gain.setTargetAtTime(want * 0.85, t, want > v.g.gain.value ? 0.18 : 1.1);
      }
      // a bowl left silent for a while gives its player back
      if (want < 0.001 && v.g.gain.value < 0.0015) {
        v.quiet = (v.quiet || 0) + 1;
        if (v.quiet > 240) { try { v.src.stop(); } catch {} B.voices.delete(i); }
      } else v.quiet = 0;
    }
  }

  // ----- the creek -----
  // Chimes struck by running water want somewhere to ring. The sample is short,
  // because it was cut from a run of chimes falling over each other, so the
  // creek gives it a small bright room and an echo you can set yourself.
  creekUp() {
    if (this.creekBus || !this.ctx) return;
    const ctx = this.ctx;
    const inp = ctx.createGain(); inp.gain.value = 1;
    const verb = ctx.createConvolver(); verb.buffer = this.makeCavern(2.6, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.26;
    const d = ctx.createDelay(2); d.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 4200; tone.Q.value = 0.0001;
    const out = ctx.createGain(); out.gain.value = 0;
    inp.connect(this.master);
    inp.connect(verb).connect(wet).connect(this.master);
    inp.connect(d); d.connect(tone).connect(fb).connect(d);
    d.connect(out).connect(this.master);
    this.creekBus = { inp, out, fb, delay: d };
  }
  get creek() { this.creekUp(); return this.creekBus ? this.creekBus.inp : this.master; }

  setCreekEcho(v) {
    this.creekUp();
    if (!this.creekBus) return;
    const t = this.ctx.currentTime;
    this.creekBus.out.gain.setTargetAtTime(Math.min(0.75, v * 0.75), t, 0.15);
    this.creekBus.fb.gain.setTargetAtTime(Math.min(0.62, v * 0.62), t, 0.15);
  }

  // ----- the ice, and the water that comes out of it -----
  // Open water in a frozen sheet is a cold, bright, ringing sort of place, so
  // what happens there goes through a room of its own: a long pale reverb and a
  // slow echo in thirds, tuned so a hole dripping on its own becomes something
  // you would sit and listen to rather than a dripping tap.
  iceUp() {
    if (this.iceBus || !this.ctx) return;
    const ctx = this.ctx;
    const inp = ctx.createGain(); inp.gain.value = 1;
    const dry = ctx.createGain(); dry.gain.value = 0.72;
    const air = ctx.createBiquadFilter();                 // take the thud out of it
    air.type = 'highpass'; air.frequency.value = 260; air.Q.value = 0.0001;
    const verb = ctx.createConvolver(); verb.buffer = this.makeCavern(5.2, 1.5);
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    const d1 = ctx.createDelay(3); d1.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dtone = ctx.createBiquadFilter();               // each repeat a little darker
    dtone.type = 'lowpass'; dtone.frequency.value = 2600; dtone.Q.value = 0.0001;
    const dout = ctx.createGain(); dout.gain.value = 0.3;
    inp.connect(air);
    air.connect(dry).connect(this.master);
    air.connect(verb).connect(wet).connect(this.master);
    air.connect(d1); d1.connect(dtone).connect(fb).connect(d1);
    d1.connect(dout).connect(this.master);
    this.iceBus = { inp, wet, dout };
  }
  get ice() { this.iceUp(); return this.iceBus ? this.iceBus.inp : this.master; }

  // a bowl struck rather than rubbed: its own recording, let ring and fade
  strikeBowl(i, gain = 0.5) {
    const B = Sound.BOWLS[i]; if (!B || !this.ctx) return;
    const buf = this.buffers.get(B.file); if (!buf) return;
    this.bowlUp();
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.01, gain), t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    src.connect(g).connect(this.bowlBus.tone);
    src.start(t, Math.min(0.4, buf.duration * 0.04));
    src.stop(t + 3.8);
  }

  bowlLevel() { return this.bowlBus ? this.bowlBus.level : 0; }

  // The storm's big wave is weather, not an instrument, so it goes through the
  // ambient bus: setting the ambient water aside takes the storm with it.
  wave(pan = 0) {
    if (this.ready) this.play('tex_bigwave', 0.5, pan, 0.9 + Math.random() * 0.2,
                              this.ambientBus || this.master);
  }

  // a tap on the very end of the chain, for recording what you hear
  captureStream() {
    if (!this.ctx || !this.comp) return null;
    if (!this.capDest) {
      this.capDest = this.ctx.createMediaStreamDestination();
      this.comp.connect(this.capDest);
    }
    return this.capDest.stream;
  }

  // set the ambient water aside, leaving the instruments
  setAmbient(on) {
    this.ambientOff = !on;
    if (!this.ambientBus) return;
    this.ambientBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, on ? 0.6 : 0.35);
  }

  // silence everything, smoothly, without stopping any of it
  setMuted(on) {
    this.muted = on;
    if (!this.master) return;             // remembered until the sound starts
    this.master.gain.setTargetAtTime(on ? 0 : 0.9, this.ctx.currentTime, 0.08);
  }

  setChorus(v) { // 0..1
    if (!this.chorusWet) return;
    const t = this.ctx.currentTime;
    this.chorusWet.gain.setTargetAtTime(v * 0.5, t, 0.3);
    // deeper setting also widens and slows the wander
    this.chorusVoices.forEach((c, i) => {
      c.amt.gain.setTargetAtTime((i ? 0.0021 : 0.0032) * (0.5 + v * 1.8), t, 0.3);
    });
  }

  setDrift(v) { if (this.seq) this.seq.drift = v; }
  setMelt(v) { this.melt = v; }

  setCavern(amount) { // 0..1
    if (this.wet) this.wet.gain.setTargetAtTime(0.1 + amount * 0.5, this.ctx.currentTime, 0.8);
  }

  // ----- sequencer -----
  // Each of the 4 tracks has a voice, cycled from this palette. 16 steps.
  static VOICES = [
    { name: 'drips',   names: ['hit_droplet', 'hit_drop'],                  gain: 0.35, rate: [0.95, 1.25] },
    { name: 'drops',   names: ['hit_drop135', 'hit_drips_short'],           gain: 0.45, rate: [0.85, 1.1] },
    { name: 'splash',  names: ['hit_splash', 'hit_swish06', 'hit_swish12'], gain: 0.5,  rate: [0.8, 1.05] },
    { name: 'deep',    names: ['hit_deepsplash', 'hit_lunge'],              gain: 0.55, rate: [0.6, 0.85] },
    { name: 'bubbles', names: ['hit_bubbles'],                              gain: 0.5,  rate: [0.8, 1.35] },
    { name: 'space',   names: ['hit_spacedrops'],                           gain: 0.5,  rate: [0.7, 1.2] },
    { name: 'swish',   names: ['hit_swish06', 'hit_swish12'],               gain: 0.45, rate: [0.95, 1.4] },
    { name: 'glass',   names: ['hit_droplet', 'hit_drop'],                  gain: 0.4,  rate: [1.7, 2.4] },
    { name: 'rim',     names: ['hit_rim'],                                   gain: 0.42, rate: [0.78, 1.25] },
    // these four are played, not sampled: the water becomes a note
    { name: 'resonant', kind: 'comb', names: ['hit_droplet', 'hit_drop', 'hit_drips_short'], gain: 0.4 },
    { name: 'bell',     kind: 'bell',  gain: 0.3 },
    { name: 'blip',     kind: 'blip',  gain: 0.35 },
    { name: 'chime',    kind: 'chime', gain: 0.2 },
  ];

  // a minor pentatonic on D, five notes cycling against a sixteen step bar
  static SCALE = [0, 3, 5, 7, 10];
  static ROOT = 73.416;              // D2
  static TRACK_SEMIS = [24, 19, 12, 0]; // top row highest, bottom row lowest

  noteFor(track, step, drift) {
    const semis = Sound.TRACK_SEMIS[track] + Sound.SCALE[step % Sound.SCALE.length]
      + (Math.random() - 0.5) * drift * 1.2;
    return Sound.ROOT * Math.pow(2, semis / 12);
  }

  // A water hit struck into a tuned pipe, ringing at freq. Only the first few
  // milliseconds of the sample go in: feed it the whole thing and the pipe just
  // keeps filling up until it screams.
  strike(freq, when, gain, pan, dest, name = 'hit_droplet') {
    const ctx = this.ctx;
    const buf = this.buffers.get(name) || this.buffers.get('hit_droplet');
    if (!buf) return;
    const minDelay = 170 / ctx.sampleRate;   // a render quantum, plus headroom
    while (1 / freq < minDelay) freq *= 0.5; // drop an octave until the pipe fits
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = 1.5 + Math.random() * 0.5;
    const exc = ctx.createGain();            // the strike, and nothing after it
    exc.gain.setValueAtTime(0.0001, when);
    exc.gain.exponentialRampToValueAtTime(7.5, when + 0.004);
    exc.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    const shape = ctx.createBiquadFilter();
    shape.type = 'bandpass'; shape.frequency.value = freq * 3; shape.Q.value = 0.6;
    const delay = ctx.createDelay(0.2); delay.delayTime.value = 1 / freq;
    const damp = ctx.createBiquadFilter();
    // Q is read as decibels of resonance here, so anything above zero puts a boost
    // inside the loop and the pipe runs away. Keep it flat.
    damp.type = 'lowpass'; damp.frequency.value = Math.min(5000, freq * 9); damp.Q.value = 0.0001;
    const fb = ctx.createGain(); fb.gain.value = 0.855; // it self-oscillates at 0.88, so stay under
    const out = ctx.createGain();
    out.gain.setValueAtTime(gain, when);
    out.gain.setTargetAtTime(0.0001, when + 1.3, 0.45);
    const p = (pan && ctx.createStereoPanner) ? ctx.createStereoPanner() : null;
    if (p) p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(exc).connect(shape).connect(delay);
    delay.connect(damp);
    damp.connect(fb).connect(delay);
    damp.connect(out);                        // tap after the damping, not before
    if (p) out.connect(p).connect(dest); else out.connect(dest);
    src.start(when); src.stop(when + 0.25);
    setTimeout(() => { try { out.disconnect(); if (p) p.disconnect(); } catch {} }, 3600);
  }

  // A warm, round, soft struck note. Sine at the root with a little second and a
  // breath of third, a gentle attack and a long fall. Nothing metallic about it.
  soft(freq, when, gain, pan, dest, dur = 2.9) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = Math.min(4200, freq * 5.5); tone.Q.value = 0.0001;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(tone).connect(p).connect(dest); }
    else out.connect(tone).connect(dest);

    const parts = [[1, 0.72], [2, 0.16], [3, 0.05]];   // summed, these stay under one
    const oscs = [];
    for (const [ratio, lvl] of parts) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq * ratio * 1.004, when);   // settles as it is struck
      o.frequency.exponentialRampToValueAtTime(freq * ratio, when + 0.09);
      const g = ctx.createGain(); g.gain.value = lvl;
      o.connect(g).connect(out);
      o.start(when); o.stop(when + dur + 0.5);
      oscs.push(o);
    }
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.018); // soft edge
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    setTimeout(() => { try { out.disconnect(); tone.disconnect(); if (p) p.disconnect(); } catch {} }, 3800);
  }

  // A Rhodes is a little hammer striking a tine beside a tuned bar: a bright
  // metallic bark that is gone almost at once, over a sine that rings on well
  // after it. What makes it a Rhodes rather than a soft sine is that the
  // brightness leaves before the note does, so every partial gets its own decay
  // instead of the whole stack fading together.
  rhodes(freq, when, gain, pan, dest, dur = 2.6) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.Q.value = 0.0001;
    tone.frequency.setValueAtTime(Math.min(9000, freq * 11), when);
    tone.frequency.exponentialRampToValueAtTime(Math.min(2600, freq * 3.1), when + 0.55);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(tone).connect(p).connect(dest); }
    else out.connect(tone).connect(dest);

    // ratio, level, and how much of the note's length that partial survives.
    // The last one is the tine: high, quiet, and over in a twentieth of the note.
    const parts = [[1, 0.60, 1], [2.01, 0.13, 0.42], [3.02, 0.045, 0.26],
                   [6.18, 0.085, 0.055],
                   [1.0022, 0.17, 0.78]];   // and a second fundamental a hair sharp, so it moves
    const made = [];
    for (const [ratio, lvl, life] of parts) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(lvl, when + 0.007);
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, dur * life));
      o.connect(g).connect(out);
      o.start(when); o.stop(when + dur + 0.4);
      made.push(o, g);
    }
    setTimeout(() => {
      try { out.disconnect(); tone.disconnect(); if (p) p.disconnect(); for (const n of made) n.disconnect(); } catch {}
    }, (dur + 1.4) * 1000);
  }

  // A struck ice crystal. Where a bell's partials are stretched and a Rhodes's
  // are whole-numbered, a thin rigid plate rings on ratios that belong to no
  // harmonic series at all, which is why ice sounds like glass and not like a
  // string. The top ones are gone in a quarter second; the bottom one hangs on
  // and shivers, because the crystal is melting while it rings.
  crystal(freq, when, gain, pan, dest, dur = 3.2) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p).connect(dest); }
    else out.connect(dest);

    // plate modes: ratio, level, share of the note's length
    const parts = [[1, 0.5, 1], [2.32, 0.2, 0.34], [3.81, 0.11, 0.17], [5.96, 0.06, 0.08]];
    const made = [];
    for (const [ratio, lvl, life] of parts) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(lvl, when + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, dur * life));
      o.connect(g).connect(out);
      o.start(when); o.stop(when + dur + 0.3);
      made.push(o, g);
    }
    // a slow shiver on the fundamental, so it is never quite still as it goes
    const vib = ctx.createOscillator(); vib.type = 'sine';
    vib.frequency.value = 3.4 + Math.random() * 2.2;
    const vamt = ctx.createGain(); vamt.gain.value = freq * 0.0025;
    vib.connect(vamt).connect(made[0].frequency);
    vib.start(when); vib.stop(when + dur + 0.3);
    made.push(vib, vamt);

    setTimeout(() => {
      try { out.disconnect(); if (p) p.disconnect(); for (const n of made) n.disconnect(); } catch {}
    }, (dur + 1.2) * 1000);
  }

  // one struck note, whatever the engine
  playVoice(V, when, pan, track, step, dest, drift = 0) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p).connect(dest); } else out.connect(dest);
    const g = V.gain * (0.82 + Math.random() * 0.28);
    const f = V.kind ? this.noteFor(track, step, drift) : 0;
    let life = 1;

    if (!V.kind) {
      const name = V.names[Math.floor(Math.random() * V.names.length)];
      const buf = this.buffers.get(name); if (!buf) return;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const wob = 1 + (Math.random() - 0.5) * drift * 0.5;
      src.playbackRate.value = (V.rate[0] + Math.random() * (V.rate[1] - V.rate[0])) * wob;
      out.gain.value = g;
      src.connect(out); src.start(when);
      life = buf.duration / src.playbackRate.value + 0.2;

    } else if (V.kind === 'comb') {
      const name = V.names[Math.floor(Math.random() * V.names.length)];
      this.strike(f, when, g * 2.3, 0, out, name);
      out.gain.setValueAtTime(1, when);
      life = 3.0;

    } else if (V.kind === 'bell') {
      // two sines, one bending the other: a struck bell
      const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f * 2;
      const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2 * 2.76;
      const idx = ctx.createGain();
      idx.gain.setValueAtTime(f * 5.5, when);
      idx.gain.exponentialRampToValueAtTime(f * 0.08, when + 0.9);
      mod.connect(idx).connect(car.frequency);
      out.gain.setValueAtTime(0.0001, when);
      out.gain.exponentialRampToValueAtTime(g, when + 0.006);
      out.gain.exponentialRampToValueAtTime(0.0001, when + 2.4);
      car.connect(out); car.start(when); mod.start(when);
      car.stop(when + 2.5); mod.stop(when + 2.5);
      life = 2.6;

    } else if (V.kind === 'blip') {
      // the sound a drop makes hitting still water: a quick rise
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.45, when);
      o.frequency.exponentialRampToValueAtTime(f * 1.9, when + 0.075);
      out.gain.setValueAtTime(0.0001, when);
      out.gain.exponentialRampToValueAtTime(g, when + 0.004);
      out.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
      o.connect(out); o.start(when); o.stop(when + 0.3);
      life = 0.4;

    } else if (V.kind === 'chime') {
      // wet glass: two near-unison sines with a slow shiver
      const a = ctx.createOscillator(); a.type = 'sine'; a.frequency.value = f * 4;
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f * 4 * 1.004;
      const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 4.5 + Math.random();
      const vamt = ctx.createGain(); vamt.gain.value = f * 0.02 * (0.3 + drift * 2.2);
      vib.connect(vamt); vamt.connect(a.frequency); vamt.connect(b.frequency);
      out.gain.setValueAtTime(0.0001, when);
      out.gain.exponentialRampToValueAtTime(g, when + 0.03);
      out.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
      a.connect(out); b.connect(out);
      a.start(when); b.start(when); vib.start(when);
      a.stop(when + 2.9); b.stop(when + 2.9); vib.stop(when + 2.9);
      life = 3;
    }
    // let the nodes go once the note has died
    setTimeout(() => { try { out.disconnect(); if (p) p.disconnect(); } catch {} },
      Math.max(0, (when - ctx.currentTime + life)) * 1000 + 400);
  }

  startSequencer(onStep) {
    if (this.seq) return;
    const seq = this.seq = {
      bpm: 68, swing: 0, drift: 0, step: 0, running: false, next: this.ctx.currentTime + 0.1,
      pattern: Array.from({ length: 4 }, () => new Array(16).fill(false)),
      // bubbles, rim, bell and drips: two sampled, one struck, one sampled, so the
      // grid has something to say the moment you put a dot in it
      voice: [4, 8, 10, 0],
    };
    // nothing is laid down to begin with: the grid is yours to fill
    const stepLen = () => 60 / seq.bpm / 4;
    const tick = () => {
      const now = this.ctx.currentTime;
      if (!seq.running) { seq.next = Math.max(seq.next, now + 0.05); return; }
      while (seq.next < now + 0.14) {
        const s = seq.step;
        // swing pushes every off-beat 16th a little late
        const when = seq.next + (s % 2 ? seq.swing * stepLen() * 0.55 : 0);
        for (let t = 0; t < 4; t++) if (seq.pattern[t][s]) {
          this.playVoice(Sound.VOICES[seq.voice[t]], when, (s / 15) * 1.4 - 0.7, t, s, this.seqBus, seq.drift);
        }
        setTimeout(() => onStep(s), Math.max(0, (when - now) * 1000));
        seq.next += stepLen();
        seq.step = (s + 1) % 16;
      }
    };
    seq.timer = setInterval(tick, 30);
  }

  // stop clears the playhead and the step; start picks up from the top of the bar
  toggleSequencer() {
    if (!this.seq) return false;
    this.seq.running = !this.seq.running;
    if (this.seq.running) { this.seq.step = 0; this.seq.next = this.ctx.currentTime + 0.05; }
    return this.seq.running;
  }

  voiceName(t) {
    return (this.seq && Sound.VOICES[this.seq.voice[t]]) ? Sound.VOICES[this.seq.voice[t]].name : '';
  }

  cycleVoice(t) {
    if (!this.seq) return '';
    this.seq.voice[t] = (this.seq.voice[t] + 1) % Sound.VOICES.length;
    const v = Sound.VOICES[this.seq.voice[t]];
    // a taste of the new voice right away
    this.playVoice(v, this.ctx.currentTime + 0.02, 0, t, 0, this.master, this.seq.drift);
    return v.name;
  }

  setBpm(bpm) {
    if (this.seq) this.seq.bpm = bpm;
    if (this.echoDelay) this.echoDelay.delayTime.setTargetAtTime((60 / bpm) * 0.75, this.ctx.currentTime, 0.25);
  }
  setSwing(v) { if (this.seq) this.seq.swing = v; }
  setEcho(v) {
    if (!this.echoWet) return;
    const t = this.ctx.currentTime;
    this.echoWet.gain.setTargetAtTime(v * 0.55, t, 0.2);
    this.echoFb.gain.setTargetAtTime(0.15 + v * 0.55, t, 0.2);
  }

  playAt(name, when, gain, pan, rate, dest) {
    const buf = this.buffers.get(name); if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    src.connect(g);
    if (p) { p.pan.value = pan; g.connect(p).connect(dest); } else g.connect(dest);
    src.start(when);
  }

  setSequencerLevel(level) {
    if (!this.seqBus) return;
    this.seqBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
    // the ambient water steps back to make room for the pattern. The curve is steep
    // so the water is already out of the way by the time the grid is properly up.
    this.seqDuck = (this.seq && this.seq.running) ? Math.min(1, level * 1.7) : 0;
    this.duck = Math.max(this.seqDuck, this.bowlDuck || 0);
  }

  // the bowl asks for the same room the sequencer gets
  setBowlDuck(amount) {
    this.bowlDuck = Math.min(1, amount);
    this.duck = Math.max(this.seqDuck || 0, this.bowlDuck);
  }

}

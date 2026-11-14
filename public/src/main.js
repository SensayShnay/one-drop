import { Surface } from './surface.js';
import { Sound } from './audio.js';
import { Pins } from './pins.js';
import { Soundings } from './soundings.js';
import { Creek } from './creek.js';
import { Names } from './names.js';
import { SCALES, KEYS } from './soundings.js';
import { Bowls } from './bowl.js';
import { Harp } from './harp.js';
import { Snow } from './snow.js';
import { Capture } from './capture.js';
import { MARKS } from './marks.js';
import { Drift } from './drift.js';
import { Story } from './story.js';
import { Ice } from './ice.js';

const canvas = document.getElementById('c');
const veil = document.getElementById('veil');
let surface;
try {
  surface = new Surface(canvas);
} catch (e) {
  console.error(e);
  document.getElementById('err').style.display = 'grid';
  veil.style.display = 'none';
  throw e;
}
const sound = new Sound('./audio/');
const pins = new Pins(sound, surface, document.getElementById('pins'));

// ---------- where everything is ----------
// Positions are in screen-heights. You start in the cove. Areas blend at their
// edges and pull you in gently if you drift near while not touching. They are
// spread wider than they first were: they used to overlap, and an area needs
// open water around it or arriving in one means nothing.
//
// This list is the only place any of it is written down. The instruments used to
// carry a second copy of their own area's position, and spreading the areas once
// moved the water out from under them.
const REGIONS = [
  { key: 'cove',    x: 0,     y: 0,     r: 0.8, inst: 'bowl' },
  { key: 'rain',    x: 1.75,  y: -1.25, r: 1.0, inst: 'harp' },
  { key: 'river',   x: -1.8,  y: 0.65,  r: 1.1, inst: 'sequencer' },
  { key: 'deep',    x: 0.4,   y: 2.2,   r: 1.1, inst: 'soundings' },
  { key: 'hollow',  x: -1.35, y: -1.9,  r: 1.0, inst: 'cave' },
  { key: 'ice',     x: -3.3,  y: -1.35, r: 1.0, inst: 'crack' },
  { key: 'creek',   x: -3.5,  y: 2.35,  r: 1.0, inst: 'rocks' },
  { key: 'snow',    x: -2.3,  y: -3.9,  r: 1.0, inst: 'flake' },
];
const place = k => REGIONS.find(r => r.key === k);
const COVE = place('cove'), RAIN = place('rain'), DEEP = place('deep');
const CREEK = place('creek'), ICE = place('ice'), SNOW = place('snow');

const creek = new Creek(sound, surface, document.getElementById('rocks'),
                        document.getElementById('surge'), CREEK, CREEK.r);
const soundings = new Soundings(sound, surface, document.getElementById('stones'), DEEP, DEEP.r);
const bowl = new Bowls(sound, surface, document.getElementById('bowls'), COVE);
const harp = new Harp(sound, surface, document.getElementById('leaves'), RAIN, RAIN.r);
const snow = new Snow(sound, surface, document.getElementById('snowfield'), SNOW, SNOW.r);
const capture = new Capture(sound, canvas);
const drift = new Drift(sound, surface, document.getElementById('things'), document.getElementById('said'));
// the tally, kept on screen rather than only on the chart
const takenEl = document.getElementById('taken');
let takenLit = 0;
function showTaken(n, flash) {
  takenEl.classList.toggle('on', n > 0);
  takenEl.querySelector('b').textContent = n;
  if (flash) { takenEl.classList.add('lit'); takenLit = 4; }
}
drift.onLift = n => showTaken(n, true);
showTaken(drift.lifted, false);
const ice = new Ice(sound, surface, document.getElementById('cracks'), document.getElementById('holes'), ICE, ICE.r);
const story = new Story(sound, surface, document.getElementById('onedrop'),
                        document.getElementById('said'), document.getElementById('cyclefig'));
document.getElementById('onedrop').addEventListener('pointerdown', e => {
  e.stopPropagation();
  document.body.classList.add('cycling');
  story.begin();
  haptic(20);
});
// stepping through the cycle, for looking at one part of it rather than waiting
const cycleStep = document.getElementById('cyclestep');
for (const [sel, d] of [['.back', -1], ['.fwd', 1]]) {
  cycleStep.querySelector(sel).addEventListener('pointerdown', e => {
    e.stopPropagation();
    story.step(d);
    cycleStep.querySelector('.back').classList.toggle('off', story.at().i <= 0);
    haptic(8);
  });
}
document.getElementById('leave').addEventListener('pointerdown', e => {
  e.stopPropagation();
  story.end();
  document.body.classList.remove('cycling');
  haptic(8);
});
window.__onedrop = { surface, sound, pins, soundings, bowl, harp, capture, drift, story, ice, creek, snow }; // dev hook

// ---------- the world ----------
// ---------- and that it comes back around ----------
// The water has no edge, but it does have a size. Swim far enough in any
// direction and the same places come round again, because every place is really
// in every tile of an endless grid and you are always shown the nearest copy.
//
// Only the places repeat. The surface itself is a field of noise with no period
// at all, and the viewport's own coordinate is never folded, so coming back to
// the cove after a long swim finds the cove where you left it and finds the
// water that happened to be passing. Nothing seams, because nothing wraps but
// the arithmetic.
const SPAN = 12;   // screen-heights across, and the same down
// a coordinate or a difference, taken the short way round
const fold = v => v - SPAN * Math.round(v / SPAN);
const world = {
  x: 0, y: 0, vx: 0, vy: 0,            // viewport centre, velocity in heights/sec
  span: SPAN,
  at: fold,                            // a world position, folded into one tile
  near: fold,                          // a difference, by the shorter way
  dx(x) { return fold(x - this.x); },  // from here to x, the short way
  dy(y) { return fold(y - this.y); },
};
let pullHold = 0; // after an arrival, the areas let you be for a few seconds
let steady = 0;   // and after you touch an instrument, nothing moves at all
// Anything you do to an instrument settles the water: no pull from the areas and
// no leftover glide, so what you are playing stays where you put it.
function settle(seconds = 3) {
  steady = Math.max(steady, seconds);
  world.vx = world.vy = 0;
  travelTo = null;
}
let stir = 0;     // how much water is being moved about, right now
const weights = {}; const smoothW = {};
for (const R of REGIONS) { weights[R.key] = R.key === 'cove' ? 1 : 0; smoothW[R.key] = weights[R.key]; }

function updateRegions(dt, touching) {
  let nearest = null, nd = Infinity;
  for (const R of REGIONS) {
    const dx = world.dx(R.x), dy = world.dy(R.y);
    const d = Math.hypot(dx, dy);
    // inside: full. edge: soft falloff. beyond 1.3r: nothing.
    weights[R.key] = 1 - smoothstep(R.r * 0.45, R.r * 1.3, d);
    if (R.key !== 'cove' && d / R.r < nd) { nd = d / R.r; nearest = { R, dx, dy, d }; }
  }
  // The cove is home and never pulls. The others draw you in only while you are
  // still on your way: once you are properly inside one, it lets you be, so the
  // water stops creeping toward the middle while you are trying to play.
  if (!touching && pullHold <= 0 && steady <= 0 && nearest
      && nearest.d > nearest.R.r * 0.92 && nearest.d < nearest.R.r * 2.0) {
    const { R, dx, dy, d } = nearest;
    const k = 0.3 * (0.4 + 0.6 * smoothstep(0, R.r * 0.6, d)) * (1 - smoothstep(R.r * 1.4, R.r * 2.0, d));
    world.vx += (dx / d) * k * dt; world.vy += (dy / d) * k * dt;
  }
  for (const k in weights) smoothW[k] += (weights[k] - smoothW[k]) * Math.min(1, dt * 1.5);
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- weather ----------
// Storms are rare here, the way they are most days. They come in often only when
// it is actually raining wherever you are: the water you are looking at keeps the
// weather you are standing in. If we never find that out -- no location given, no
// network, an insecure page -- it just stays mostly calm.
const real = { wet: 0, next: 0, asked: false };
function askTheSky(now) {
  if (now < real.next || !navigator.geolocation) return;
  real.next = now + 20 * 60 * 1000;                 // no more than every twenty minutes
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(2)}` +
          `&longitude=${lo.toFixed(2)}&current=precipitation,weather_code`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const c = d && d.current; if (!c) return;
        const code = c.weather_code, mm = c.precipitation || 0;
        let wet = 0;
        if (code >= 95) wet = 1;                                  // thunder
        else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) wet = 0.8;  // rain
        else if (code >= 51 && code <= 57) wet = 0.5;             // drizzle
        if (mm > 0) wet = Math.max(wet, 0.4);
        real.wet = wet;
      })
      .catch(() => {});
  }, () => { real.next = now + 60 * 60 * 1000; }, { timeout: 8000, maximumAge: 15 * 60 * 1000 });
}

const weather = { storm: 0, phase: 'calm', until: performance.now() + 150000 + Math.random() * 120000 };
let nextWave = 0;
function updateWeather(now, dt) {
  if (now > weather.until) {
    const w = real.wet;
    if (weather.phase === 'calm') {
      weather.phase = 'storm';
      weather.until = now + (26000 + w * 22000) + Math.random() * (16000 + w * 26000);
    } else {
      weather.phase = 'calm';
      // dry out there: four to eight minutes between storms. Wet: one to two.
      const gap = 240000 - w * 180000;
      weather.until = now + gap + Math.random() * gap * 0.75;
    }
  }
  const target = weather.phase === 'storm' ? 1 : 0;
  weather.storm += (target - weather.storm) * Math.min(1, dt * (target ? 0.09 : 0.06));
  if (weather.storm > 0.5 && now > nextWave) {
    nextWave = now + 5000 + Math.random() * 7000;
    sound.wave(Math.random() * 2 - 1);
    // a swell: one broad, soft push across the surface
    surface.drop(innerWidth * Math.random(), innerHeight * Math.random(), innerHeight * 0.45, 0.06);
  }
}

// ---------- wake ----------
let awake = false;
let wakePan = 0;
function wakeUp(x, y) {
  awake = true;
  veil.classList.add('gone');
  compassHold = 8; // show the way for the first few seconds
  surface.wakeTarget = 1;
  surface.drop(x, y, 34, 0.5);
  splatter(x, y, 34, 0.5);
  wakePan = (x / innerWidth) * 2 - 1;
  pins.load(); // the lights are there whether or not the sound starts
  askTheSky(performance.now());   // what is the weather actually doing where you are
  mapToggle.style.opacity = 0.55; mapToggle.style.pointerEvents = 'auto';
  muteEl.style.opacity = 0.55; muteEl.style.pointerEvents = 'auto';
  ambientEl.style.opacity = 0.55; ambientEl.style.pointerEvents = 'auto';
  captureEl.style.opacity = 0.55; captureEl.style.pointerEvents = 'auto';
}
let soundStarted = false;
async function unlockSound() {
  if (soundStarted) { if (sound.ctx && sound.ctx.state !== 'running') sound.ctx.resume(); return; }
  soundStarted = true;
  try {
    await sound.wake();
    sound.hit(0.95, wakePan);
    sound.startSequencer(onStep);
  } catch (err) {
    console.error('sound failed to start', err);
    soundStarted = false;
    const s = document.getElementById('status');
    s.textContent = 'sound: ' + (err && err.message ? err.message : err);
    s.style.opacity = 1;
  }
}

// ---------- the sequencer grid ----------
// Surfaces when you linger in the current. Tap a dot to light it.
const seqEl = document.getElementById('seq');
const dots = [], voiceEls = [];

const seqHelp = document.getElementById('seqhelp');
let helpSeen = false, helpLeft = 0;
const hideHelp = () => { helpLeft = 0; seqHelp.classList.remove('show'); };

// the transport: a play arrow while it waits, a stop square while it runs
const transport = document.createElement('span');
transport.className = 'transport';
transport.appendChild(document.createElement('i'));
const bar = document.createElement('span'); bar.className = 'bar';
seqEl.appendChild(transport); seqEl.appendChild(bar);
transport.addEventListener('pointerdown', e => {
  e.stopPropagation();
  hideHelp();
  const running = sound.toggleSequencer();
  transport.classList.toggle('running', running);
  if (!running) for (const row of dots) for (const d of row) d.classList.remove('head');
  const r = transport.getBoundingClientRect();
  surface.drop(r.left + r.width / 2, r.top + r.height / 2, 16, running ? 0.14 : 0.06);
  haptic(running ? 12 : 6);
});

for (let t = 0; t < 4; t++) {
  dots.push([]);
  // the ring at the head of the row: tap to change the row's voice
  const vcell = document.createElement('span');
  vcell.className = 'voice';
  const ring = document.createElement('i');
  vcell.appendChild(ring); seqEl.appendChild(vcell);
  // the name of what the row plays, kept where you can read it. The sound is
  // not awake yet when this is built, so the names are filled in once it is.
  voiceEls.push(ring);
  ring.textContent = sound.voiceName(t) || '\u2014';
  vcell.addEventListener('pointerdown', e => {
    e.stopPropagation();
    hideHelp();
    const name = sound.cycleVoice(t);
    if (!name) return;
    ring.textContent = name;
    haptic(6);
  });
  for (let s = 0; s < 16; s++) {
    const cell = document.createElement('span');
    const dot = document.createElement('i');
    dot.classList.add('b' + Math.floor(Math.random() * 6));
    dot.style.animationDelay = (-Math.random() * 14).toFixed(2) + 's';
    cell.appendChild(dot); seqEl.appendChild(cell);
    dots[t].push(dot);
    cell.addEventListener('pointerdown', e => {
      e.stopPropagation();
      hideHelp();
      if (!sound.seq) return;
      const on = !sound.seq.pattern[t][s];
      sound.seq.pattern[t][s] = on;
      dot.classList.toggle('on', on);
      if (on) { const r = dot.getBoundingClientRect(); surface.drop(r.left + r.width / 2, r.top + r.height / 2, 8, 0.08); haptic(6); }
    });
  }
}

// ---------- the parameter lines ----------
// Three thin lines under the grid: tempo, swing, echo. Drag the dot.
const paramsEl = document.getElementById('params');
const PARAMS = [
  { key: 'tempo', value: (68 - 46) / 74, readout: v => Math.round(46 + v * 74) + ' bpm',
    apply: v => sound.setBpm(Math.round(46 + v * 74)) },
  { key: 'swing', value: 0,  readout: v => Math.round(v * 100) + '%', apply: v => sound.setSwing(v) },
  { key: 'echo',  value: 0,  readout: v => Math.round(v * 100) + '%', apply: v => sound.setEcho(v) },
  { key: 'chorus', value: 0, readout: v => Math.round(v * 100) + '%', apply: v => sound.setChorus(v) },
  { key: 'drift', value: 0,  readout: v => Math.round(v * 100) + '%', apply: v => sound.setDrift(v) },
];
for (const P of PARAMS) {
  const row = document.createElement('div'); row.className = 'row';
  const label = document.createElement('span'); label.textContent = P.key;
  const track = document.createElement('div'); track.className = 'track';
  const handle = document.createElement('b');
  handle.style.left = (P.value * 100) + '%';
  track.appendChild(handle); row.appendChild(label); row.appendChild(track);
  let readEl = null;
  if (P.readout) {
    readEl = document.createElement('u');
    readEl.textContent = P.readout(P.value);
    row.appendChild(readEl);
  }
  paramsEl.appendChild(row);
  const set = x => {
    const r = track.getBoundingClientRect();
    P.value = Math.min(1, Math.max(0, (x - r.left) / r.width));
    handle.style.left = (P.value * 100) + '%';
    if (readEl) readEl.textContent = P.readout(P.value);
    P.apply(P.value);
  };
  let held = false;
  row.addEventListener('pointerdown', e => { e.stopPropagation(); held = true; row.setPointerCapture(e.pointerId); set(e.clientX); });
  row.addEventListener('pointermove', e => { if (held) { e.stopPropagation(); set(e.clientX); } });
  row.addEventListener('pointerup', e => { held = false; e.stopPropagation(); });
  row.addEventListener('pointercancel', () => held = false);
}
let seqLevel = 0, seqShown = 0, linger = 0;
function onStep(s) {
  if (s % 4 === 0) { transport.classList.add('beat'); setTimeout(() => transport.classList.remove('beat'), 110); }
  for (let t = 0; t < 4; t++) for (let i = 0; i < 16; i++) {
    const d = dots[t][i];
    d.classList.toggle('head', i === s);
    d.classList.toggle('on', sound.seq.pattern[t][i]);
  }
  if (seqLevel < 0.05) return;
  for (let t = 0; t < 4; t++) if (sound.seq.pattern[t][s]) {
    const r = dots[t][s].getBoundingClientRect();
    surface.drop(r.left + r.width / 2, r.top + r.height / 2, 6 + t * 5, (0.06 + t * 0.05) * seqLevel);
  }
}
function updateSequencer(dt) {
  // it fades in once you've been in the current a couple of seconds
  if (smoothW.river > 0.35) linger = Math.min(3, linger + dt); else linger = Math.max(0, linger - dt * 2);
  const show = linger > 1.0 ? 1 : 0;
  seqShown += (show - seqShown) * Math.min(1, dt * 1.2);
  seqLevel = smoothW.river;
  if (sound.seq && voiceEls[0] && voiceEls[0].textContent === '\u2014')
    voiceEls.forEach((el, i) => { el.textContent = sound.voiceName(i) || '\u2014'; });
  seqEl.style.opacity = (seqShown * 0.9).toFixed(3);
  seqEl.style.pointerEvents = seqShown > 0.4 ? 'auto' : 'none';
  // the help shows itself as the grid arrives and then gets out of the way; it
  // comes back each time you return, but not once you have started playing
  if (seqShown > 0.5 && !helpSeen) {
    helpSeen = true; helpLeft = 14;
    // sit it just above the grid, whatever height the grid happens to be
    seqHelp.classList.add('show');
  }
  if (seqShown < 0.2) helpSeen = false;
  if (helpLeft > 0) {
    // keep it just above the grid, whatever height the grid happens to be
    const top = seqEl.getBoundingClientRect().top;
    if (top > 1) seqHelp.style.bottom = Math.round(innerHeight - top + 14) + 'px';
    if ((helpLeft -= dt) <= 0) seqHelp.classList.remove('show');
  }
  paramsEl.style.opacity = (seqShown * 0.8).toFixed(3);
  paramsEl.style.pointerEvents = seqShown > 0.4 ? 'auto' : 'none';
  // and the same for the creek and the deep, each shown where it belongs
  let panel = false;
  for (const [el, w] of [[creekP, smoothW.creek || 0], [deepP, smoothW.deep || 0]]) {
    const on = Math.max(0, (w - 0.55) / 0.35);
    el.style.opacity = (Math.min(1, on) * 0.8).toFixed(3);
    el.style.pointerEvents = on > 0.4 ? 'auto' : 'none';
    if (on > 0.4) panel = true;
  }
  document.body.classList.toggle('haspanel', panel);
  sound.setSequencerLevel(seqLevel);
}

// ---------- the compass ----------
// Faint words at the edge of the screen, pointing the way to each region. Only while you drag.
const compassEl = document.getElementById('compass');
const compass = {};
let travelTo = null; // tapped destination
for (const R of REGIONS) {
  const el = document.createElement('span'); el.textContent = R.key; compassEl.appendChild(el); compass[R.key] = el;
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    travelTo = R;
    haptic(6);
  });
}
let compassAlpha = 0, dragT = 0, compassHold = 0;
function updateCompass(touching) {
  const dragging = touching && [...pointers.values()].some(p => p.moved > 12);
  // visible while dragging, and for a long beat after waking or arriving somewhere new
  dragT = (dragging || compassHold > 0) ? Math.min(1, dragT + 0.05) : Math.max(0, dragT - 0.03);
  if (compassHold > 0) compassHold -= 1 / 60;
  compassAlpha = dragT;
  const cx = innerWidth / 2, cy = innerHeight / 2, mx = 54, my = 44;
  for (const R of REGIONS) {
    const el = compass[R.key];
    const dx = world.dx(R.x), dy = world.dy(R.y);
    const d = Math.hypot(dx, dy);
    const w = smoothW[R.key];
    const a = compassAlpha * (1 - w) * 0.55;
    if (a < 0.01 || d < 0.01) { el.style.opacity = 0; continue; }
    // push the label to the screen edge along that direction
    const ux = dx / d, uy = dy / d;
    const k = Math.min((cx - mx) / Math.abs(ux || 1e-6), (cy - my) / Math.abs(uy || 1e-6));
    el.style.left = (cx + ux * k) + 'px'; el.style.top = (cy + uy * k) + 'px';
    el.style.opacity = a.toFixed(2);
    el.style.pointerEvents = a > 0.05 ? 'auto' : 'none';
  }
}

// ---------- leaving a sound ----------
// Hold a finger still on the water and it starts listening. Release to leave a pin there.
const recEl = document.getElementById('rec');
const recArc = recEl.querySelector('.arc');
const recLabel = recEl.querySelector('em');
const namingEl = document.getElementById('naming');
const nameIn = document.getElementById('nameIn');
const sampleIn = document.getElementById('sampleIn');
const MAX_REC = 45; // seconds
const rec = { state: 'idle', started: 0, chunks: [], mr: null, stream: null,
              wx: 0, wy: 0, ox: 0, oy: 0, pin: null, mode: 'record', discard: false };

function showRec(x, y, on) {
  recEl.style.left = x + 'px'; recEl.style.top = y + 'px';
  recEl.style.opacity = on ? 1 : 0;
}

async function startRecording(x, y) {
  if (rec.state !== 'idle') return;
  rec.state = 'asking';
  rec.mode = 'record'; rec.discard = false;
  rec.ox = x; rec.oy = y;
  recEl.classList.remove('armed');
  showRec(x, y, true);
  recLabel.textContent = 'listening';
  recArc.style.strokeDashoffset = 251.3;
  rec.wx = world.at(world.x + (x - innerWidth / 2) / innerHeight);
  rec.wy = world.at(world.y + (y - innerHeight / 2) / innerHeight);
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    rec.state = 'idle';
    recLabel.textContent = location.protocol === 'https:' || location.hostname === 'localhost'
      ? 'no microphone' : 'needs https for the mic';
    setTimeout(() => showRec(x, y, false), 2200);
    return;
  }
  if (rec.state === 'cancelled') { stopStream(); rec.state = 'idle'; showRec(x, y, false); return; }
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  rec.chunks = [];
  rec.mr = new MediaRecorder(rec.stream, type ? { mimeType: type } : undefined);
  rec.mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  rec.mr.onstop = () => finishRecording();
  rec.mr.start();
  rec.state = 'recording';
  rec.started = performance.now();
  haptic(18);
}

// ---------- singing into the cave ----------
const voiceEl = document.getElementById('voice');
const cave = { state: 'idle', mr: null, chunks: [], stream: null, started: 0, x: 0, y: 0, nextRipple: 0, glow: 0 };
const singing = () => cave.state === 'asking' || cave.state === 'singing';
const MAX_SING = 20;

async function startSinging(x, y) {
  if (cave.state !== 'idle') return;
  cave.state = 'asking'; cave.x = x; cave.y = y;
  recEl.classList.add('cave');
  recLabel.textContent = 'sing';
  recArc.style.strokeDashoffset = 251.3;
  showRec(x, y, true);
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
    });
  } catch (err) {
    cave.state = 'idle';
    recLabel.textContent = location.protocol === 'https:' || location.hostname === 'localhost'
      ? 'no microphone' : 'needs https for the mic';
    setTimeout(() => { showRec(x, y, false); recEl.classList.remove('cave'); }, 2200);
    return;
  }
  if (cave.state === 'cancelled') { stream.getTracks().forEach(t => t.stop()); cave.state = 'idle'; showRec(x, y, false); return; }
  cave.stream = stream;
  sound.openCave(stream);                       // your voice starts coming back at once
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  cave.chunks = [];
  cave.mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  cave.mr.ondataavailable = e => { if (e.data && e.data.size) cave.chunks.push(e.data); };
  cave.mr.onstop = () => answerFromCave();
  cave.mr.start();
  cave.state = 'singing';
  cave.started = performance.now();
  haptic(18);
}

function stopSinging() {
  if (cave.state === 'asking') { cave.state = 'cancelled'; return; }
  if (cave.state !== 'singing') return;
  cave.state = 'answering';
  try { cave.mr.stop(); } catch { answerFromCave(); }
}

async function answerFromCave() {
  sound.closeCave();
  if (cave.stream) { cave.stream.getTracks().forEach(t => t.stop()); cave.stream = null; }
  recEl.style.opacity = 0;
  recEl.classList.remove('cave');
  const secs = (performance.now() - cave.started) / 1000;
  const blob = new Blob(cave.chunks, { type: (cave.chunks[0] && cave.chunks[0].type) || 'audio/mp4' });
  cave.state = 'idle';
  if (secs < 0.7 || !blob.size || !sound.ctx) return;
  try {
    const data = await blob.arrayBuffer();
    const buf = await new Promise((ok, fail) => sound.ctx.decodeAudioData(data, ok, fail));
    // the cave answers: pieces of what you sang, at other pitches, thinning out
    sound.scatter(buf, {
      seconds: Math.min(22, 7 + secs * 1.6),
      level: 0.55,
      onGrain: (amp, pan) => {
        const x = innerWidth * (0.5 + pan * 0.42);
        const y = innerHeight * (0.22 + Math.random() * 0.56);
        surface.drop(x, y, 7 + amp * 26, 0.02 + amp * 0.1);
      },
    });
  } catch (err) {
    console.warn('the cave could not answer', err);
  }
}

function stopStream() {
  if (rec.stream) { rec.stream.getTracks().forEach(t => t.stop()); rec.stream = null; }
}

function stopRecording() {
  if (rec.state === 'asking') { rec.state = 'cancelled'; return; }
  if (rec.state !== 'recording') return;
  rec.state = 'saving';
  try { rec.mr.stop(); } catch { finishRecording(); }
}

async function finishRecording() {
  stopStream();
  const secs = (performance.now() - rec.started) / 1000;
  recEl.style.opacity = 0;
  const blob = new Blob(rec.chunks, { type: rec.chunks[0] && rec.chunks[0].type || 'audio/mp4' });
  rec.state = 'idle';
  recEl.classList.remove('armed');
  if (rec.discard) { rec.discard = false; return; } // the file picker is taking over
  if (secs < 1.2 || !blob.size) return; // too short to be a memory of anything
  rec.pin = await pins.add(blob, '', rec.wx, rec.wy);
  surface.drop(innerWidth / 2, innerHeight / 2, 30, 0.2);
  sound.hit(0.5, 0);
  // ask what to call it
  namingEl.style.opacity = 1; namingEl.style.pointerEvents = 'auto';
  nameIn.value = '';
  setTimeout(() => nameIn.focus(), 80);
}

sampleIn.addEventListener('change', async () => {
  const f = sampleIn.files && sampleIn.files[0];
  sampleIn.value = '';
  if (!f) return;
  rec.pin = await pins.add(f, f.name.replace(/\.[^.]+$/, '').slice(0, 40), rec.wx, rec.wy);
  surface.drop(innerWidth / 2, innerHeight / 2, 30, 0.2);
  sound.hit(0.5, 0);
  namingEl.style.opacity = 1; namingEl.style.pointerEvents = 'auto';
  nameIn.value = rec.pin.name || '';
  setTimeout(() => { nameIn.focus(); nameIn.select(); }, 80);
});

function closeNaming() {
  namingEl.style.opacity = 0; namingEl.style.pointerEvents = 'none';
  nameIn.blur(); rec.pin = null;
}
nameIn.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { if (rec.pin && nameIn.value.trim()) pins.rename(rec.pin, nameIn.value.trim()); closeNaming(); }
  if (e.key === 'Escape') closeNaming();
});
nameIn.addEventListener('blur', () => { if (rec.pin && nameIn.value.trim()) pins.rename(rec.pin, nameIn.value.trim()); closeNaming(); });
namingEl.addEventListener('pointerdown', e => e.stopPropagation());

// every ripple of any substance sets off a front that can strike the stones
const screenToWorld = (x, y) => ({
  x: world.at(world.x + (x - innerWidth / 2) / innerHeight),
  y: world.at(world.y + (y - innerHeight / 2) / innerHeight),
});
surface.onDrop = (x, y, radius, strength) => {
  if (strength < 0.055) return;
  const w = screenToWorld(x, y);
  if (smoothW.deep > 0.12) soundings.addFront(w.x, w.y, strength);
  if (smoothW.cove > 0.12) bowl.addFront(w.x, w.y, strength);   // and the bowls answer
};

// ---------- the sky ----------
// The water follows your own clock: the light climbs and falls with the sun,
// goes amber at either end of the day, and on a clear night depends on the moon.
const sky = { daylight: 0, warm: 0, moon: 0.5, sunX: -0.35 };
const LAT = 41;  // the Hudson Valley, near enough for anywhere in the mid north
function readSky() {
  const d = new Date();
  // the sun keeps standard time even when the clocks don't
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  const dst = (Math.max(jan, jul) - d.getTimezoneOffset()) / 60;
  const h = d.getHours() + d.getMinutes() / 60 - dst;
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const rad = Math.PI / 180;
  // where the sun actually is today, so winter afternoons go dark early
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (doy - 81));
  const H = 15 * (h - 12);                       // hour angle, degrees
  const sinEl = Math.sin(rad * LAT) * Math.sin(rad * decl)
              + Math.cos(rad * LAT) * Math.cos(rad * decl) * Math.cos(rad * H);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinEl))) / rad;  // degrees above the horizon
  sky.daylight = smoothstep(-5, 7, elev);
  sky.warm = Math.exp(-Math.pow(elev / 5.5, 2));  // strongest right at the horizon
  // the light tracks across: east in the morning, west in the evening, and the
  // moon simply carries on where the sun left off
  sky.sunX = Math.max(-1, Math.min(1, Math.sin(rad * H)));
  // how full the moon is tonight
  const synodic = 29.530588853;
  const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const phase = (((days % synodic) + synodic) % synodic) / synodic;
  sky.moon = (1 - Math.cos(phase * Math.PI * 2)) / 2;
}
readSky();
setInterval(readSky, 60000);

// ---------- what lives below ----------
// Now and then something passes under the surface. Rare enough to feel like luck.
const below = { list: [], next: performance.now() + 18000 + Math.random() * 30000 };
function spawnBelow(now) {
  // it comes in from off the side and crosses the view
  const ang = Math.random() * Math.PI * 2;
  const reach = 1.5;
  const speed = 0.055 + Math.random() * 0.075;          // heights per second
  const dur = (reach * 2) / speed;
  below.list.push({
    x: world.at(world.x - Math.cos(ang) * reach),
    y: world.at(world.y - Math.sin(ang) * reach),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    size: 0.055 + Math.random() * 0.075,
    born: now, dur: dur * 1000, s: 0, nextRipple: 0,
  });
  // a low, slow sound of something displacing water, never a swish
  if (sound.ready && Math.random() < 0.6) sound.play('hit_bubbles', 0.085, Math.random() * 2 - 1, 0.42 + Math.random() * 0.14);
}
function updateBelow(now, dt) {
  // they keep away from storms, and favour deep water
  if (now > below.next) {
    below.next = now + 26000 + Math.random() * 55000;
    if (weather.storm < 0.3 && Math.random() < 0.35 + smoothW.deep * 0.45) spawnBelow(now);
  }
  const cw = innerWidth, ch = innerHeight;
  surface.crt.fill(0);
  let slot = 0;
  for (const c of below.list) {
    const age = (now - c.born) / c.dur;
    c.x += c.vx * dt; c.y += c.vy * dt;
    // fade in as it arrives, fade out as it goes
    const want = Math.min(smoothstep(0, 0.12, age), 1 - smoothstep(0.86, 1, age));
    c.s += (want - c.s) * Math.min(1, dt * 1.5);
    if (slot < 3) {
      const sx = cw / 2 + world.dx(c.x) * ch, sy = ch / 2 + world.dy(c.y) * ch;
      surface.crt[slot * 4] = sx / cw;
      surface.crt[slot * 4 + 1] = 1 - sy / ch;
      surface.crt[slot * 4 + 2] = c.size;
      surface.crt[slot * 4 + 3] = c.s;
      surface.crtA[slot] = Math.atan2(-c.vy, c.vx);
      slot++;
      // it troubles the surface as it goes
      if (c.s > 0.3 && now > c.nextRipple && sx > -60 && sx < cw + 60 && sy > -60 && sy < ch + 60) {
        c.nextRipple = now + 420 + Math.random() * 900;
        surface.drop(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60, 10 + Math.random() * 16, 0.02 + c.s * 0.03);
      }
    }
  }
  below.list = below.list.filter(c => (now - c.born) / c.dur < 1.05);
}
window.__onedrop.world = world;
window.__onedrop.weights = smoothW;
window.__onedrop.stirRef = () => stir;
window.__onedrop.below = below;
window.__onedrop.spawnBelow = spawnBelow;

// ---------- letting them go ----------
const clearEl = document.getElementById('clear');
let clearFn = null, clearShown = 0;
clearEl.addEventListener('pointerdown', e => { e.stopPropagation(); if (clearFn) { clearFn(); haptic(14); } });
const hintEl = document.getElementById('hint');
let hintShown = 0;
function updateHint(dt) {
  const want = (smoothW.hollow > 0.5 && !singing() && !mapOpen) ? 1 : 0;
  if (want && hintEl.textContent !== 'hold to sing') hintEl.textContent = 'hold to sing';
  hintShown += (want - hintShown) * Math.min(1, dt * 1.5);
  hintEl.style.opacity = (hintShown * 0.8).toFixed(3);
}

function updateClear(dt) {
  let label = null, fn = null;
  if (smoothW.deep > 0.5 && soundings.stones.length) { label = 'let them sink'; fn = () => soundings.clearAll(); }
  else if (smoothW.rain > 0.5 && harp.leaves.length) { label = 'let them go'; fn = () => harp.clearAll(); }
  else if (smoothW.ice > 0.5 && (ice.cracks.length || ice.holes.length)) { label = 'refreeze'; fn = () => ice.refreeze(); }
  else if ((smoothW.creek || 0) > 0.5 && creek.rocks.length) { label = 'lift the rocks'; fn = () => creek.clearAll(); }
  clearFn = fn;
  if (label && clearEl.textContent !== label) clearEl.textContent = label;
  const want = label && !mapOpen ? 1 : 0;
  clearShown += (want - clearShown) * Math.min(1, dt * 2);
  clearEl.style.opacity = (clearShown * 0.9).toFixed(3);
  clearEl.style.pointerEvents = clearShown > 0.4 ? 'auto' : 'none';
}

// ---------- the chart ----------
// A quiet map of the whole water: the areas, every pin, and where you are.
// Tap anywhere on it to set off for that place.
const mapEl = document.getElementById('map');
const plate = mapEl.querySelector('.plate');
const mapToggle = document.getElementById('maptoggle');
let mapOpen = false, mapView = null, meEl = null;

function drawMap() {
  plate.innerHTML = '';
  const w = innerWidth, h = innerHeight, pad = 64;
  // Fit the places, not the whole tile. The water comes back around, so drawing
  // all twelve heights of it would squeeze the seven areas into a knot in the
  // middle and make the one useful thing about the chart unreadable.
  const items = [
    ...REGIONS.map(r => ({ x: r.x, y: r.y, r: r.r })),
    ...pins.pins.map(p => ({ x: p.wx, y: p.wy, r: 0.1 })),
    // wherever you have got to, folded back into the one tile the chart draws
    { x: world.at(world.x), y: world.at(world.y), r: 0.3 },
  ];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.r); maxX = Math.max(maxX, it.x + it.r);
    minY = Math.min(minY, it.y - it.r); maxY = Math.max(maxY, it.y + it.r);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const scale = Math.min((w - pad * 2) / Math.max(0.8, maxX - minX), (h - pad * 2) / Math.max(0.8, maxY - minY));
  mapView = { cx, cy, scale, w, h };
  const sx = x => (x - cx) * scale + w / 2;
  const sy = y => (y - cy) * scale + h / 2;

  for (const R of REGIONS) {
    const a = document.createElement('div'); a.className = 'area';
    const d = R.r * 2 * scale;
    a.style.cssText = `left:${sx(R.x)}px;top:${sy(R.y)}px;width:${d}px;height:${d}px`;
    plate.appendChild(a);
    const l = document.createElement('div'); l.className = 'lab'; l.textContent = R.key;
    // the area's name sits just under its circle, clear of anything floating inside it
    l.style.cssText = `left:${sx(R.x)}px;top:${sy(R.y) + d * 0.5 + 13}px;opacity:0.8`;
    plate.appendChild(l);
  }
  // each area that can be played says so, and takes you straight there
  const GLYPH = {
    bowl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>',
    flake: '<svg viewBox="0 0 24 24"><path d="M12 2.5 v19 M3.8 7.2 l16.4 9.6 M20.2 7.2 l-16.4 9.6"/><path d="M12 6.6 l-2.4 -2.4 M12 6.6 l2.4 -2.4 M12 17.4 l-2.4 2.4 M12 17.4 l2.4 2.4"/><path d="M7.5 9.2 l-3.3 0.2 M7.5 9.2 l-1 -3.1 M16.5 14.8 l3.3 -0.2 M16.5 14.8 l1 3.1"/><path d="M16.5 9.2 l3.3 0.2 M16.5 9.2 l1 -3.1 M7.5 14.8 l-3.3 -0.2 M7.5 14.8 l-1 3.1"/></svg>',
    harp: '<svg viewBox="0 0 24 24"><path d="M5 3.5 v17 M12 3.5 v17 M19 3.5 v17"/><circle class="fill" cx="5" cy="9" r="1.5"/><circle class="fill" cx="12" cy="14" r="1.5"/><circle class="fill" cx="19" cy="7" r="1.5"/></svg>',
    sequencer: '<svg viewBox="0 0 24 24"><circle class="fill" cx="4" cy="12" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle class="fill" cx="16" cy="12" r="1.8"/><circle cx="22" cy="12" r="1.8"/></svg>',
    soundings: '<svg viewBox="0 0 24 24"><circle class="fill" cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/></svg>',
    rocks: '<svg viewBox="0 0 24 24"><path d="M7 2 C9 6 5 8 7 12 C9 16 5 18 7 22"/><path d="M17 2 C19 6 15 8 17 12 C19 16 15 18 17 22"/><circle cx="12" cy="8.5" r="2.1"/><circle cx="11" cy="16" r="1.6"/></svg>',
    crack: '<svg viewBox="0 0 24 24"><path d="M3 5 L8 9 L6.5 13 L11 15.5 L9.5 20"/><path d="M8 9 L13 7.5 L16 10"/><path d="M11 15.5 L16 14 L20 16.5"/><path d="M16 10 L21 8"/></svg>',
    cave: '<svg viewBox="0 0 24 24"><path d="M3 21 C3 10 8 4 12 4 C16 4 21 10 21 21"/><path d="M8.5 21 C8.5 15 10 12 12 12 C14 12 15.5 15 15.5 21"/></svg>',
  };
  for (const R of REGIONS) {
    if (!R.inst) continue;
    const g = document.createElement('div');
    g.className = 'inst';
    g.innerHTML = GLYPH[R.inst] + '<b>' + R.inst + '</b>';
    // a little above the middle, so it never sits under the marker for you
    g.style.cssText = `left:${sx(R.x)}px;top:${sy(R.y) - 19}px`;
    g.addEventListener('pointerdown', e => {
      e.stopPropagation();
      travelTo = { x: R.x, y: R.y };
      haptic(10);
      setMap(false);
    });
    plate.appendChild(g);
  }
  // The cycle is a thing rather than a place, so it is no longer marked on the
  // chart. It is reached from the menu, which is the one way in.
  for (const pin of pins.pins) {
    const m = document.createElement('div'); m.className = 'mp';
    m.style.cssText = `left:${sx(pin.wx)}px;top:${sy(pin.wy)}px`;
    plate.appendChild(m);
    if (pin.name) {
      const l = document.createElement('div'); l.className = 'lab'; l.textContent = pin.name;
      // pin names sit beside their light, so they don't stack on the area names
      l.style.cssText = `left:${sx(pin.wx) + 11}px;top:${sy(pin.wy)}px;font-size:11px;opacity:0.58;`
        + 'transform:translate(0,-50%);letter-spacing:0.14em';
      plate.appendChild(l);
    }
  }
  meEl = document.createElement('div'); meEl.className = 'me';
  meEl.style.cssText = `left:${sx(world.x)}px;top:${sy(world.y)}px`;
  plate.appendChild(meEl);
  const hint = document.createElement('div'); hint.className = 'hint';
  hint.textContent = drift.lifted
    ? `touch the chart to go there  ·  ${drift.lifted} taken out of the water`
    : 'touch the chart to go there';
  plate.appendChild(hint);
  // the two ways off the chart. Not hints: these are things to press, so they
  // look like it, and they sit well clear of the bottom of the phone.
  const links = document.createElement('div');
  links.id = 'chartlinks';
  const mine = pins.pins.filter(p => !p.seeded).length;
  const link = (id, label, fn) => {
    const bEl = document.createElement('b');
    bEl.id = id; bEl.textContent = label;
    bEl.addEventListener('pointerdown', e => { e.stopPropagation(); fn(); haptic(8); });
    links.appendChild(bEl);
  };
  link('shelfopen', mine ? `what you have left  ·  ${mine}` : 'what you have left', () => setShelf(true));
  link('namesopen', 'the naming of water', () => names.open(true));
  // the cycle belongs here too: it is something to go and do, like the rest
  link('cycleopen', 'the cycle', () => { setMap(false); story.begin(); });
  plate.appendChild(links);
}

// ---------- the shelf: everything you have left on the water ----------
// The pins are files, really, and files want looking after: a place to see them
// all, play them, name them, carry them off and throw them away.
const shelfEl = document.getElementById('shelf');
const shelfInner = shelfEl.querySelector('.inner');
let shelfSort = localStorage.getItem('onedrop.pinsort') || 'newest';

function whereIs(p) {
  let best = null, bd = Infinity;
  for (const R of REGIONS) {
    const d = Math.hypot(R.x - p.wx, R.y - p.wy) - R.r;
    if (d < bd) { bd = d; best = R; }
  }
  return bd < 0.35 ? best.key : 'open water';
}
function howLongAgo(t) {
  if (!t) return 'always been here';
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return Math.round(s / 60) + ' minutes ago';
  if (s < 129600) return Math.round(s / 3600) + ' hours ago';
  return Math.round(s / 86400) + ' days ago';
}

function drawShelf() {
  const list = pins.pins.slice();
  const by = {
    newest: (a, b) => (b.created || 0) - (a.created || 0),
    name: (a, b) => (a.name || '~').localeCompare(b.name || '~'),
    where: (a, b) => whereIs(a).localeCompare(whereIs(b)) || (b.created || 0) - (a.created || 0),
  }[shelfSort];
  list.sort(by);
  const yours = list.filter(p => !p.seeded).length;
  shelfInner.innerHTML = '';
  const head = document.createElement('h2'); head.textContent = 'what you have left on the water';
  const sub = document.createElement('div'); sub.className = 'sub';
  sub.textContent = yours
    ? `${yours} of your own${list.length - yours ? `, and ${list.length - yours} that came with the water` : ''}`
    : 'nothing of your own yet. hold a finger still on the water to leave one.';
  shelfInner.appendChild(head); shelfInner.appendChild(sub);

  const sorts = document.createElement('div'); sorts.className = 'sorts';
  for (const k of ['newest', 'name', 'where']) {
    const s = document.createElement('span');
    s.textContent = k; s.className = k === shelfSort ? 'on' : '';
    s.addEventListener('pointerdown', e => {
      e.stopPropagation(); shelfSort = k;
      try { localStorage.setItem('onedrop.pinsort', k); } catch {}
      drawShelf(); haptic(6);
    });
    sorts.appendChild(s);
  }
  shelfInner.appendChild(sorts);

  if (!list.length) {
    const e = document.createElement('div'); e.className = 'empty';
    e.textContent = 'the water is empty.';
    shelfInner.appendChild(e);
    return;
  }

  for (const pin of list) {
    const row = document.createElement('div'); row.className = 'item';
    const nm = document.createElement('div'); nm.className = 'nm';
    nm.textContent = pin.name || 'unnamed';
    if (!pin.seeded) {
      nm.contentEditable = 'true';
      nm.addEventListener('pointerdown', e => e.stopPropagation());
      nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } });
      nm.addEventListener('blur', () => {
        const v = nm.textContent.trim().slice(0, 60);
        nm.textContent = v || 'unnamed';
        pins.rename(pin, v);
      });
    }
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = `${whereIs(pin)}  ·  ${howLongAgo(pin.created)}`;
    const acts = document.createElement('div'); acts.className = 'acts';
    const act = (glyph, title, fn, dim) => {
      const bEl = document.createElement('b');
      bEl.textContent = glyph; bEl.title = title;
      if (dim) bEl.classList.add('gone');
      bEl.addEventListener('pointerdown', e => { e.stopPropagation(); fn(bEl); haptic(8); });
      acts.appendChild(bEl);
      return bEl;
    };
    act('\u25b8', 'hear it', () => { pins.touch(pin); row.classList.add('playing');
                                     setTimeout(() => row.classList.remove('playing'), 2500); });
    act('\u2193', 'save it to this device', () => pins.download(pin), !pin.blob);
    act('\u2316', 'go to it on the water', () => {
      travelTo = { x: pin.wx, y: pin.wy };
      setShelf(false); setMap(false);
    });
    act('\u00d7', 'take it out of the water', bEl => {
      if (bEl.dataset.sure) { pins.forget(pin); drawShelf(); return; }
      bEl.dataset.sure = '1'; bEl.textContent = '\u00d7?';
      setTimeout(() => { if (bEl.isConnected) { delete bEl.dataset.sure; bEl.textContent = '\u00d7'; } }, 3200);
    }).classList.add('rm');
    row.appendChild(nm); row.appendChild(meta); row.appendChild(acts);
    shelfInner.appendChild(row);
  }
}

function setShelf(open) {
  shelfEl.classList.toggle('open', open);
  if (open) drawShelf();
}
shelfEl.querySelector('.close').addEventListener('pointerdown', e => { e.stopPropagation(); setShelf(false); haptic(6); });
shelfEl.addEventListener('pointerdown', e => e.stopPropagation());

// ---------- the panels the other areas get ----------
// The sequencer has had sliders since the beginning; the creek and the deep want
// their own, so the same row is built here for anyone who asks.
function slider(panel, label, value, readout, apply) {
  const row = document.createElement('div'); row.className = 'row';
  const lab = document.createElement('span'); lab.textContent = label;
  const track = document.createElement('div'); track.className = 'track';
  const handle = document.createElement('b');
  handle.style.left = (value * 100) + '%';
  const read = document.createElement('u'); read.textContent = readout(value);
  track.appendChild(handle); row.appendChild(lab); row.appendChild(track); row.appendChild(read);
  panel.appendChild(row);
  const set = x => {
    const r = track.getBoundingClientRect();
    const v = Math.min(1, Math.max(0, (x - r.left) / r.width));
    handle.style.left = (v * 100) + '%';
    read.textContent = readout(v);
    apply(v);
  };
  let held = false;
  row.addEventListener('pointerdown', e => { e.stopPropagation(); held = true; row.setPointerCapture(e.pointerId); set(e.clientX); });
  row.addEventListener('pointermove', e => { if (held) { e.stopPropagation(); set(e.clientX); } });
  row.addEventListener('pointerup', e => { held = false; e.stopPropagation(); });
  row.addEventListener('pointercancel', () => { held = false; });
  apply(value);
}

// a row you tap through, for things that are a list rather than an amount
function picker(panel, label, options, start, apply) {
  const row = document.createElement('div'); row.className = 'row';
  const lab = document.createElement('span'); lab.textContent = label;
  const val = document.createElement('div'); val.className = 'pick';
  let i = Math.max(0, options.indexOf(start));
  val.textContent = options[i];
  row.appendChild(lab); row.appendChild(val);
  panel.appendChild(row);
  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    i = (i + 1) % options.length;
    val.textContent = options[i];
    apply(options[i]);
    haptic(6);
  });
  apply(options[i]);
}

const creekP = document.getElementById('creekp');
slider(creekP, 'echo', 0.25, v => Math.round(v * 100) + '%', v => sound.setCreekEcho(v));

const deepP = document.getElementById('deepp');
picker(deepP, 'key', KEYS, 'D', k => soundings.setKey(k));
picker(deepP, 'scale', Object.keys(SCALES), 'minor pentatonic', s => soundings.setScale(s));

// ---------- the naming of water ----------
const names = new Names(document.getElementById('names'), key => {
  const R = REGIONS.find(r => r.key === key);
  if (R) travelTo = { x: R.x, y: R.y };
  names.open(false); setMap(false);
});
document.getElementById('names').querySelector('.close')
  .addEventListener('pointerdown', e => { e.stopPropagation(); names.open(false); haptic(6); });
document.getElementById('names').addEventListener('pointerdown', e => e.stopPropagation());

// Arriving somewhere used to raise a panel naming the water and explaining it.
// It was too much to read while you were trying to listen, so the water says
// nothing now and the naming lives in the chart menu for anyone who wants it.

function setMap(open) {
  mapOpen = open;
  mapEl.classList.toggle('open', open);
  mapToggle.classList.toggle('open', open);
  document.body.classList.toggle('charting', open);
  if (open) drawMap();
}
mapToggle.addEventListener('pointerdown', e => { e.stopPropagation(); setMap(!mapOpen); haptic(8); });

// the mute: the water keeps moving, it just stops being heard
const muteEl = document.getElementById('mute');
let muted = localStorage.getItem('onedrop.muted') === '1';
function setMuted(on) {
  muted = on;
  muteEl.classList.toggle('off', on);
  sound.setMuted(on);
  try { localStorage.setItem('onedrop.muted', on ? '1' : '0'); } catch {}
}
setMuted(muted);
muteEl.addEventListener('pointerdown', e => { e.stopPropagation(); setMuted(!muted); haptic(6); });

// the ambient water can be set aside while the instruments keep playing
const ambientEl = document.getElementById('ambient');
let ambientOn = localStorage.getItem('onedrop.ambient') !== '0';
function setAmbient(on) {
  ambientOn = on;
  ambientEl.classList.toggle('off', !on);
  sound.setAmbient(on);
  try { localStorage.setItem('onedrop.ambient', on ? '1' : '0'); } catch {}
}
setAmbient(ambientOn);
ambientEl.addEventListener('pointerdown', e => { e.stopPropagation(); setAmbient(!ambientOn); haptic(6); });

// ---------- a word under each ring ----------
const tipEl = document.getElementById('tip');
let tipTimer = 0;
function showTip(el, text) {
  const r = el.getBoundingClientRect();
  tipEl.textContent = text;
  tipEl.style.left = (r.left + r.width / 2) + 'px';
  tipEl.style.opacity = 0.85;
  clearTimeout(tipTimer);
}
function hideTip(after = 0) {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { tipEl.style.opacity = 0; }, after);
}
function labelRing(el, say) {
  el.addEventListener('mouseenter', () => showTip(el, say()));
  el.addEventListener('mouseleave', () => hideTip(0));
  // on a phone there is no hovering, so the word appears as you touch it
  el.addEventListener('pointerdown', () => { showTip(el, say()); hideTip(1600); });
}

// ---------- keeping a ripple ----------
// Records the water and the sound together, for twenty seconds or until you stop it.
const captureEl = document.getElementById('capture');
const captureArc = captureEl.querySelector('.arc');
const keepEl = document.getElementById('keep');
let keepShown = 0;

capture.onReady = ok => {
  captureEl.classList.remove('rolling');
  captureEl.classList.toggle('ready', ok);
  captureArc.style.strokeDashoffset = 50.3;
  keepEl.textContent = ok ? 'keep this ripple' : 'nothing to keep';
  if (!ok) setTimeout(() => { if (capture.state === 'idle') keepEl.textContent = ''; }, 1800);
};

captureEl.addEventListener('pointerdown', e => {
  e.stopPropagation();
  if (capture.state === 'rolling') { capture.stop(); haptic(14); return; }
  if (capture.state === 'ready') { keepRipple(); return; }
  if (!capture.supported()) { keepEl.textContent = 'this browser cannot keep one'; setTimeout(() => keepEl.textContent = '', 2400); return; }
  if (!sound.ctx) { keepEl.textContent = 'touch the water first'; setTimeout(() => keepEl.textContent = '', 2400); return; }
  if (capture.start()) { captureEl.classList.add('rolling'); captureEl.classList.remove('ready'); keepEl.textContent = ''; haptic(18); }
  else { keepEl.textContent = 'this browser cannot keep one'; setTimeout(() => keepEl.textContent = '', 2400); }
});

async function keepRipple() {
  const was = keepEl.textContent;
  keepEl.textContent = 'keeping';
  const how = await capture.keep();
  captureEl.classList.remove('ready');
  keepEl.textContent = how === 'shared' ? 'sent' : how === 'saved' ? 'saved' : was;
  haptic(10);
  if (how === 'shared' || how === 'saved') setTimeout(() => { if (capture.state === 'idle') keepEl.textContent = ''; }, 2000);
}
keepEl.addEventListener('pointerdown', e => { e.stopPropagation(); if (capture.state === 'ready') keepRipple(); });

labelRing(captureEl, () => capture.state === 'rolling' ? 'stop' : capture.state === 'ready' ? 'keep it' : 'keep a ripple');
labelRing(ambientEl, () => ambientOn ? 'ambient water' : 'ambient water off');
labelRing(muteEl, () => muted ? 'sound off' : 'mute');
labelRing(mapToggle, () => mapOpen ? 'close the chart' : 'the chart');
mapEl.addEventListener('pointerdown', e => {
  e.stopPropagation();
  if (!mapView) return;
  const wx = (e.clientX - mapView.w / 2) / mapView.scale + mapView.cx;
  const wy = (e.clientY - mapView.h / 2) / mapView.scale + mapView.cy;
  travelTo = { x: wx, y: wy };
  haptic(10);
  setMap(false);
});

function splatter(x, y, radius, strength) {
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = radius * (1.1 + Math.random() * 2.4);
    setTimeout(() => surface.drop(x + Math.cos(a) * d, y + Math.sin(a) * d, 4 + Math.random() * 8, strength * (0.1 + Math.random() * 0.25)),
      40 + Math.random() * 320);
  }
}
function haptic(ms = 8) {
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
}

// ---------- touch ----------
// A touch is a drop. A drag moves the water with your finger and leaves a light wake.
const pointers = new Map(); // id -> {x, y, t, sx, sy, moved, lastHit}
let holdTimer = 0;
const listening = () => rec.state === 'recording' || rec.state === 'asking';
let dragRock = null;
// Whenever an instrument is actually being played, the water holds still. The
// map drifting out from under your hand mid-note is nobody's idea of playable.
const played = () => bowl.rubbing || bowl.energy > 0.05;   // rubbing, or still ringing from it
const playing = () => listening() || singing() || !!ice.press || !!dragRock || played();
const held = () => playing();
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const now = performance.now();
  if (!awake) { wakeUp(e.clientX, e.clientY); haptic(20); return; }
  if (namingEl.style.pointerEvents === 'auto') { closeNaming(); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now, sx: e.clientX, sy: e.clientY, moved: 0, lastHit: now, vx: 0, vy: 0 });
  world.vx = 0; world.vy = 0;
  // hold still and the water starts listening
  if (pointers.size === 1) {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      const p = pointers.get(e.pointerId);
      if (!p || p.moved >= 10) return;
      if (smoothW.hollow > 0.45) startSinging(p.x, p.y);          // the cave listens instead
      else startRecording(p.x, p.y);
    }, 700);
  }
  // on the ice, pressing splits it: the crack runs for as long as you hold
  if (smoothW.ice > 0.45) {
    clearTimeout(holdTimer);
    const w = screenToWorld(e.clientX, e.clientY);
    // unless you touched open water, which freezes that hole over on its own
    if (ice.closeAt(w.x, w.y)) {
      surface.drop(e.clientX, e.clientY, 12, 0.1);
      settle(); haptic(10);
      return;
    }
    ice.beginPress(w.x, w.y);
    surface.drop(e.clientX, e.clientY, 9, 0.07);
    settle(); haptic(12);
    return;
  }
  // in the rain, a touch sets a leaf out for the rain to play
  if (smoothW.rain > 0.45) {
    const w = screenToWorld(e.clientX, e.clientY);
    if (harp.removeNear(w.x, w.y)) { surface.drop(e.clientX, e.clientY, 16, 0.12); settle(); haptic(10); return; }
    harp.place(w.x, w.y);
    surface.drop(e.clientX, e.clientY, 13, 0.14);
    settle(); haptic(12);
    return;
  }
  // in the cove, touching the water inside a bowl rings it, and the ripple it
  // raises stays in that bowl rather than running off across the water
  // in the snowfield a touch is for the air, not the water: if a crystal is
  // under your finger you take it, and the surface is left alone
  if ((smoothW.snow || 0) > 0.25 && snow.catchAt(e.clientX, e.clientY)) {
    settle(); haptic(8); return;
  }
  if (smoothW.cove > 0.3) {
    const w = screenToWorld(e.clientX, e.clientY);
    if (bowl.tap(w.x, w.y, e.clientX, e.clientY)) { settle(); haptic(12); return; }
  }
  // in the creek, a touch sets a rock in the water, or takes hold of one so you
  // can move it: across the stream for its note, down it for when it sounds
  if ((smoothW.creek || 0) > 0.45) {
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = creek.nearest(w.x, w.y);
    if (hit) {
      dragRock = { rock: hit, moved: 0, dx: world.near(hit.wx - w.x), dy: world.near(hit.wy - w.y) };
      settle(); haptic(10);
    } else if (creek.place(w.x, w.y)) {
      surface.drop(e.clientX, e.clientY, 15, 0.16);
      settle(); haptic(12);
    }
    return;
  }
  // down in the deep, a touch lays a stone on the bed, or lifts one out again
  if (smoothW.deep > 0.45) {
    const w = screenToWorld(e.clientX, e.clientY);
    if (soundings.removeNear(w.x, w.y)) {
      surface.drop(e.clientX, e.clientY, 16, 0.12); settle(); haptic(10);
      return;
    }
    soundings.place(w.x, w.y);
    surface.drop(e.clientX, e.clientY, 13, 0.16);
    settle(); haptic(12);
    return;
  }
  // every touch lands as a drop, right away
  const strength = 0.3 + Math.random() * 0.15;
  surface.drop(e.clientX, e.clientY, 14, strength * 0.6);
  if (Math.random() < 0.9) splatter(e.clientX, e.clientY, 14, strength * 0.6);
  sound.hit(strength, (e.clientX / innerWidth) * 2 - 1);
  haptic(8);
});

canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p || !awake) return;
  const now = performance.now();
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const dt = Math.max(1, now - p.t);
  p.moved += dist;
  p.vx = dx / dt * 1000 / innerHeight; p.vy = dy / dt * 1000 / innerHeight; // heights per sec

  if (p.moved > 10) clearTimeout(holdTimer);
  if (smoothW.cove > 0.4) {
    bowl.feed(e.clientX, e.clientY, now);
    if (played()) { p.x = e.clientX; p.y = e.clientY; p.t = now; p.vx = p.vy = 0; return; }  // rubbing, not steering
  }
  if (dragRock) {                                      // a rock being moved about
    const w = screenToWorld(e.clientX, e.clientY);
    dragRock.rock.wx = w.x + dragRock.dx;
    dragRock.rock.wy = w.y + dragRock.dy;
    dragRock.moved += dist;
    p.x = e.clientX; p.y = e.clientY; p.t = now; p.vx = p.vy = 0;
    return;
  }
  if (ice.press) { p.x = e.clientX; p.y = e.clientY; p.t = now; p.vx = p.vy = 0; return; }  // hold still and it splits
  if (singing()) { p.x = e.clientX; p.y = e.clientY; p.t = now; p.vx = p.vy = 0; return; }
  if (listening()) {
    const up = rec.oy - e.clientY;
    const armed = up > 64;
    if (armed !== (rec.mode === 'upload')) {
      rec.mode = armed ? 'upload' : 'record';
      recEl.classList.toggle('armed', armed);
      haptic(armed ? 10 : 4);
    }
    p.x = e.clientX; p.y = e.clientY; p.t = now;
    return; // the water stays put while it is listening
  }
  // only the first finger steers; the water follows it, unless it is listening
  // or the bowl has started singing, when the water holds still to be played
  if ([...pointers.keys()][0] === e.pointerId && !held()) {
    const G = 1.05; // the water follows the finger, without running ahead of it
    world.x -= dx * G / innerHeight; world.y -= dy * G / innerHeight;
    surface.shift[0] += dx * G; surface.shift[1] += dy * G;
  }
  // a faint wake of water slipping past the finger
  const speed = dist / dt;
  stir = Math.min(1.4, stir + (dist / innerHeight) * 4.2);
  const s = Math.min(0.025, 0.004 + speed * 0.012);
  const steps = Math.min(4, Math.ceil(dist / 8));
  for (let i = 1; i <= steps; i++) surface.drop(p.x + dx * i / steps, p.y + dy * i / steps, 7, s);
  if (now - p.lastHit > 220 && speed > 0.4) {
    sound.hit(Math.min(0.2, speed * 0.15), (e.clientX / innerWidth) * 2 - 1);
    p.lastHit = now;
  }
  p.x = e.clientX; p.y = e.clientY; p.t = now;
});

function release(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const now = performance.now();
  clearTimeout(holdTimer);
  if (dragRock) {
    // let go without having moved it and you have picked it out of the water
    if (dragRock.moved < 8) creek.lift(dragRock.rock); else creek.save();
    dragRock = null; pointers.delete(e.pointerId); haptic(8); return;
  }
  if (ice.press) { ice.endPress(); pointers.delete(e.pointerId); haptic(10); return; }
  if (singing()) { stopSinging(); pointers.delete(e.pointerId); return; }
  if (listening()) {
    if (rec.mode === 'upload') { rec.discard = true; stopRecording(); sampleIn.click(); }
    else stopRecording();
    pointers.delete(e.pointerId); return;
  }
  if (p.moved > 6 && [...pointers.keys()][0] === e.pointerId && now - p.t < 150) {
    // a fling: keep going
    world.vx = -p.vx * 0.85; world.vy = -p.vy * 0.85;
  }
  pointers.delete(e.pointerId);
}
canvas.addEventListener('pointerup', e => { release(e); if (awake) unlockSound(); });
canvas.addEventListener('pointercancel', e => { clearTimeout(holdTimer); if (singing()) stopSinging(); if (listening()) stopRecording(); if (ice.press) ice.endPress(); if (dragRock) { creek.save(); dragRock = null; } pointers.delete(e.pointerId); });
canvas.addEventListener('pointerleave', e => { clearTimeout(holdTimer); if (ice.press) ice.endPress(); pointers.delete(e.pointerId); });

// ---------- ambient drops ----------
let nextAmbient = 2000;
function ambient(now) {
  if (now < nextAmbient) return;
  const rain = smoothW.rain, storm = weather.storm;
  const density = Math.max(rain, storm * 0.9);
  // calm: a drop every few seconds. rain or storm: many per second.
  const gap = density > 0.05 ? (48 + Math.random() * 150) / (0.2 + density) : 1800 + Math.random() * 5200;
  nextAmbient = now + gap;
  const x = innerWidth * (0.05 + Math.random() * 0.9);
  const y = innerHeight * (0.05 + Math.random() * 0.9);
  const s = awake ? (0.03 + Math.random() * 0.08) * (1 + storm * 0.8) : 0.03 + Math.random() * 0.03;
  surface.drop(x, y, 6 + Math.random() * 8, s);
  const q = 1 - 0.75 * (sound.duck || 0);   // the sequencer gets the room
  // a drop that finds a leaf plays it instead of plopping
  const w = screenToWorld(x, y);
  if (awake && harp.rainOn(w.x, w.y, s, smoothW.rain)) return;
  // in the hollow the only water you hear is the cave's own dripping
  const cave = 1 - Math.min(1, (smoothW.hollow || 0) * 1.25);
  if (awake && ambientOn && Math.random() < (density > 0.05 ? 0.12 : 0.6) * q * cave) sound.hit(s * 0.8 * q * cave, (x / innerWidth) * 2 - 1);
}

document.addEventListener('visibilitychange', () => {
  if (!sound.ctx) return;
  if (document.hidden) sound.ctx.suspend(); else sound.resumeAudio();
});
// Coming back from the background, iOS may have moved the context to its own
// 'interrupted' state and dropped the audio session with it. Both need asking
// for again, and a resume outside a gesture can still be refused, which is why
// any touch on the water asks a second time.
addEventListener('pageshow', () => sound.resumeAudio());
addEventListener('focus', () => sound.resumeAudio());
addEventListener('resize', () => surface.resize());

// ---------- the loop ----------
let last = performance.now();
let mixTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const touching = pointers.size > 0;
  if (MARKS.on) MARKS.list.length = 0;   // the instruments are about to say where they are

  if (awake) {
    stir *= Math.pow(0.5, dt);    // and settles again within a second or two
    if (steady > 0) { steady -= dt; world.vx *= Math.exp(-9 * dt); world.vy *= Math.exp(-9 * dt); }
    if (pullHold > 0 && pullHold !== Infinity) pullHold -= dt;
    if (touching) pullHold = 0;   // taking hold of the water ends the truce
    updateRegions(dt, touching);
    updateWeather(now, dt);
    // a tapped compass word carries you there
    if (travelTo) {
      if (touching) travelTo = null; // grabbing the water takes over
      else {
        const dx = world.dx(travelTo.x), dy = world.dy(travelTo.y);
        const d = Math.hypot(dx, dy);
        const sp = Math.min(1.3, Math.max(0.15, d * 1.9)); // slows as it comes in
        const step = sp * dt;
        // move by hand rather than by velocity, so a slow frame can't sail past the mark
        let mx, my;
        if (step >= d) {
          mx = dx; my = dy;
          travelTo = null; pullHold = Infinity; // arrived: stay put until the water is touched again
        } else {
          mx = (dx / d) * step; my = (dy / d) * step;
        }
        world.x += mx; world.y += my;
        surface.shift[0] -= mx * innerHeight; surface.shift[1] -= my * innerHeight;
        world.vx = 0; world.vy = 0;
      }
    }
    // drift with momentum
    if (!touching) {
      const speed = Math.hypot(world.vx, world.vy);
      const cap = 1.0;
      if (speed > cap) { world.vx *= cap / speed; world.vy *= cap / speed; }
      world.x += world.vx * dt; world.y += world.vy * dt;
      // a real glide stirs the water; the slow pull of an area does not
      stir = Math.min(1.4, stir + Math.max(0, Math.hypot(world.vx, world.vy) - 0.18) * dt * 0.8);
      surface.shift[0] -= world.vx * dt * innerHeight; surface.shift[1] -= world.vy * dt * innerHeight;
      // The cove is sheltered water, and the bowls stand still in it. Drift there
      // dies away in a few inches, so you can keep playing without them sliding
      // out from under your hand.
      const fr = Math.exp(-(1.71 + (smoothW.cove || 0) * 13) * dt);
      world.vx *= fr; world.vy *= fr;
    }
    // in the current the water itself slides past (visual only; it doesn't carry you out)
    if (smoothW.river > 0.05) surface.shift[0] -= smoothW.river * 0.10 * dt * innerHeight;
    if ((smoothW.creek || 0) > 0.05) surface.shift[1] -= smoothW.creek * 0.16 * dt * innerHeight;
    updateCompass(touching);
    if (takenLit > 0 && (takenLit -= dt) <= 0) takenEl.classList.remove('lit');
    pins.update(world, dt, now);
    soundings.update(world, smoothW.deep);
    creek.update(world, smoothW.creek || 0, dt, now);
    bowl.update(now, dt, smoothW.cove, pointers.size > 0, world);
    harp.update(world, smoothW.rain);
    snow.update(world, smoothW.snow, dt, now);
    ice.update(world, smoothW.ice || 0, dt, now);
    updateClear(dt);
    updateHint(dt);
    story.place(world, smoothW.cove, awake);
    drift.update(world, dt, now, weather.storm);
    surface.clarity = drift.clarity;
    if (capture.state === 'rolling') {
      const pr = capture.progress();
      captureArc.style.strokeDashoffset = (50.3 * (1 - pr)).toFixed(1);
      if (pr >= 1) capture.stop();
    }
    const wantKeep = keepEl.textContent ? 1 : 0;
    keepShown += (wantKeep - keepShown) * Math.min(1, dt * 3);
    keepEl.style.opacity = keepShown.toFixed(3);
    keepEl.style.pointerEvents = keepShown > 0.5 && capture.state === 'ready' ? 'auto' : 'none';
    if (mapOpen && meEl && mapView) {
      meEl.style.left = ((world.at(world.x) - mapView.cx) * mapView.scale + mapView.w / 2) + 'px';
      meEl.style.top = ((world.at(world.y) - mapView.cy) * mapView.scale + mapView.h / 2) + 'px';
    }
    // the cave: your voice makes the water move, and a glow swells around it
    if (cave.state === 'singing') {
      const secs = (now - cave.started) / 1000;
      recArc.style.strokeDashoffset = (251.3 * (1 - Math.min(1, secs / MAX_SING))).toFixed(1);
      if (secs > MAX_SING) stopSinging();
      const level = sound.caveLevel();
      cave.glow += (level - cave.glow) * Math.min(1, dt * 6);
      const size = 150 + cave.glow * 520;
      voiceEl.style.width = voiceEl.style.height = size.toFixed(0) + 'px';
      voiceEl.style.left = cave.x + 'px'; voiceEl.style.top = cave.y + 'px';
      voiceEl.style.opacity = Math.min(0.9, cave.glow * 1.6).toFixed(2);
      if (level > 0.06 && now > cave.nextRipple) {
        cave.nextRipple = now + 70 + Math.random() * 90;
        const a = Math.random() * Math.PI * 2, r = (20 + Math.random() * 90) * (0.4 + cave.glow);
        surface.drop(cave.x + Math.cos(a) * r, cave.y + Math.sin(a) * r,
                     8 + level * 30, 0.02 + level * 0.22);
      }
    } else if (voiceEl.style.opacity !== '0') {
      cave.glow *= Math.pow(0.1, dt);
      voiceEl.style.opacity = cave.glow < 0.02 ? '0' : (cave.glow * 1.6).toFixed(2);
    }
    // the recording ring fills as it listens
    if (rec.state === 'recording') {
      const secs = (now - rec.started) / 1000;
      recArc.style.strokeDashoffset = (251.3 * (1 - Math.min(1, secs / MAX_REC))).toFixed(1);
      if (secs > MAX_REC) stopRecording();
    }
    surface.world[0] = world.x; surface.world[1] = world.y;
    surface.region[0] = smoothW.rain; surface.region[1] = smoothW.river;
    surface.region[2] = smoothW.cove; surface.region[3] = smoothW.deep;
    surface.storm = weather.storm;
    surface.hollow = smoothW.hollow || 0;
    // the keys under the harp: they arrive with the leaves and go with them
    surface.creek = Math.min(1, (smoothW.creek || 0) * 1.1);
    surface.frost = Math.min(1, (smoothW.ice || 0) * 1.15);
    surface.freeze = Math.min(1, (smoothW.ice || 0) * 1.25);   // a sheet carries no waves
    surface.daylight = sky.daylight; surface.warm = sky.warm;
    surface.moon = sky.moon; surface.sunX = sky.sunX;
    updateBelow(now, dt);
    surface.churn = weather.storm * (0.6 + smoothW.rain * 0.4);
    surface.damp = 0.994 - smoothW.deep * 0.004 - weather.storm * 0.003;
    // ice does not ripple the way water does: it holds whatever shape it is in
    surface.damp = Math.min(0.9994, surface.damp + (smoothW.ice || 0) * 0.0045);
    if ((mixTimer += dt) > 0.25) { mixTimer = 0; updateSequencer(0.25); sound.setMix(smoothW, weather.storm, stir); }
  }
  if (story.active) {
    // the cycle takes the wheel: it writes the weights and the look, and the rest follows
    story.place(world, 0);
    pins.update(world, dt, now);     // so a nearby pin fades out as the drop leaves
    if (!story.update(dt, now, world, smoothW)) document.body.classList.remove('cycling');
    cycleStep.querySelector('.back').classList.toggle('off', story.at().i <= 0);
    if ((mixTimer += dt) > 0.25) { mixTimer = 0; sound.setMix(smoothW, surface.storm, 0.6); }
  } else {
    ambient(now);
  }
  surface.step(now / 1000);
  if (MARKS.on) capture.frame();         // the water, with everything standing on it
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// tiny dev aid: ?debug shows where you are
if (location.search.includes('debug')) {
  const d = document.getElementById('status'); d.style.opacity = 0.7;
  setInterval(() => { d.textContent = `x ${world.x.toFixed(2)} y ${world.y.toFixed(2)}  cove ${smoothW.cove.toFixed(2)} rain ${smoothW.rain.toFixed(2)} river ${smoothW.river.toFixed(2)} deep ${smoothW.deep.toFixed(2)}  storm ${weather.storm.toFixed(2)} ${weather.phase}`; }, 200);
}

// One Drop — the surface.
// A height-field wave simulation on the GPU, rendered as dark abstract water.
// The field scrolls with the world so you can drift across it.

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// Simulation: r = height, g = previous height.
const SIM = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D prev;
uniform vec2 texel;
uniform vec2 shift;   // how far the world moved this step, in uv
uniform float damp;
uniform float churn;  // storm: random agitation 0..1
uniform float t;
uniform int nDrops;
uniform vec4 drops[16]; // x, y (uv), radius (uv), strength
uniform float seeds[16]; // one random angle per drop
uniform int nRims;
uniform vec3 rims[6];   // x, y (uv) and radius (in y-uv units) of a standing rim

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 suv = uv - shift;
  vec2 c = texture(prev, suv).rg;
  float n = texture(prev, suv + vec2(0.0,  texel.y)).r;
  float s = texture(prev, suv - vec2(0.0,  texel.y)).r;
  float e = texture(prev, suv + vec2(texel.x, 0.0)).r;
  float w = texture(prev, suv - vec2(texel.x, 0.0)).r;
  float h = (n + s + e + w) * 0.5 - c.g;
  h *= damp;
  for (int i = 0; i < 16; i++) {
    if (i >= nDrops) break;
    vec4 d = drops[i];
    vec2 dv = (uv - d.xy) * vec2(texel.y / texel.x, 1.0); // aspect-correct
    float ang = atan(dv.y, dv.x);
    float seed = seeds[i];
    float wob = 1.0 + 0.38 * sin(ang * 2.0 + seed) + 0.26 * sin(ang * 3.0 - seed * 1.7) + 0.18 * sin(ang * 5.0 + seed * 0.6) + 0.10 * sin(ang * 9.0 - seed * 2.3);
    float r = length(dv) / (d.z * wob);
    if (r < 1.0) { float k = cos(r * 1.5707963); h -= d.w * k * k; }
  }
  // The rim of a bowl is a wall the water cannot cross. Holding those cells at
  // rest reflects whatever reaches them, so a ripple started inside a bowl stays
  // in it and goes round and round, and the open water outside breaks against
  // the rim instead of washing through.
  for (int i = 0; i < 6; i++) {
    if (i >= nRims) break;
    vec2 dv = (uv - rims[i].xy) * vec2(texel.y / texel.x, 1.0);
    if (abs(length(dv) - rims[i].z) < texel.y * 1.6) h = 0.0;
  }
  // storm churn: pinpricks of noise everywhere
  if (churn > 0.001) {
    float rnd = hash(uv * 913.0 + fract(t * 7.1));
    if (rnd > 0.9975) h -= churn * 0.05 * hash(uv * 31.0 + t);
  }
  // soft walls so waves die at the edge instead of bouncing hard
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  h *= smoothstep(0.0, 0.015, edge);
  // anything that scrolled in from outside the field starts flat
  float inside = (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) ? 0.0 : 1.0;
  o = vec4(h * inside, c.r * inside, 0.0, 1.0);
}`;

// Render: shade the height field as deep, dark water.
const DRAW = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D field;
uniform vec2 texel;
uniform vec2 res;
uniform vec2 world;   // world offset in screen-heights, for the light below
uniform float t;
uniform float wake;   // 0 = asleep, 1 = awake
uniform vec4 region;  // rain, river, cove, deep weights
uniform float storm;  // 0..1
uniform float hollow; // 0..1, how far into the cave
uniform float clarity; // 1 clean, lower when things are left floating in it
uniform float pale;    // 0..1, vapour and cloud: water with the colour taken out
uniform float frost;   // 0..1, water that has stopped moving
uniform float creek;   // 0..1, shallow water running over stones
uniform float daylight; // 0 night, 1 midday
uniform float warm;     // 1 at sunrise and sunset
uniform float moon;     // how full it is, 0..1
uniform float sunX;     // where the light sits, -1 east to 1 west
uniform vec4 crt[3];    // things moving below: x, y (uv), size, strength
uniform float crtA[3];  // which way each one is headed

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }

void main(){
  float hL = texture(field, uv - vec2(texel.x, 0.0)).r;
  float hR = texture(field, uv + vec2(texel.x, 0.0)).r;
  float hD = texture(field, uv - vec2(0.0, texel.y)).r;
  float hU = texture(field, uv + vec2(0.0, texel.y)).r;
  float h  = texture(field, uv).r;
  vec2 grad = vec2(hR - hL, hU - hD);
  float rain = region.x, cur = region.y, cove = region.z, deep = region.w;

  vec2 asp = vec2(res.x / res.y, 1.0);
  // capillary shimmer, stronger in rain and storm
  vec2 suv = (uv * asp + world * 0.6) * 28.0;
  float sh1 = noise(suv + vec2(t * 0.35, t * 0.21));
  float sh2 = noise(suv * 1.7 - vec2(t * 0.27, t * 0.4));
  grad += (vec2(sh1 - 0.5, sh2 - 0.5)) * (0.009 + rain * 0.006 + storm * 0.012) * wake;
  // river: long streaks sliding past
  float streak = noise(vec2((uv.x * asp.x + world.x) * 3.0 - t * 0.6, (uv.y + world.y) * 40.0));
  grad.x += (streak - 0.5) * 0.02 * cur;
  // Ice has a grain of its own, frozen into it and locked to the world, so it
  // holds still underfoot instead of swimming about the way water does.
  float icef = 0.0, vein = 0.0;
  if (frost > 0.002) {
    vec2 ip = (uv * asp + world) * 5.5;
    icef = fbm(ip * 1.7) * 0.58 + fbm(ip * 5.3) * 0.30 + noise(ip * 17.0) * 0.12;
    vein = smoothstep(0.05, 0.0, abs(fbm(ip * 0.8) - 0.5));   // where it froze and refroze
    // the capillary shimmer belongs to moving water; on ice the grain takes over
    grad = mix(grad, vec2(dFdx(icef), dFdy(icef)) * 1.5, frost);
  }
  vec3 nrm = normalize(vec3(-grad * 9.0, 1.0));

  // the depths: slow drifting light under the surface, seen through refraction (parallax with drift)
  vec2 ruv = (uv + grad * 0.12) * asp + world * 0.35;
  float d1 = fbm(ruv * 1.6 + vec2(t * 0.012, -t * 0.009));
  float d2 = fbm(ruv * 3.1 - vec2(t * 0.007, t * 0.011));
  float glow = smoothstep(0.35, 0.95, d1 * 0.7 + d2 * 0.5);

  vec3 abyss = vec3(0.024, 0.046, 0.072);
  vec3 blue  = vec3(0.07, 0.20, 0.31);
  vec3 teal  = vec3(0.12, 0.38, 0.44);
  // daylight lifts the whole water toward a cold slate green
  abyss = mix(abyss, vec3(0.050, 0.090, 0.105), daylight);
  blue  = mix(blue,  vec3(0.115, 0.285, 0.330), daylight);
  teal  = mix(teal,  vec3(0.250, 0.520, 0.510), daylight);
  // regions shift the palette: rain goes grey-green, river goes clear and cool, deep goes indigo
  abyss = mix(abyss, vec3(0.03, 0.05, 0.055), rain);
  teal  = mix(teal,  vec3(0.20, 0.40, 0.38), rain);
  blue  = mix(blue,  vec3(0.09, 0.24, 0.33), cur);
  abyss = mix(abyss, vec3(0.010, 0.012, 0.045), deep);
  // the hollow: wet stone, warmer and greyer than open water
  abyss = mix(abyss, vec3(0.030, 0.029, 0.027), hollow);
  blue  = mix(blue,  vec3(0.105, 0.098, 0.088), hollow);
  teal  = mix(teal,  vec3(0.195, 0.175, 0.150), hollow);
  blue  = mix(blue,  vec3(0.04, 0.07, 0.24), deep);
  teal  = mix(teal,  vec3(0.10, 0.16, 0.42), deep);
  vec3 col = mix(abyss, blue, glow * 0.85);
  col = mix(col, teal, pow(glow, 3.0) * 0.55);
  // water left to itself goes dull: the light below it gets through less
  float murk = 1.0 - clarity;
  col = mix(col, vec3(0.062, 0.070, 0.050), murk * 0.4);
  col *= 1.0 - murk * 0.12;
  // vapour: the colour drains out and the light comes from everywhere at once
  col = mix(col, vec3(0.50, 0.53, 0.56) * (0.42 + glow * 0.75), pale);
  // The creek runs shallow: the light goes down, finds the stones on the bed and
  // comes back, so you see through it rather than into it.
  if (creek > 0.002) {
    vec2 bp = (uv * asp + world) * 6.5;
    float bed = fbm(bp * 2.1) * 0.58 + fbm(bp * 5.7) * 0.42;
    float stones = fbm(bp * 3.4);
    vec3 ck = mix(vec3(0.070, 0.125, 0.128), vec3(0.400, 0.480, 0.440), bed);
    ck = mix(ck, vec3(0.235, 0.300, 0.290), smoothstep(0.42, 0.72, stones) * 0.55);
    ck *= 0.70 + glow * 0.6;                        // the water's own light over the bed
    ck += vec3(0.08, 0.13, 0.12) * smoothstep(0.60, 0.94, bed);  // the shallowest stones
    col = mix(col, ck, creek * 0.88);
  }
  // Ice: not water any more. The light stops at the surface rather than coming
  // up from below, so the depths go out and the grain is all there is to see.
  if (frost > 0.002) {
    vec3 ic = vec3(0.555, 0.650, 0.725) * (0.52 + icef * 0.72);
    ic = mix(ic, vec3(0.84, 0.90, 0.95), vein * 0.5);                    // frost along the seams
    ic = mix(ic, vec3(0.20, 0.31, 0.42), smoothstep(0.55, 0.2, icef) * 0.45); // clear and dark where it is thin
    col = mix(col, ic, frost * 0.96);
  }

  vec3 L = normalize(vec3(sunX * 0.55, 0.52, 0.72));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = max(dot(nrm, L), 0.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(nrm, H), 0.0), 220.0);
  float rim  = pow(1.0 - max(dot(nrm, V), 0.0), 2.5);

  // moonlight is pale and cold, sunlight white, and at either end of the day it goes amber
  vec3 specCol = mix(vec3(0.72, 0.84, 0.95), vec3(1.0, 0.98, 0.92), daylight);
  specCol = mix(specCol, vec3(1.0, 0.60, 0.26), warm * 0.85);
  float specAmt = (0.9 + storm * 0.6) * mix(0.35 + 0.65 * moon, 1.0, daylight);
  col += vec3(0.08, 0.14, 0.18) * diff * mix(0.35, 0.7, daylight);
  col += specCol * spec * specAmt * (1.0 - pale * 0.8) * (1.0 + frost * 2.2);
  col += vec3(0.11, 0.14, 0.17) * diff * frost * 0.9;      // the broad matte sheen of ice
  col += vec3(0.18, 0.30, 0.36) * rim * 0.6;
  // the low sun lays a warm film over the whole surface
  col += vec3(0.30, 0.13, 0.04) * warm * (0.25 + glow * 0.75) * 0.5;
  // a dark night with no moon is very dark indeed
  col *= mix(0.56 + 0.44 * moon, 1.0, daylight);
  col += vec3(0.10, 0.18, 0.22) * clamp(h * 6.0, -0.5, 0.8) * (1.0 - frost * 0.92);

  // storm: the light flickers, like clouds crossing a moon
  float flick = 0.85 + 0.15 * noise(vec2(t * 2.3, 7.0)) + 0.25 * step(0.995, hash(vec2(floor(t * 12.0), 3.0))) * storm;
  col *= mix(1.0, flick, storm);
  col *= 1.0 - deep * 0.35;

  // something passing underneath
  for (int i = 0; i < 3; i++) {
    if (crt[i].w < 0.002) continue;
    vec2 e = (uv - crt[i].xy) * vec2(res.x / res.y, 1.0);
    float ca = cos(crtA[i]), sa = sin(crtA[i]);
    vec2 r = vec2(e.x * ca + e.y * sa, -e.x * sa + e.y * ca);
    r.x /= 2.9;                                  // long in the direction of travel
    float m = 1.0 - smoothstep(0.0, crt[i].z, length(r));
    float body = pow(m, 1.5);
    // a dark form, with the light it disturbs gathering around its edge
    float edge = pow(m, 2.6) * (1.0 - pow(m, 1.1));
    col *= 1.0 - body * 0.45 * crt[i].w;
    col += vec3(0.085, 0.175, 0.205) * edge * 4.1 * crt[i].w;
    col += vec3(0.05, 0.11, 0.13) * pow(m, 9.0) * crt[i].w * 0.8;
  }

  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * (0.7 + hollow * 0.9);   // the cave closes in around you
  col += (hash(uv * res + fract(t)) - 0.5) * 0.012;
  col *= mix(0.22, 1.0, wake);
  o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const U = (gl, p, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)]));

export class Surface {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) throw new Error('no float render targets');

    // The GPU can take the context away at any time, and on a phone it does:
    // iOS discards contexts under memory pressure, and does it most readily to
    // a web app that has been sitting in the background, which is exactly how
    // this is meant to be run. Without these two listeners that is a black
    // screen until someone reloads. With them, the water is rebuilt and fades
    // back in, flat, as though it had been let be for a while.
    this.lost = false;
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();              // let the browser know we will cope, so it offers it back
      this.lost = true;
      this.pending.length = 0;
      if (this.onLost) this.onLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;               // first, or resize() will not make targets
      this.W = this.H = 0;             // force the targets to be made again
      this.build();
      this.wake = 0;                   // and it comes up gently rather than all at once
      if (this.onRestored) this.onRestored();
    });

    this.pending = [];
    this.dropData = new Float32Array(16 * 4);
    this.seedData = new Float32Array(16);
    this.wake = 0; this.wakeTarget = 0;
    this.damp = 0.994;
    this.rims = [];                    // standing walls the water cannot cross
    this.rimData = new Float32Array(18);
    this.churn = 0;
    this.storm = 0;
    this.region = [0, 0, 1, 0];
    this.daylight = 0; this.warm = 0; this.moon = 0.5; this.sunX = -0.35; this.hollow = 0; this.clarity = 1; this.pale = 0; this.frost = 0; this.freeze = 0; this.creek = 0;
    this.crt = new Float32Array(12);   // three things below, four numbers each
    this.crtA = new Float32Array(3);
    this.world = [0, 0];       // in screen-heights
    this.shift = [0, 0];       // this frame's movement in css px
    this.build();
  }

  // Everything that lives on the GPU side, made once at the start and again if
  // the context is lost and given back. Nothing in here may be kept from before.
  build() {
    const gl = this.gl;
    // extensions belong to the context and go with it: without asking again,
    // a half-float target is not something the GPU will let us draw into
    if (!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')))
      throw new Error('no float render targets');
    this.simProg = program(gl, VERT, SIM);
    this.drawProg = program(gl, VERT, DRAW);
    this.us = U(gl, this.simProg, ['prev', 'texel', 'shift', 'damp', 'churn', 't', 'nDrops', 'drops', 'seeds', 'nRims', 'rims']);
    this.ud = U(gl, this.drawProg, ['field', 'texel', 'res', 'world', 't', 'wake', 'region', 'storm',
      'daylight', 'warm', 'moon', 'sunX', 'crt', 'crtA', 'hollow', 'clarity', 'pale', 'frost', 'creek']);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.targets = null;
    this.resize();
  }

  resize() {
    if (this.lost) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(this.canvas.clientWidth * dpr);
    const H = Math.floor(this.canvas.clientHeight * dpr);
    if (!W || !H) return;             // hidden, or not laid out yet: nothing to size to
    if (W === this.W && H === this.H && this.targets) return;
    this.W = W; this.H = H;
    this.canvas.width = W; this.canvas.height = H;
    const scale = Math.min(1, 640 / Math.max(W, H));
    const sw = Math.max(64, Math.floor(W * scale));
    const sh = Math.max(64, Math.floor(H * scale));
    const gl = this.gl;
    const old = this.targets, oldCur = this.cur || 0;
    this.sw = sw; this.sh = sh;
    this.targets = [0, 1].map(() => this.makeTarget(sw, sh));
    this.cur = 0;
    if (old) {
      // Carry the water across rather than starting from flat. A resize is not
      // only turning the phone: a keyboard coming up for a pin's name fires one
      // too, and it used to wipe every ripple on the screen. The field is a
      // height map, so stretching it a little is harmless.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, old[oldCur].fb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.targets[0].fb);
      gl.blitFramebuffer(0, 0, old.sw || sw, old.sh || sh, 0, 0, sw, sh, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // and let the old ones go, which they never were before: every orientation
      // change left two float targets behind on the GPU for the life of the page
      for (const t of old) { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); }
    }
    this.targets.sw = sw; this.targets.sh = sh;
  }

  makeTarget(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb };
  }

  // How far a wavefront travels in one frame, in screen-heights.
  // The solver h = (n+s+e+w)/2 - prev carries waves at sqrt(1/2) cells per step,
  // and the simulation takes two steps a frame, so this holds however fast or
  // slow the frames are coming.
  waveStep() { return Math.SQRT1_2 * 2 / this.sh; }

  // x, y in CSS pixels. radius in CSS px. strength ~ 0.02 (tiny) .. 0.6 (big)
  // force is for the few things that are allowed to move frozen water, such as
  // the whole sheet giving way at once
  drop(x, y, radius = 24, strength = 0.25, force = false) {
    const u = x / this.canvas.clientWidth;
    const v = 1 - y / this.canvas.clientHeight;
    const st = force ? strength : strength * (1 - this.freeze);
    this.pending.push([u, v, radius / this.canvas.clientHeight, st, Math.random() * Math.PI * 2]);
    if (this.onDrop && !this.quiet) this.onDrop(x, y, radius, strength);
  }

  step(time) {
    if (this.lost || !this.targets) return;
    const gl = this.gl;
    this.wake += (this.wakeTarget - this.wake) * 0.02;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;

    gl.useProgram(this.simProg);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.sw, this.sh);
    gl.uniform2f(this.us.texel, 1 / this.sw, 1 / this.sh);
    // ice does not carry a wave: what is already moving dies in a fraction of a second
    gl.uniform1f(this.us.damp, this.damp - this.freeze * 0.1);
    gl.uniform1f(this.us.churn, this.churn);
    gl.uniform1f(this.us.t, time);
    const nr = Math.min(this.rims.length, 6);
    for (let i = 0; i < nr; i++) {
      this.rimData[i * 3] = this.rims[i][0];
      this.rimData[i * 3 + 1] = this.rims[i][1];
      this.rimData[i * 3 + 2] = this.rims[i][2];
    }
    gl.uniform1i(this.us.nRims, nr);
    gl.uniform3fv(this.us.rims, this.rimData);
    for (let sub = 0; sub < 2; sub++) {
      const n = sub === 0 ? Math.min(this.pending.length, 16) : 0;
      for (let i = 0; i < n; i++) {
        const d = this.pending[i];
        this.dropData[i * 4] = d[0]; this.dropData[i * 4 + 1] = d[1];
        this.dropData[i * 4 + 2] = d[2]; this.dropData[i * 4 + 3] = d[3];
        this.seedData[i] = d[4];
      }
      gl.uniform1i(this.us.nDrops, n);
      gl.uniform4fv(this.us.drops, this.dropData);
      gl.uniform1fv(this.us.seeds, this.seedData);
      // the world moves under the field: scroll it (only on the first substep)
      if (sub === 0) gl.uniform2f(this.us.shift, this.shift[0] / cw, -this.shift[1] / ch);
      else gl.uniform2f(this.us.shift, 0, 0);
      const src = this.targets[this.cur], dst = this.targets[1 - this.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.us.prev, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.cur = 1 - this.cur;
    }
    this.pending.splice(0, 16);
    this.shift[0] = 0; this.shift[1] = 0;

    gl.useProgram(this.drawProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.cur].tex);
    gl.uniform1i(this.ud.field, 0);
    gl.uniform2f(this.ud.texel, 1 / this.sw, 1 / this.sh);
    gl.uniform2f(this.ud.res, this.W, this.H);
    gl.uniform2f(this.ud.world, this.world[0], -this.world[1]);
    gl.uniform1f(this.ud.t, time);
    gl.uniform1f(this.ud.wake, this.wake);
    gl.uniform4fv(this.ud.region, this.region);
    gl.uniform1f(this.ud.storm, this.storm);
    gl.uniform1f(this.ud.hollow, this.hollow);
    gl.uniform1f(this.ud.clarity, this.clarity);
    gl.uniform1f(this.ud.pale, this.pale);
    gl.uniform1f(this.ud.frost, this.frost);
    gl.uniform1f(this.ud.creek, this.creek);
    gl.uniform1f(this.ud.daylight, this.daylight);
    gl.uniform1f(this.ud.warm, this.warm);
    gl.uniform1f(this.ud.moon, this.moon);
    gl.uniform1f(this.ud.sunX, this.sunX);
    gl.uniform4fv(this.ud.crt, this.crt);
    gl.uniform1fv(this.ud.crtA, this.crtA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

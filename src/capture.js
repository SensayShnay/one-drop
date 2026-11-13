// One Drop — keeping a ripple.
// Records the water and everything you can hear, as one file you can send on.
//
// The instruments are drawn as elements laid over the canvas, and a canvas
// recording only sees the canvas, so recording the surface directly gave back
// bare water with the bowls, stones, leaves and the rest missing. Instead this
// keeps a canvas of its own: every frame it copies the water onto it and paints
// the marks on top, from the notes each instrument leaves in MARKS. The controls
// and the writing stay out of it, which is still what you want.
import { MARKS, paintMarks } from './marks.js';

const TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',   // what Safari wants, and what phones like
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

// Trust the file, not the label: browsers do not always hand back the container
// they were asked for, and an extension that lies will not open anywhere.
async function sniff(blob, claimed) {
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (head[0] === 0x1A && head[1] === 0x45 && head[2] === 0xDF && head[3] === 0xA3) return 'webm';
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return 'mp4';
  } catch {}
  return claimed.includes('mp4') ? 'mp4' : 'webm';
}

export class Capture {
  constructor(sound, canvas) {
    this.sound = sound;
    this.canvas = canvas;
    this.state = 'idle';        // idle | rolling | ready
    this.blob = null;
    this.started = 0;
    this.max = 20;
  }

  supported() {
    return !!(window.MediaRecorder && document.createElement('canvas').captureStream);
  }

  // the water, and then everything standing on it
  frame() {
    if (!this.ctx) return;
    const c = this.out, s = this.canvas;
    if (c.width !== s.width || c.height !== s.height) { c.width = s.width; c.height = s.height; }
    const sc = c.width / (s.clientWidth || c.width);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, c.width, c.height);
    try { this.ctx.drawImage(s, 0, 0, c.width, c.height); } catch {}
    this.ctx.setTransform(sc, 0, 0, sc, 0, 0);   // marks are noted in css pixels
    paintMarks(this.ctx);
  }

  start() {
    if (this.state === 'rolling' || !this.supported()) return false;
    const audio = this.sound.captureStream();
    if (!audio) return false;
    if (!this.out) {
      this.out = document.createElement('canvas');
      this.ctx = this.out.getContext('2d', { alpha: false });
    }
    this.out.width = this.canvas.width; this.out.height = this.canvas.height;
    MARKS.on = true;
    this.frame();
    let video;
    try { video = this.out.captureStream(30); } catch { MARKS.on = false; return false; }
    const stream = new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]);
    const type = TYPES.find(t => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    try {
      this.mr = new MediaRecorder(stream, {
        ...(type ? { mimeType: type } : {}),
        videoBitsPerSecond: 3000000,
        audioBitsPerSecond: 128000,
      });
    } catch { return false; }
    this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.onstop = async () => {
      const t = (this.chunks[0] && this.chunks[0].type) || type || 'video/webm';
      this.blob = new Blob(this.chunks, { type: t });
      this.ext = await sniff(this.blob, t);
      MARKS.on = false;
      this.state = this.blob.size > 1000 ? 'ready' : 'idle';
      this.onReady && this.onReady(this.state === 'ready');
    };
    this.mr.start();
    this.state = 'rolling';
    this.started = performance.now();
    return true;
  }

  stop() {
    if (this.state !== 'rolling') return;
    try { this.mr.stop(); } catch { this.state = 'idle'; }
  }

  progress() {
    if (this.state !== 'rolling') return 0;
    return Math.min(1, (performance.now() - this.started) / 1000 / this.max);
  }

  // Must be called straight from a touch: the share sheet will not open otherwise.
  async keep() {
    if (this.state !== 'ready' || !this.blob) return 'none';
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const name = `one-drop-${stamp}.${this.ext}`;
    const file = new File([this.blob], name, { type: this.blob.type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'One Drop' });
        this.clear();
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';   // they changed their mind
    }
    const url = URL.createObjectURL(this.blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.clear();
    return 'saved';
  }

  clear() { this.blob = null; this.state = 'idle'; }
}

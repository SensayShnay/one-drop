// One Drop — the way in.
//
// A few cards before the water, the first time someone arrives. The piece has
// no buttons for most of what it does, so without a word or two people touch
// it once, hear a drop, and leave without finding the instruments, the travel,
// or that a held finger listens.
//
// It is meant to be read in under half a minute and then gotten out of the way.
// Every card can be skipped. It ends by telling you to do the one thing it was
// all leading to, and then it goes, so the first real ripple is yours: the
// touch that enters is a touch on the water, not a tap on a button.
//
// Seen once, it is not shown again on this device. The chart has a way back.

const CARDS = [
  {
    title: 'every touch is a drop',
    body: 'Touch anywhere and the water answers with a drop of sound. No two land quite the same.',
    fig: `<svg viewBox="0 0 120 90">
      <circle class="ring r1" cx="60" cy="58" r="10"/><circle class="ring r2" cx="60" cy="58" r="10"/><circle class="ring r3" cx="60" cy="58" r="10"/>
      <path class="fall" d="M60 10 c0 0 -7 10 -7 15 a7 7 0 0 0 14 0 c0 -5 -7 -15 -7 -15 z"/></svg>`,
  },
  {
    title: 'drift',
    body: 'Drag to move across the water. The names at the edges are the places around you; tap one to go there. Go far enough in any direction and you come back around.',
    fig: `<svg viewBox="0 0 120 90">
      <g class="names"><text x="60" y="12">deep</text><text x="60" y="86">rain</text><text x="8" y="49" text-anchor="start">ice</text><text x="112" y="49" text-anchor="end">creek</text></g>
      <circle class="you" cx="60" cy="45" r="4"/><path class="trail" d="M60 45 l18 -9"/></svg>`,
  },
  {
    title: 'every water plays',
    body: 'Each place is its own instrument. Rub the bowls in the cove. Lay leaves out under the rain. Drop stones in the deep, write a rhythm in the river, press the ice until it cracks, set rocks in the creek, catch snow before it lands, and sing into the hollow.',
    fig: `<svg viewBox="0 0 120 90"><g class="eight">
      <circle cx="60" cy="45" r="7"/><circle cx="85" cy="30" r="6"/><circle cx="35" cy="54" r="6"/><circle cx="64" cy="73" r="6"/>
      <circle cx="44" cy="25" r="5.5"/><circle cx="18" cy="33" r="5.5"/><circle cx="16" cy="70" r="5.5"/><circle cx="30" cy="12" r="5"/></g></svg>`,
  },
  {
    title: 'leave a sound',
    body: 'Hold a finger still on open water and it starts to listen. Let go and what it heard stays behind as a light on the water, for as long as the page is open. Slide up while it listens to leave a file instead.',
    fig: `<svg viewBox="0 0 120 90">
      <circle class="arcbg" cx="60" cy="45" r="22"/><circle class="arc" cx="60" cy="45" r="22" transform="rotate(-90 60 45)"/>
      <circle class="glow" cx="60" cy="45" r="5"/></svg>`,
  },
  {
    title: 'up in the corner',
    body: 'From the left: keep a ripple, which records what you see and hear as a file to send on. Then the ambient water, the sound, and the chart of everywhere.',
    fig: `<svg viewBox="0 0 120 90"><g class="corner">
      <circle cx="21" cy="45" r="11"/><circle cx="21" cy="45" r="4"/>
      <circle cx="47" cy="45" r="11"/><path d="M41 41.5 c2 -3 4 -3 6 0 s4 3 6 0 M41 45.5 c2 -3 4 -3 6 0 s4 3 6 0 M41 49.5 c2 -3 4 -3 6 0 s4 3 6 0"/>
      <circle cx="73" cy="45" r="11"/><path d="M67 45.5 c2 -3 4 -3 6 0 s4 3 6 0"/>
      <circle cx="99" cy="45" r="11"/><circle cx="99" cy="45" r="2.6"/><path d="M99 34 v3 M99 53 v3 M88 45 h3 M107 45 h3"/></g></svg>`,
  },
  {
    title: 'that is all of it',
    body: 'Headphones help, if you have them. Now touch the water.',
    fig: null,
    last: true,
  },
];

const KEY = 'onedrop.welcomed';

export class Guide {
  constructor(root) {
    this.root = root;
    this.i = 0;
    this.open = false;
    this.build();
  }

  // Only the first time on this device. If storage is unavailable or refused,
  // that is not a reason to make someone read it every visit, so assume seen.
  static seen() {
    try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
  }
  static remember() {
    try { localStorage.setItem(KEY, '1'); } catch {}
  }

  build() {
    const r = this.root;
    r.setAttribute('role', 'dialog');
    r.setAttribute('aria-modal', 'true');
    r.setAttribute('aria-label', 'how One Drop works');
    r.innerHTML = `
      <div class="card" aria-live="polite">
        <div class="fig"></div>
        <h2></h2>
        <p></p>
      </div>
      <div class="foot">
        <button class="skip" type="button">skip</button>
        <div class="dots" aria-hidden="true"></div>
        <button class="next" type="button">next</button>
      </div>`;
    this.figEl = r.querySelector('.fig');
    this.titleEl = r.querySelector('h2');
    this.bodyEl = r.querySelector('p');
    this.dotsEl = r.querySelector('.dots');
    this.nextEl = r.querySelector('.next');
    this.skipEl = r.querySelector('.skip');
    for (let k = 0; k < CARDS.length; k++) this.dotsEl.appendChild(document.createElement('i'));

    // Click rather than pointerdown, everywhere in here: the whole touch has to
    // begin and end on the guide, or the end of it lands on the water underneath.
    this.nextEl.addEventListener('click', e => { e.stopPropagation(); this.step(1); });
    this.skipEl.addEventListener('click', e => { e.stopPropagation(); this.close(); });
    r.querySelector('.card').addEventListener('click', e => { e.stopPropagation(); this.step(1); });
    // a swipe back or forward, for anyone who expects cards to swipe
    let sx = null;
    r.addEventListener('pointerdown', e => { sx = e.clientX; });
    r.addEventListener('pointerup', e => {
      if (sx == null) return;
      const d = e.clientX - sx; sx = null;
      if (Math.abs(d) > 50) { e.preventDefault(); this.swiped = true; this.step(d < 0 ? 1 : -1); }
    });
    r.addEventListener('click', e => { if (this.swiped) { this.swiped = false; e.stopPropagation(); } }, true);
    this.onKey = e => {
      if (!this.open) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    };
    addEventListener('keydown', this.onKey);
  }

  show(i) {
    this.i = Math.max(0, Math.min(CARDS.length - 1, i));
    const c = CARDS[this.i];
    const card = this.root.querySelector('.card');
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');   // restart the fade
    this.figEl.innerHTML = c.fig || '';
    this.figEl.style.display = c.fig ? '' : 'none';
    this.titleEl.textContent = c.title;
    this.bodyEl.textContent = c.body;
    this.nextEl.textContent = c.last ? (this.entering ? 'begin' : 'back to the water') : 'next';
    this.skipEl.style.visibility = c.last ? 'hidden' : 'visible';
    [...this.dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === this.i));
  }

  step(d) {
    if (this.i === CARDS.length - 1 && d > 0) { this.close(); return; }
    this.show(this.i + d);
  }

  // entering: true before the water has woken, when closing hands back to the
  // veil and its "touch the water"; false when reopened from the chart.
  start(entering) {
    this.entering = !!entering;
    this.open = true;
    document.body.classList.add('guiding');
    this.root.classList.remove('leaving');
    this.root.classList.add('open');
    this.show(0);
    this.nextEl.focus({ preventScroll: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    Guide.remember();
    // fade, then take it off the page; the veil's words come back as it goes
    this.root.classList.add('leaving');
    document.body.classList.remove('guiding');
    setTimeout(() => { this.root.classList.remove('open', 'leaving'); }, 650);
    if (this.onClose) this.onClose();
  }
}

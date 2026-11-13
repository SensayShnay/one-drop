// One Drop — the naming of water.
// Every area in this piece is named after a real kind of water, and there are
// dozens more besides. This is the index of them: what each one is, in a line,
// and for the ones that exist here, a way to go and stand in them.
//
// The definitions are written for this piece. The facts at the end are from the
// US Geological Survey, which is cited where it is used.

export const KINDS = [
  { g: 'water on the move', items: [
    ['arroyo', 'A channel cut by water that runs only after rain, and is dry the rest of the year. Desert country.'],
    ['beck', 'A small fast stream over stones. The north of England, from the Old Norse for brook.'],
    ['bourne', 'A stream that runs only in the wet months, over chalk, and vanishes in summer.'],
    ['burn', 'A brook. Scotland and the north of England.'],
    ['creek', 'A small stream. In some countries, a narrow tidal inlet instead.', 'creek'],
    ['distributary', 'A channel that leaves a river and never rejoins it, usually somewhere in a delta.'],
    ['kill', 'A creek or channel. From the Dutch, which is why there are so many around New York.'],
    ['river', 'A large natural stream, running to the sea, to a lake, or into another river.', 'river'],
    ['spring', 'Where groundwater finds its own way to the surface.'],
    ['stream', 'Any water flowing along a channel, of any size. All the rest of this list is detail.'],
    ['tributary', 'A stream that gives itself to a larger one.'],
    ['wadi', 'A valley that is a riverbed only after rain. Arabic.'],
  ]},
  { g: 'water at rest', items: [
    ['billabong', 'A bend of river left behind when the river moved on. Australia.'],
    ['kettle lake', 'A lake in the hollow left by a block of glacier ice that sat there and melted.'],
    ['lake', 'A large body of still water with land all round it.'],
    ['loch', 'A lake, or a narrow arm of the sea. Scotland and Ireland.'],
    ['oxbow lake', 'A curve of river cut off from the river when it straightened itself out.'],
    ['pond', 'Still water shallow enough that light reaches the bottom of it everywhere.'],
    ['puddle', 'Rain that has not drained away yet. It still counts.'],
    ['subglacial lake', 'Liquid water held under an ice sheet by the weight above and the warmth below.'],
    ['tarn', 'A small mountain lake in a hollow that ice carved out.'],
    ['vernal pool', 'A pool that fills in spring and is gone by summer. No fish live there, which is the point: other things can breed in peace.'],
  ]},
  { g: 'where the land gives way', items: [
    ['barachois', 'A lagoon shut off from the sea by a bar of sand. Eastern Canada.'],
    ['bay', 'A broad inlet where the shore curves inward.'],
    ['bight', 'A long gentle bend in a coastline. Less of a mouth than a bay.'],
    ['cove', 'A small sheltered inlet with a narrow way in. The quietest water there is.', 'cove'],
    ['delta', 'The fan of land and channels a river builds for itself where it meets still water.'],
    ['estuary', 'Where a river meets the tide and the water is neither one thing nor the other.'],
    ['firth', 'A long arm of the sea reaching inland. Scotland.'],
    ['fjord', 'A deep sea inlet drowning a valley that a glacier cut.'],
    ['gulf', 'A large bay, often almost closed in by the land around it.'],
    ['harbour', 'Sheltered water deep enough for ships to lie in.'],
    ['inlet', 'A narrow opening where the sea reaches into the shore.'],
    ['lagoon', 'Shallow water held apart from the sea by a reef or a bar of sand.'],
    ['ocean', 'One of the great bodies of salt water. Really there is one ocean, and we have given its parts names.'],
    ['sea', 'Salt water smaller than an ocean, or shut in by land on most sides.'],
    ['sea loch', 'An arm of the sea reaching inland. Scotland.'],
    ['sound', 'A wide channel between a mainland and an island, or joining two larger waters.'],
    ['strait', 'A narrow channel between two larger bodies of water.'],
    ['tide pool', 'A hollow in rock that keeps its sea water after the tide has gone out.'],
  ]},
  { g: 'ground that holds water', items: [
    ['bayou', 'A slow marshy backwater off a river. The Gulf coast of the United States.'],
    ['marsh', 'Wet ground given over to grasses and reeds rather than trees.'],
    ['swamp', 'Wet ground with trees standing in it.'],
    ['wetland', 'Ground wet long enough that the water decides what grows there.'],
  ]},
  { g: 'water we made ourselves', items: [
    ['canal', 'A channel cut so that boats, or water, can go where they could not.'],
    ['channel', 'A passage water runs along, whether it cut it or we did; also the deep part of a waterway.'],
    ['moat', 'A ditch dug round a building and let fill with water.'],
    ['reservoir', 'Water held back and kept, usually behind a dam.'],
  ]},
  { g: 'and the water here', items: [
    ['the deep', 'Not a name anyone uses on a map. The part of any water where the bottom stops mattering.', 'deep'],
    ['the hollow', 'A cave with water standing in it, out of the weather and out of the light.', 'hollow'],
    ['the ice', 'Fresh water that has stopped. Most of the world’s fresh water is like this.', 'ice'],
    ['the rain', 'Where all the rest of it comes from.', 'rain'],
  ]},
];

export const FACTS = [
  ['About three quarters of the world’s fresh water is ice.',
   'Nearly all of it is sitting in the ice sheets of Antarctica and Greenland, which is why the frozen part of this piece is bigger than it looks.',
   'U.S. Geological Survey', 'https://www.usgs.gov/faqs/how-much-earths-water-stored-glaciers'],
  ['Nobody agrees which river is the longest.',
   'The Nile and the Amazon have traded the title for decades. It depends where you decide the Amazon begins, and the surveyors do not agree.'],
  ['Lake Baikal holds about a fifth of the world’s unfrozen fresh water.',
   'It is the deepest lake there is, over 1,600 metres, and old enough to have its own species in it.'],
  ['A puddle is a body of water.',
   'There is no lower limit. The list only runs out when the water does.'],
];

export class Names {
  constructor(el, onGo) {
    this.el = el; this.onGo = onGo;
    this.built = false;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const inner = this.el.querySelector('.inner');
    const h = document.createElement('h2');
    h.textContent = 'the naming of water';
    const sub = document.createElement('div');
    sub.className = 'sub';
    const n = KINDS.reduce((a, c) => a + c.items.length, 0);
    sub.textContent = `${n} kinds of it, and every area here is named after one`;
    inner.appendChild(h); inner.appendChild(sub);

    for (const group of KINDS) {
      const g = document.createElement('div');
      g.className = 'group'; g.textContent = group.g;
      inner.appendChild(g);
      for (const [name, def, key] of group.items) {
        const row = document.createElement('div');
        row.className = 'kind' + (key ? ' here' : '');
        const nm = document.createElement('div'); nm.className = 'knm'; nm.textContent = name;
        const dd = document.createElement('div'); dd.className = 'kdef'; dd.textContent = def;
        row.appendChild(nm); row.appendChild(dd);
        if (key) {
          const go = document.createElement('span');
          go.className = 'kgo'; go.textContent = 'you can go there';
          nm.appendChild(go);
          row.addEventListener('pointerdown', e => { e.stopPropagation(); this.onGo(key); });
        }
        inner.appendChild(row);
      }
    }

    const fh = document.createElement('div');
    fh.className = 'group'; fh.textContent = 'worth knowing';
    inner.appendChild(fh);
    for (const [title, body, who, url] of FACTS) {
      const row = document.createElement('div'); row.className = 'fact';
      const t = document.createElement('div'); t.className = 'ftitle'; t.textContent = title;
      const bd = document.createElement('div'); bd.className = 'kdef'; bd.textContent = body;
      row.appendChild(t); row.appendChild(bd);
      if (who) {
        const a = document.createElement('a');
        a.className = 'fsrc'; a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = who;
        a.addEventListener('pointerdown', e => e.stopPropagation());
        row.appendChild(a);
      }
      inner.appendChild(row);
    }
  }

  open(on) {
    if (on) this.build();
    this.el.classList.toggle('open', on);
    if (on) this.el.scrollTop = 0;
  }
}

// the one-line definition of an area, for when you arrive in it
export const SHORT = {};
for (const group of KINDS) for (const [name, def, key] of group.items) if (key) SHORT[key] = { name, def };

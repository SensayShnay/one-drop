# One Drop

A tribute to water. Dark abstract surface, ripples you touch, sounds that answer.

## Run it

    cd ~/"One Drop"/app
    python3 serve.py            # http on 8080
    python3 serve.py --https    # https on 8443, needed for the microphone on the phone

It prints both addresses. The phone must be on the same wifi. With `--https`,
Safari warns once about the certificate: Show Details, then Visit This Website.
The microphone only works on a secure origin, so recording a pin on the phone
needs the https mode. On the Mac, plain http on localhost is already secure.

## What's there

- **The surface.** Touch to drop, drag to drift, fling to glide. While an
  instrument is actually being played the water holds still, so nothing drifts out
  from under your hand mid-note. Ripples are
  irregular and throw off satellite droplets.
- **The way in.** The first time on a device, six short cards come up before
  the water: a touch is a drop, how to drift and travel, that every place is an
  instrument, how to leave a sound, and what the four corner controls are. Each
  has a small moving figure in the piece's own line work. It ends on "now touch
  the water" and gets out of the way, so the touch that enters is a real one on
  the water rather than a tap on a button. Skip, swipe, the arrow keys and
  Escape all work. It is remembered on the device and not shown again; *how it
  works* in the chart menu brings it back.
- **Eight regions.** cove (home), rain, river, deep, the creek, the snowfield, the hollow (a cave of wet
  stone, close and dark, with its own dripping ambience and a long reverb), and
  the ice: a frozen sheet rather than water, pale and matte, with a grain of its
  own locked to the world so it holds still underfoot, frost along the seams and
  darker patches where it is thin. It carries no waves at all: touch it and
  nothing ripples, because it is solid. Every one of them is an instrument. They blend at the edges and
  draw you in. Drag or tap a compass word at the screen edge to travel.
- **Water that comes back around.** The surface has no edge, but it does have a
  size: twelve screen-heights across and the same down. Swim far enough in any
  direction and the same places come round again, and the compass always points
  the shorter way, which may be out through one side and in through the other.
  Only the places repeat. The surface itself is a field of noise with no period
  at all, so coming back to the cove after a long swim finds the cove where you
  left it and finds whatever water happens to be passing. Nothing seams, because
  nothing wraps except the arithmetic.
- **Weather.** Storms are rare, the way they are most days: four to eight minutes
  apart. They come in thick and often, one to two minutes apart, only when it is
  actually raining or storming wherever you are, which the app asks your browser
  and Open-Meteo about once it is awake and then every twenty minutes. Say no to
  the location question, or open it over plain http on a phone, and it simply
  stays mostly calm. It rains about
  twice as hard as it used to, and while it rains the rest of the water steps back
  so the rain has the room.
- **What the water plays by itself.** Loose drops are droplets, drops, short drips,
  bubbles, space drops, deep splash and lunge. Splash and the two swishes never
  fall on their own; they
  only sound from a sequencer track set to them.
  Beds: pier at the cove, drops and pond in the rain, underwater in the deep,
  pouring in the river, chimes carried along by the creek, cold wind and working
  ice over the sheet. The hollow is
  its own world: step into the cave and everything but its own dripping steps
  aside, loose drops included, so the drips are all you hear in there. `moves` is not a bed at all any more: it answers to how
  much water is actually being pushed around, and fades out when you stop.
- **A real sky.** The light follows your own clock and the season: it climbs and
  falls with the sun where you are, goes amber near the horizon at either end of
  the day, and at night depends on how full the moon actually is tonight.
- **Something below.** Now and then a shape passes under the surface, trailing
  light and troubling the water. Rare, and shy of storms.
- **The sequencer**, in the river. 4 tracks x 16 steps, and it starts empty:
  nothing is laid down until you lay it down. Each row is named on the left with
  what it plays, and the name stays there rather than flashing up and going; tap
  it to change the voice. The ring at the top left starts and stops it; it
  starts stopped, so arriving in the water is quiet until you go and find it.
  A line of help appears above the grid the first time you arrive and gets out of
  the way once you touch anything. Below: tempo, swing, echo, chorus and drift,
  each with its value written out. The ambient water drops about 13 dB
  while a pattern is playing, loose drops included, and comes back when you stop it.
  Thirteen voices: nine sampled (drips, drops, splash, deep, bubbles, space, swish,
  glass, rim) and four played as notes on a D minor pentatonic -- resonant (a water hit
  struck into a tuned pipe), bell (FM), blip (a drop hitting still water), chime.
  The four rows sit two octaves apart, and the note follows the step, so a pattern
  spread across the bar becomes a melody.
- **The echo cave**, in the hollow. Hold a finger still on the water and the cave
  listens. Your voice comes straight back off the walls while you sing, the water
  moves with it and a glow swells around your hand. Let go and the cave answers:
  what you sang, given back in pieces at other pitches, thinning out over ten to
  twenty seconds, every fragment poured through a big stone room and troubling the
  surface as it passes. Up to twenty seconds a go. Needs the microphone, so on the
  phone it needs the https mode.
- **The snowfield**, north of the hollow. Water's one structured state.
  Everywhere else in the piece it is a surface or a volume; here it arrives as
  objects, each one built, and what makes a snowflake a snowflake is that it is
  the same six times round.

  The view looks down at the water, so the snow does not fall down the screen.
  It falls towards you. A flake starts far off, small and soft-edged, and
  sharpens as it comes, until it touches the surface. What you do in that time
  decides how you hear it: catch it in the air and it rings out, the whole
  crystal at once; let it land and it says the same thing under its breath and
  leaves a ring on the water instead.

  A flake's sound is read off its shape rather than hung on it. The same three
  numbers that grow the arms pick the notes: how many times it branched is how
  many notes it has, how wide it branched is how far apart they are, and how big
  it grew is how low it sits. So a tight little flake is a high close cluster and
  a broad open one is a wide bright spread, and you can see which you are about
  to hear before you reach for it. No two are built the same way twice, which is
  the one thing everybody already knows about snow.

  They speak in struck ice rather than anything with a harmonic series. A thin
  rigid plate rings on ratios that belong to no series at all, which is why ice
  sounds like glass and not like a string; the top partials are gone in a quarter
  of a second and the bottom one hangs on and shivers, because the crystal is
  melting while it rings. Under all of it there is almost nothing, since snow
  deadens whatever it falls on: a thin cold wind a long way off, and otherwise
  only what the flakes say.

- **The rain harp**, in the rain. Tap to set a leaf out on the water. You do not
  play the leaves; the rain does. Each drop that lands on one plucks it, so the
  weather is the performer and you only choose which notes are available to it.
  Pitch runs left to right, low to high, and a storm turns the whole thing into a
  wind chime. A leaf speaks with an electric piano: a short bright bark and then a
  long quiet ring, the way a Rhodes does, because the brightness leaves well
  before the note does. Every partial gets its own decay rather than the whole
  stack fading together, which is the whole difference between that and a plain
  soft tone. The drop of water that landed is still in the attack, but only just,
  since the tine carries it now. Six species of leaf, told apart by outline,
  proportion and vein: willow, lance, lily, heart, oval and fan. Tap a leaf to
  take it away, or let them all go.

  Under the rain there is rain and nothing else. There used to be a pond bed and
  a bed of keys underneath; both are gone, and the rain itself came up to fill
  the room they were taking.
- **The singing bowls**, in the cove. Five of them, standing where they have
  always stood. They are not something you carry about: they are fixtures, and the
  water plays them. G B C D F, the lowest note in the biggest bowl, each a
  recording of a real bowl rung round its rim, and each tuned to its own note
  since a real bowl is not made to A440 and these five did not agree.
  **Each bowl holds its own water.** Its rim is a wall in the wave simulation, so
  a ripple raised inside one stays inside, going round and round and breaking
  against the rim, while the open water outside breaks against it rather than
  washing through. Touch the water inside a bowl and it rings, and the ripple you
  made stays in it. Touch anywhere else in the cove and the ripple travels out,
  and every bowl the wavefront reaches rings as it arrives, nearest first and
  quieter the further it had to come, so one touch in open water rolls a chord
  across all five. **Rub a slow circle inside a bowl** and it sings the way a wet
  finger round a rim does, for as long as you keep it going and a good while
  after; going one way brightens the tone, the other darkens it. The ambient water
  steps back about 13 dB while a bowl is singing. Straight drags and scribbles
  leave them alone. The cove is sheltered water, so drift dies away there within a
  few inches and the bowls stay where your hand left them.
- **The soundings**, in the deep. Tap to lay a stone on the bed; its pitch
  comes from how deep in the pool it lies, low at the bottom. Stones make no sound
  of their own, but any ripple that passes over one makes it ring, so touching the
  water sends out a wavefront that strikes your stones in order of distance. The
  spacing of the stones is the rhythm. The tone is warm and round rather than
  metallic. Tap a stone to lift it out, or "let them sink" to clear the bed and
  start again. **Key and scale** are yours to set, below the water: twelve keys
  and seven scales, from minor pentatonic to whole tone, and the stones keep
  their places and take their new notes. Fourteen at most, and they are remembered between sessions.
- **The ice.** Press it and it splits: two to four arms run out from under your
  finger, straight for a while and then turning all at once, the way ice actually
  goes, throwing off a branch here and there. You hear it running in two
  parts: on top the snapping, short pieces cut from the transients of real ice,
  falling in pitch as the crack travels, and under it the low groan of the sheet
  sliding against itself. Every branch snaps as it is born. Let go and the sheet
  rings at a note set by how far the crack reached, so a tap is high and a long
  hold is low, two and a half octaves between them. The cracks stay, and a new one
  cannot cross an old one or an open hole, so the sheet fills up and later cracks
  come out shorter and higher. Keep pressing after a crack has run as far as it can
  and the same gesture turns into melting: the ice opens into a hole of water that
  drips at a pitch set by its width, slowly for a wide hole and quickly for a
  narrow one, climbing as it freezes shut again within ten or twenty seconds. **Touch the
  open water in a hole** and it freezes over on its own, from the edge in, and the
  rest of the sheet stays as you left it. Everything in the melt goes through a
  room of its own: a long pale reverb and a slow echo, each repeat a little
  darker, and a hole answers its own note with the fifth above it a moment later.
  About ten
  long holds is all the sheet will take, and then it gives way, and freezes clean.
  **The holes play each other.** A crack running near a hole bends toward it, the
  way a fracture finds a weak point, and a crack that joins two holes becomes a
  line between them. After that, every time one hole drips, a light runs out along
  its cracks and rings whatever hole it arrives at, which passes it on again,
  fainter each time, until it dies out three or four holes away. Melt enough of
  them and the sheet plays itself. **Refreeze** at the bottom of the screen takes
  it all back to clean ice.
- **The creek.** Shallow water running downhill over stones, clear enough to see
  the bed through it. Touch the water to set a rock in it. The flow comes down in
  surges, and every rock the water breaks on rings as the surge reaches it, so the
  creek plays itself once you have given it something to break on. The surge is
  a crest of moving water rather than a line: one body of it with a thickness that
  swells and thins along its length, a bright edge where it catches the light, and
  chop riding on top, all of it fading out at either bank. It is built fresh on
  every pass, so no two go by the same shape. Where a rock
  sits **across** the stream is its note, eight of them in C, low on the near bank
  and high on the far one; how far **down** it sits is **when** in the bar it
  sounds. So a rock is a note and a moment at once, and dragging one moves it in
  both. Take hold of a rock to move it, let go without moving it to lift it out,
  or "lift the rocks" to clear the bed. Twelve at most, remembered between
  sessions. An **echo** below the water sets how far each chime carries: the
  sample was cut from a run of chimes falling over each other, so there is no
  long clean note to be had in it, and the ring comes from the room instead. The chime is one strike cut from the front of a real flow chime and
  tuned, so every rock is the same bell at a different pitch; dropping a rock in
  sets off the whole descending run.
- **The cycle.** A single drop waits out in open water, east of the cove, and on
  the chart. Touch it and
  you go with it: still water, the sun taking it, a mile up in cloud, the fall,
  down the leaf into the creek, out to the dark, frozen for a century, and back
  here. Eight stages, a line each and a drawing of what is happening to the
  water, about a hundred seconds. You never stop being
  water, so the surface never stops being the surface: only what it is made of
  changes, from vapour with the colour drained out to ice that holds still. **Let it go** at the bottom
  ends it early, with arrows either side of it to step through the stages by hand
  when you would rather look at one part than wait the whole way round.
- **What does not belong.** Now and then something drifts in that is not water: a
  torn scrap of plastic, an oily sheen, a bloom of foam, a tangle of line, a can.
  Touch it and you lift it out; the water takes a ripple and one line surfaces in
  a quiet panel, said once and then let go. Each kind of thing has its own lines,
  dealt without repeating until that kind has nothing left to say, so you are not
  told the same thing twice in an afternoon. Round numbers get a line of their
  own. **A running count sits in the top left** of the screen, a drop with a tick
  in it, which brightens and names itself for a moment each time you take
  something out. Leave things floating and the water slowly dulls, the
  light below getting through less; take them out and it clears again. Storms wash
  more of it in.
  The lines are checked rather than invented, from The Ocean Cleanup on river
  plastic and the University of Minnesota Extension on riparian buffers; both are
  cited at the top of `src/drift.js`.
- **Keeping a ripple.** The first ring in the top right records the water and
  everything you can hear, for up to twenty seconds or until you touch it again.
  The ring fills as it rolls. When it is done, "keep this ripple" appears: touch it
  and the phone opens its share sheet, or on a computer the file saves. What comes
  out is the water **and what is standing on it**: the bowls, the stones, the
  leaves, the rocks and the surge, the cracks and the holes in the ice, the pins,
  and anything floating that does not belong. The instruments are drawn as
  elements laid over the canvas, and a canvas recording only ever sees the canvas,
  so while a recording is rolling each of them also notes where it is, and the
  recorder paints those onto a canvas of its own over a copy of the water. The
  controls and the writing stay out of it, which is still what you want.
- **Four rings in the top right,** each naming itself when you hover or touch it. Keep a ripple; set the ambient water aside while
  Keep a ripple; set the ambient water aside while every instrument keeps playing;
  mute; and the chart. All of them remember your choice.
- **Mute.** The wave ring in the top right, beside the chart. It silences everything
  while the water keeps moving, and remembers your choice.
- **Pins.** Lights floating on the water, each one a sound. Drift near and it
  surfaces; tap to hear it close; **drag one to carry it somewhere else**, which is
  how you tidy them: put each near the water it belongs to. Hold one for a moment
  to let it dissolve.
  **Hold a finger still on the water** to record a new one, release to keep it,
  then give it a name. While it is listening, **slide your finger up** to add an
  audio file instead of recording.

  A pin lasts as long as the page does. There used to be a store on the device,
  but a save that fails is invisible, and Safari throws a site's storage away
  after a week without a visit, so what looked like keeping was really a slow way
  of losing. The shelf says so plainly. Keeping one for good is the job of the
  shared water, when there is one, and the download in the shelf is how to take
  one with you until then.
- **Looking after them.** A pin is a file, and files want looking after, so the
  chart has a way in to all of them at once: *look after what you have left*. Every
  pin is listed with the area it is sitting in and how long ago you made it, and
  each one can be played, renamed in place, saved to the device as an audio file,
  gone to on the water, or taken out for good. The × asks once before it does it.
  Sort by newest, by name, or by where they are, and the choice is remembered. The
  two that come with the water can be played and dismissed but not downloaded,
  since they are part of the app rather than yours.
- **The naming of water.** Every area here is named after a real kind of water,
  and there are dozens more. The chart opens an index of fifty-two of them,
  grouped by what they do: water on the move, water at rest, where the land gives
  way, ground that holds water, and water we made ourselves. Each gets a line
  saying what it actually is, and the ones that exist in this piece are marked
  *you can go there* and will take you. At the end, four things worth knowing,
  with the source named where there is one. Arriving somewhere for the first time,
  the water also tells you once, quietly, what it is called and what that means,
  and then leaves you alone. The definitions are written for this piece; the
  figure on ice comes from the U.S. Geological Survey, cited in place and in
  `src/names.js`.
- **The chart.** The ring in the top right corner opens a map of the whole water:
  every area, every pin, and where you are. Each area that can be played shows its
  instrument: touch the mark to go straight to it. The chart's own menu sits at
  the top left, clear of the water it is describing: what you have left, the
  naming of water, and the cycle. Touch anywhere else to set off
  for that spot, open water included. You arrive and stay put: the areas stop tugging
  until you take hold of the water again.

## Layout

Everything the browser loads lives in `public/`. Everything beside it — the
Cloudflare config, `serve.py`, this file — is plumbing, and is never served.

- `public/index.html`  the page, the wake veil, all the styling
- `public/src/surface.js`  WebGL2 height-field wave sim + shading
- `public/src/audio.js`  Web Audio: hits, region layers, submerge, cavern, sequencer
- `public/src/pins.js`  the pins: storage, placement, proximity sound
- `public/src/soundings.js`  the soundings: stones, wavefronts, what rings when
- `public/src/bowl.js`  the singing bowl: circle fitting, the drone it drives
- `public/src/harp.js`  the rain harp: leaves, and what the rain does to them
- `public/src/capture.js`  keeping a ripple: compositing the water and its marks, and the sound, as one file
- `public/src/marks.js`  where everything on the water is, so a recording can show it
- `public/src/drift.js`  what does not belong: the things that float in, and what they say
- `public/src/story.js`  the cycle: the eight stages and what each does to the water
- `public/src/creek.js`  the creek: the rocks, the surge, and what each one rings
- `public/src/names.js`  the naming of water: the index, and what each kind is
- `public/src/guide.js`  the way in: the cards a first visit sees
- `public/src/snow.js`  the snowfield: how a flake is grown, and how its shape becomes its chord
- `public/src/ice.js`  the ice: how a crack runs and branches, and the holes you melt
  (the echo cave lives in audio.js `openCave`/`scatter` and main.js)
- `public/src/main.js`  touch, drift, regions, weather, recording, wiring
- `public/icon.svg`, `public/apple-touch-icon.png`, `public/manifest.webmanifest`  the
  home-screen icon: a drop over rings that run off the edge of the tile, so the
  water reads as continuing past it. Colder than the app itself, because the
  rings need a ground to sit against or they vanish at the size a phone draws them
- `public/audio/`  compressed copies of the samples (originals untouched in Water Samples)

## About the audio

The recordings in `audio/` are compressed copies of commercial sample-pack
material, used here as the voice of the piece. They are published with it so the
work runs, not as a sample library: please do not lift them for your own
projects. The code is another matter and you are welcome to it.

## When the phone takes the GPU away

iOS discards WebGL contexts under memory pressure, and does it most readily to a
web app that has been sitting in the background, which is exactly how this is
meant to be run. The surface listens for the loss, says `the water has gone still
for a moment`, and rebuilds everything that lived on the GPU when the context is
given back: programs, the float extension (which belongs to the context and goes
with it), the quad, and fresh targets. The water comes up flat and fades back in.
The instruments and the sound are DOM and Web Audio and were never affected.

A resize no longer wipes the water either. The old field is blitted into the new
targets and the old ones are freed, which they never were: every turn of the
phone used to leave two float textures behind for the life of the page.

## Sound on an iPhone

iOS hands any page holding an AudioContext the *ambient* audio session. Ambient
is the channel the ring/silent switch mutes and the channel that stops when the
screen locks, so an iPhone on silent played none of this and gave no hint why.
An `<audio>` element would have been fine. Web Audio, which is all of this, was
not.

So the first touch asks for the *playback* session instead, the one a music app
gets: `navigator.audioSession.type = 'playback'` on iOS 17 and later, and on
anything older a half-second of silence looping through an `<audio>` element,
which moves the page onto the same channel the long way round. It is asked for
again on every resume, because coming back from the background can drop it.

The cost is that One Drop stops sharing the speaker. Starting it pauses whatever
else was playing, the way a video does. For a piece that exists to make sound
that is the right trade, and it is the trade a native app would have made.

One known iOS bug is outside our reach: in a web app opened from the Home
Screen, audio can go silent after returning from the background. It has been
reported from iOS 18 through 26. Touching the water asks for the session and a
resume again, which is the best we can do from here.

## Deploying

The live site is <https://one-drop.sheneurmenaker.workers.dev/>, served by
Cloudflare Workers straight out of this repository.

    git add -A
    git commit -m "what changed"
    git push

That is the whole deploy. Pushing to `main` makes Cloudflare run
`npx wrangler deploy`, which reads `wrangler.jsonc` and uploads `public/` as the
new version of the site. It takes a minute or two; the Deployments tab on the
Cloudflare dashboard shows the build and its log.

To deploy from this machine instead of by pushing, `npm install` once and then
`npm run deploy`. `npm run check` validates the config without deploying
anything, which is worth doing before a push if you have touched
`wrangler.jsonc`.

Caching is set in `public/_headers`: the audio is immutable and cached for a
year, `public/src/*` for five minutes, and `index.html` not at all — so a push
reaches people on their next reload, while the 11 MB of samples is only ever
fetched once. Renaming an audio file is the way to force it to be re-fetched.

## Still to come

- A found loop could be shared as a link rather than a file (needs a backend)
- Breath mode, the properties lab, rituals, floating lanterns

- Pins shared between people (needs a backend; local only today)
- Saving and sharing a loop from the sequencer
- Real night and day, life under the surface, breath mode
- Capacitor wrap for iOS

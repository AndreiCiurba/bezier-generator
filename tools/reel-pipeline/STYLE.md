# Reel style brief

The daily batch agent reads this before writing a single recipe, and the finishing agent adds to
the last section every time picks come back. Edit anything here freely - it is the one place the
channel's taste is written down.

## The channel

- **What it is:** short, satisfying string-art clips. Everything on screen is straight lines
  between nails; the curves are an illusion made by where the lines cross. That fact is the
  channel's whole story and the reason people watch twice.
- **Where it goes:** Instagram Reels and TikTok, vertical 1080x1920, watched on a phone, usually
  the first second with the sound off.
- **Account handle:** _not set_ - put it here (e.g. `@yourname`) and the agents will add it as
  `edit.handle` on every reel.
- **Language:** English.

## What a good reel does

1. **The first frame already has something to look at.** Never open on an empty board or a black
   frame. If the idea is a build-up, start with a few strings already on, or with the nails lit
   and the camera already moving.
2. **One idea per reel.** A build-up, *or* a times-table morph, *or* a twist, *or* a fly-through.
   Two at once reads as noise.
3. **The camera is a performer, not a turntable.** See "Camera" below.
4. **It ends where it could start again.** Reels loop. The last frame should be a strong still of
   the finished piece, not a fade to black.
5. **7 to 13 seconds** for most reels: shorter gets replayed, longer gets swiped. A reel that
   tells a story in stages (a making-of, a long build-up) may run 15 to 25 seconds, as long as
   something new happens every few seconds.

## Camera

A single slow orbit is predictable and gets swiped. Every reel's camera does **at least three
clearly different things**, each with a reason:

- **Go in** to show detail (a push-in, or a lens punch with `fov` 26-30), **go out** to show the
  whole. Alternate them; do not sit at one distance.
- **Change the angle outright**: overhead (`elevation` 89) where the pattern reads as a drawing,
  low and side-on where it reads as an object, underneath (`elevation` negative, board hidden) to
  flip it, a barrel `roll`, a whip half-way round.
- **Hold still to explain.** When a caption is making a point, the camera stops (or nearly) on
  the thing being talked about, then moves again. Explaining reels pick out the string in question
  with `explain`.
- **Vary the pace.** Give keyframes their own `easing`: a drift (`easeInOutQuad`), then a snap
  (`easeOutExpo`, `easeInOutExpo`), then a drift. Moves of equal length and equal speed feel
  mechanical.
- **Never lose the subject at the moment that matters.** Wide and bold when the idea happens (the
  first string, the number changing); close-ups come before or after. A dense many-layer tower
  turns to haze up close - keep pushes on those gentle.
- **Turning on the spot**: once the camera has travelled to its own target (`distance` near 0),
  changing `elevation` and `azimuth` turns it in place - that is how the dive looks down, then
  out level, then round. `tilt` pitches the view without moving the camera from anywhere else.

`lib/ideas.mjs` has a `choreograph` helper and a `MOVES` list the drafts are built from; read them
for the vocabulary, then write camera tracks by hand when a reel needs something specific.

## Picture

- Dark background (`#07070c`), and strings in a palette from Color Hunt
  (`palettes/colorhunt.json`), used as the site gives it: three or four colors as a gradient up
  the layers, or one color per arc. Do not mix colors from different palettes in one piece.
- The piece should fill most of the frame's width at its hero moment and never be cut off by the
  frame edge unless the shot is a deliberate close-up.
- Strings must stay readable as individual lines somewhere in the frame. A solid blob of color
  means too many layers, too many nails, or too heavy a weight - thin it out.
- Glow (`look.bloom`) is seasoning: strength 0.1-0.2. Dense pieces need none.
- Showing the nails and the board (`weave.nailsVisible`, `look.board`) makes it read as a real
  object and suits build-ups; hiding them suits the abstract, glowing pieces. (For now he wants
  no board at all: strings and nails only, on the dark background. See the newest
  Learned-preferences entry.)

## Words on screen

_Captions are back (2026-11-13): see the newest Learned-preferences entry for the current tone
(playful point-of-view lines that change with the flight). The rules below still hold for
length and placement._

- **Hook** (top, size `xl`, first ~2.5 s): six words or fewer, two lines at most, one word in the
  accent color with `*stars*`. It should make a claim or a promise the clip then pays off:
  "Only *straight* lines.", "Change *one* number", "This is *not* a flat drawing".
- **One or two supporting lines** (bottom, size `m`, style `pill`), a few words each, timed to
  what is happening on screen. Lowercase reads calmer.
- Never more than one caption on screen at a time besides the handle. Leave at least a second
  with no words before the end.
- No emoji in burned-in captions, no "wait for it", no "you won't believe".

## Sound

- **No music** (Andrei, 2026-11-13). Clips are silent by default: leave `edit.audio` out. The
  synthesized plucked-string track (`edit.audio.synth`) still exists but is not used unless he
  asks for it again.
- To use a real track, drop the file into `tools/reel-pipeline/audio/` and set
  `edit.audio.file`. Only use audio you have the right to post.
- Trending sounds can only be attached inside the Instagram/TikTok app when posting; for those,
  finish the reel as usual and replace the sound in the app.

## Post text

- `post.caption`: one or two plain sentences. Say what the viewer is looking at (how many nails,
  what number changed) - specifics beat adjectives.
- `post.hashtags`: five to eight. Always `#stringart`; then a mix of subject (`#mathart`,
  `#geometry`, `#cardioid`, `#timestables`) and feel (`#satisfying`, `#oddlysatisfying`).

## Learned preferences

_The finishing agent appends dated notes here from what gets picked, what gets passed over, and
any "for next time" comments. Newest first._

### 2026-11-18 - before the cuts batch: making-of, day and night, editing

His words: "insist on the making of", "alternate between daylight and night lamp", "add
transitions like rotating camera 360 or other professional editing tricks".

- **Insist on the making-of.** The build is the story, not a short intro: at least a third of the
  reel goes to it. Show nails going in (`nailMode: "hammer"` with `making`, so a tack hammer drives
  them), then thread being laid (the spool rides the string going on). Open with a close-up of
  the first nails at real speed, then speed up (time-lapse). Cut between close-ups and the wide
  shot as the piece fills in.
- **Day and night lamp, alternating.** Each reel switches between daylight and a warm night lamp
  at least once (daylight build → lamp-lit reveal, or night build → morning light). Make the
  switch a beat of the edit: a cut, a flash or a spin landing on the new light. Across the batch,
  some reels start in day and some at night.
- **Professional editing.** These tools exist now (README "Cuts" and "Transitions"):
  - `camera.shots` for real cuts;
  - a `spin` (360 about the lens), `whip`, `zoom` punch, `flash` and `dip`, with motion blur;
  - fast 360 orbits (an `azimuth` track plus `blur`);
  - match cuts (the same framing, day then night);
  - speed ramps (easing).

  Use 2-4 transitions a reel, each on a story beat, and keep everything else as calm and smooth
  as before.
- **Still holds from 11-17:**
  - regular tiled boards (squares, circles, hexagons, /3d layouts) without satellites;
  - evening and lamp light;
  - heavy threads inside the dives;
  - smooth, look-ahead camera.

### 2026-11-17 - feedback on the signature batch (`2026-11-17-signature`)

- **Evening and dark lighting "went really good"**: the museum dimming to one warm spot (01),
  sunset into a lamp clicking on (06), and dark stages.
- **05 Rubik's floor "was great"**: the user loved how the square tiles looked. Explore regular
  shapes more, *without* the small satellite pieces. Use the /3d page's board layouts as a
  reference (its Grid Shape lattices: square, triangle and hexagon/honeycomb). Build boards
  tiled with many squares, circles or hexagons, fill every cell with a weave, and dive through
  them.
- **"The dive does not look very smooth at some points, it looks glitchy."** There were two causes.
  The camera flew right over its look point, whipping round at up to 1500 degrees a second. And
  the path overshot hover waypoints, so the camera stopped and backed up. Both are now fixed in
  the engine (steadicam gaze, monotone path), and `check` flags `whip`. Keep look points well
  ahead and the motion calm. Smoothness beats speed.

### 2026-11-15 - feedback on extended-dives-2 (`2026-11-15-extended-dives-2`), applied in `-3`

His words: "3 more scenes with bigger stroke weight, dive in looks pretty empty/poor."

- **Heavier strings.** This overrides the older "0.6/sqrt(layers)" rule for the dive reels. Line
  width is in screen pixels (about `weight` x 3.3 px at 1080 wide), so a thread up close is no
  wider than one far away. In `-3`, `weave.weight` was 0.22 on the wide shots and 0.65 inside the
  dive, with an easeInOutQuad ramp on the way in and out. Dense times-table stacks had a shape
  `weight` of 0.6-0.7 so they do not turn into a solid disc from the front.
- **A full dive.** The camera flies through tall times-table stacks (threads above and below, not
  just an open bowl) or down a narrow canyon (walls 400 apart). Inside, look about 0.95 ahead at
  h 0, which pitches the view 10-18 degrees. The longest stretch is inside the densest figure.
- **No black band.** `lighting.background` set to a mid warm grey (`#9d978f`) turns the dark
  "sky" above the room into a soft haze.
- **Exits.** Climb straight up the wall and leave by the top. Then pull back and away while still
  looking up the wall at the figure just left and the small tower above it, so the shot never
  lingers on blank wall.

### 2026-11-15 - feedback on the extended-dives batch (`2026-11-15-extended-dives`)

- Liked the overall idea of the long dives (in, through the threads, out between nails, on to the
  next figure).
- But "the dive seems upside down (relative to the board) and not in a horizontal direction, feels
  a little bit tilted, after it gets in". The cause was the camera keeping the room's up while
  diving down a wall-hung piece. The drone now flies with the board as its ground
  (`fly.horizon`, default on). Dive up or across the wall, never down it, and look along the
  board inside a figure. `check` flags upside-down and tipped frames.
- "Doesn't have to necessarily be a regular movement, but I want a sense of direction." Curves,
  climbs and hops are fine. What matters: the board always below, the picture level, and each
  leg heading one readable way.

### 2026-11-15 - feedback on the gallery-dives batch (`2026-11-15-gallery-dives`)

His words: "Excellent work for the last published artifact with the dives. I want you to do 10
more with extended dives, meaning it should go inside and through the threads, get out on the
sides etc. For the smaller shapes, i like the transition from one to another, keep that."

Rules (on top of the gallery-dives formula, which still holds: gallery wall, room 16 x 10,
`floorAt` 3, two or three distant spots with `shadow` and `fixture` at 0.4-0.55, ambient
0.25-0.3, discreet nails, `layerSpacing`, amphitheaters and `rule: "times"` bowls, mandala
build-up, Rubik's turns, weave-style captions, silence):

- **Extended dives.** The `camera.fly` part is long and involved, not one dip in and out:
  - go into a bowl and travel through its thread layers;
  - leave through the side of the figure, between two nails, not only back over the rim;
  - then go on: cross into the next figure through its side, skim low along rows, rise and
    dive again. Vary the exits: side exits, low passes, figure-to-figure crossings.
  - Keep it smooth, slow and oriented: bank 0, the wall as the frame of reference, and a short
    wide establishing moment so the viewer knows the piece. Clips may run 18-24 s.
- **Side exits must be real gaps.** `check` must show no fly crash. With the default nail
  clearance (60 world units each side) a gap needs nail spacing of about 200 world units, so
  these pieces are built at `unit` 4000 with `layerSpacing` 40 (same proportions as `unit`
  1000 / spacing 10). Put the crossing on a mid-gap: a circle's nails start at angle 0, so with
  N divisible by 4 the line `x = -R sin(180/N)` threads its top and bottom gaps; a polygon with
  an odd number of nails per edge has a gap at every edge midpoint. Keep three or four
  waypoints collinear around each crossing so the spline cannot drift into a nail.
- **Keep the small-shape transitions.** The camera travels satellite to satellite while they are
  strung, and the build and the turns pass figure to figure. Make that part of the long path.
- **Threads up close stay fine;** a subtle `weave.weight` lift (about 1.4-1.5x) while inside is
  still useful, because sub-pixel threads fade to haze.
- **Captions:** fun point-of-view lines tied to the journey (going in, slipping out the side,
  hopping to the next one), naming the weave style, not the shadows.

### 2026-11-15 - feedback on the mandala gallery batch (`2026-11-14-mandala-gallery`)

His words: "This is amazing. Now also dive into the shapes. They can be amphitheaters too, not
complete shapes (cardioid derived). Keep the shadows and gallery style. Don't focus captions too
much on shadows, but on the style used. 10 more."

Rules:

- **The mandala-gallery formula works; keep it:**
  - build-up component by component on a gallery wall;
  - many layers;
  - Rubik's turns once complete;
  - distant spots with fixtures and soft shadows.
- **Dive into the shapes:** the camera (`camera.fly`, path in board coordinates; on a wall `h`
  is distance out from the wall) makes one slow, clear dive into a figure's stack and back out,
  oriented and unhurried:
  - bank 0-0.1;
  - the wall stays the frame of reference;
  - the look blends back to the whole piece before the end.
- **Mix the weaves:** not every figure is a complete times-table shape. Amphitheaters (center rule,
  each layer's leap walking one nail, an open bowl) are welcome again next to the
  cardioid-derived `rule: "times"` figures. They are the best thing to dive into.
- **Captions name the style, not the shadows:**
  - what weave it is ("times 3 on 96 nails", "each layer shifts one nail", "an amphitheater of
    52 rows", "leap 7, layer by layer");
  - how it's built;
  - true string facts.

  Mention the light at most once.

### 2026-11-14 - stopped gallery batch (`2026-11-14-gallery`, not shown)

His words, condensed: "I saw the first previews and I don't like it: it does not look realistic,
it's glitchy, and the shadows are not realistic and they overlap the figure. The main shapes
could benefit from a leap: every new layer should start from a sibling nail, just like it
happens in the cardioid. Generate 10 more and keep this gallery style. Maybe let me see the
source of lights."

What changed in the code (the main session fixed it):

- Shadows are drawn behind the strings, never over them. They are soft and see-through, so
  overlaps darken. Strings far from the wall throw wider, fainter shadows than strings close to
  it. Without a board, shadows land on the wall itself.
- New weave `rule: "times"` (with `multiplier`, 2 = cardioid, 3 = nephroid, ...) puts the
  cardioid page's times-table weave on any shape outline. Every layer starts `leap` nails
  further round, so the stack twists and fills its middle instead of leaving an empty bowl.
- A point light with `fixture: true` draws its spotlight: a dark can aimed at the piece on a
  rod from the ceiling (or from the floor for an uplight), its lens glowing in the light's
  color.

Rules (override older entries where they conflict):

- **Realistic gallery lighting:**
  - spots far from the piece, as in a real gallery: point lights at `distance` 5-7 units in a
    big room (`room.width` about 16, `height` about 10, `floorAt` about 3), with no `reach`;
  - each light's intensity about 0.4-0.55 (two to three lights; more burns the wall out white);
  - ambient about 0.25-0.3.

  Near lights blow shadows up across the whole wall; that looked fake. Shadows should be about
  the piece's own size, offset and fanned by each light. Light moves are slow and small.
- **Show the light sources:** set `fixture: true` on every gallery light and frame them in at
  least one beat: start or end wide enough (camera pulled back, `targetY` raised) to see the
  cans on their rods aiming at the piece.
- **Main shapes use the twist:** most main figures use `rule: "times"` (`multiplier` 2-5,
  `leap` 1-2, nails 90-180, layers 40-70) on ovals, blobs and polygons. It fills the middle
  and visibly turns layer to layer. Other rules are for accents.
- **Calm and real:** no glitchy effects, no snaps in the gallery reels, a slow camera. The
  piece reads as a real object on a real wall. Discreet nails (thin, wall- or board-colored).

### 2026-11-14 - feedback on the showcase batch (`2026-11-14-showcase`, picked 02, 03, 07, 10, 11, 14, 15)

His words, condensed: "02 loved, but the dive happened too fast to understand the idea. 03:
nails too thick and large, especially on the small irregular shapes, but loved how it went on
the wall, and the colors are amazing when the lighting changes. 07: camera too drone-like, I
lose the sense of orientation. 10: didn't feel a leap between layers, but I like the figure.
11: the face looks bad, drop the concept. 14: the moons are not nail tall. 15: great colors,
but the inner circle could have been something irregular. Something in the last second of most
videos goes shaky. The many-layer main shapes all look like amphitheaters with a lot of free
space inside; try different leaps on /shapes for a more interesting look. Try to exclude the
nails, they don't look good. A board here and there helps. I want more shadows: on a wall, show
the pieces like works exhibited in a museum, lit by several lights from different angles, to
capture the essence of shadow, especially the tall ones. In that case add nails, but keep them
discreet."

Rules (these override older entries where they conflict):

- **The end-of-clip shake was the camera, and it is fixed.** The drone camera's heading was
  measured over a window that grew in jumps near the clip's ends; it is continuous now and the
  lean fades out while the camera watches the piece. Nothing to do in recipes, but keep the last
  second calm: no snap in the final 0.5 s.
- **Orientation first.** Keep a horizon or the board in view and the piece's center
  recognizable. Fewer turns, slower and wider moves, gentle or no bank. Show the idea first,
  from where it reads, before the dive, and dive slowly enough to follow (02's lesson). A dive is
  one clear move in, one clear move out; not a constant weave.
- **Leaps that fill the inside.** Stop defaulting to amphitheaters with an empty middle. Try
  leaps the way the /shapes page allows and put the most interesting on sheets:
  - leaps where every layer's chords cross through the middle;
  - hourglass-like waists (avoid true domes);
  - layer counts past nails/2, so the shift wraps round and the layers twist;
  - the legacy rule;
  - low-nail-count figures with big layer counts.

  The leap must visibly change from layer to layer (10's lesson). Inner figures should be
  irregular (`blob`), not plain circles (15's lesson).
- **No faces.** Drop face concepts.
- **Nails: hidden by default** (`weave.nailsVisible: false`), everywhere except the museum
  pieces. Where nails show, keep them discreet: thin (`look.nailThickness` about 0.25-0.35 on
  small figures), muted, close to the board or wall color. Every figure's top layer should come
  up to its nails' tops (14's lesson). Nails that stop far above or below the strings look wrong.
- **A board here and there:** some reels show the board (`board.color`), not all.
- **Museum walls, shadows first.** Several reels hang the piece on a wall (`room`, mount `wall`)
  like a work in a gallery:
  - lit by two to four lights from different angles: spotlights high left and right, a low
    grazing light, a warm and a cool one;
  - each casting shadows (`shadow: true`), so the tall stacks throw long, layered,
    multi-colored shadow fans onto the wall;
  - light intensities and positions animated slowly, so the shadows swing and cross;
  - the camera moving around the hung piece to show the depth.

  Tall pieces suit this best. 03's wall-and-lighting moment is the reference he loved; the room
  can be a calm gallery (pale wall, darker floor).

### 2026-11-13 - feedback on the dives batch (`2026-11-13-dives`)

His words, condensed: "When operating with multiple layers, stroke weight should be smaller. I
don't like the dome. The nails have their heads too long. Do a dive-in on the cardioid page as
well. Liked the oval shape. Make the shapes more irregular. The small mandala-style shapes don't
bring much value if they are so symmetrical; try something more impressive with them."

Rules (on top of the dives-batch rules, which still hold: every reel a smooth, slow drone dive,
in and out through the threads, amphitheaters, fun point-of-view captions, board level, `check`
"ok"):

- **More layers, finer strings.** Scale the weight down as layers go up, roughly
  `weave.weight` x shape `weight` = 0.6 / sqrt(layers): about 0.085 at 50 layers, 0.06 at 100.
  A tall stack must still show gaps between its threads, not a solid wall.
- **No domes** (leaps that close the stack inward toward the top).
- **Nail heads are fixed:** heads are now thin discs at any nail height, so there is nothing to
  do in recipes.
- **Cardioid dives:** some reels use `"scene": "cardioid"` with `camera.fly`. Path units are the
  circle's radius (`weave.radius`); `h` is height off the board. Fly into the stack (40-100
  layers, tall `height`), through the layers and out. `check` does not cover cardioid fly paths
  for nails, so look at close `sheets --times`.
- **Ovals are liked.** Use oval amphitheaters (`outline: { type: "oval", ratio }`) as main
  figures more often.
- **Irregular shapes:** use the `blob` outline (`{ type: "blob", lobes, wobble, seed, ratio }`)
  and asymmetric layouts. Not every piece needs to be a perfect rosette.
- **Satellites that are worth it:** a ring of identical small copies adds little. Vary them
  copy by copy with the `repeat` options:
  - `grow`: each copy bigger than the last;
  - `radiusStep`: spiral outward;
  - `layersStep`: each copy taller, a rising staircase of towers;
  - `turnStep`: each copy turned a little further;
  - `arc`: spread over only part of the circle;
  - `jitter` + `seed`: seeded scatter.

  Satellites should be something the drone can weave between: towers of different heights, a
  spiral trail, a crescent of growing blobs.

### 2026-11-13 - feedback on the grounded batch (`2026-11-13-grounded`)

His words, condensed: "Make every one of the next batch a drone dive-in. When adding many layers,
make them like an amphitheater: play with the /shapes page, where you can use values over 50 for
both nails and colors. The dive should be smoother and slower. Go in and out through the threads.
Add texts like 'you are a bee', and make it more fun and dynamic."

Rules (these add to the grounded-batch rules, which still hold: everything starts at the board,
`weave.layerSpacing`, `check` must be "ok"):

- **Every reel is a drone dive** (`camera.fly`), not just a few.
- **Amphitheaters:** the Shapes page's center-out weave connects each nail to the one
  `nails/2 + leap + layer` along. So every layer shifts its chords by one nail, and a figure
  with many layers (colors) sweeps from chords across the middle at the bottom to chords near
  the rim at the top, or the reverse with a negative leap. That forms a bowl, an amphitheater of
  tiers. Use big counts like the Shapes page allows: nails 100-240, layers (colors) 50-100, with
  the leap chosen so the tiers open upward like seating. Use `colorMode: "bands"` so the tiers
  read as colored rows.
- **Smoother and slower:**
  - fewer waypoints spaced further apart in time;
  - longer reels (14-20 s);
  - gentle bank (about 0.15-0.25);
  - no sudden turns;
  - `look.blend` changes eased over a second or more.

  The camera should glide, not race.
- **In and out through the threads:** the path passes through the thread walls and tiers more
  than once. It enters the bowl, crosses the tiers, comes back out through them and dives in
  again, so the viewer sees threads rush past at the moment of passing.
- **Fun, point-of-view captions** that change with the flight, three to five per reel:
  - an opening "You are a *bee*.", "You are a drone the size of a pin.", "Welcome to the
    thread arena.";
  - beats as it happens: "duck!", "going in", "60 rows of seats", "exit through the threads";
  - a payoff line when it pulls out to the whole piece.

  Keep each to a few words, one on screen at a time, short gaps between. A true string fact can
  still be one of them.

### 2026-11-13 - feedback on the buildable batch (`2026-11-13-buildable`)

His words, condensed: "You made a major mistake: my structures start not from the bottom of the
nail but from high above. That is a no-go. Tall is fine, but do not skip layers: every structure
starts from board level, the same level. I don't care that a tiny circle has three or four layers
and another has fifty, just make them start from the same layer. And the drone should dive
inside the strings, not underneath them, like you did earlier. Ten more mandalas, as tall as
possible without losing quality."

Rules (these override older entries where they conflict, including the raised-nails advice in the
client-feedback entry below):

- **Every figure starts at the board.** No `base`, no long nails carrying a stack in the air.
  Set `weave.layerSpacing` on every arrange recipe: each figure's first layer sits at the same
  level and its layers climb at the same pitch, so its height is simply its layer count. A small
  figure is a short stack, a big one a tall stack. `check` flags any `base`.
- **Nesting without raising:** a figure can sit inside another only where the outer one's
  strings leave the inside free (a high leap under the center rule keeps the chords near the
  rim), or figures sit side by side with gaps. `check` must still be "ok".
- **Tall is welcome:** many layers (30-60 on the big figures) as long as the threads stay
  readable, with visible gaps from overhead. Keep `weave.weight` fine (about 0.07-0.1) and
  space the layers so each one reads on its own.
- **The drone flies inside the strings.** Not under a canopy: the camera dives into the woven
  volume itself. It drops down an open center between walls of thread, threads through the
  layers of a tall stack, and skims along inside a ring with the strings above and below. Then
  it pulls out to a still of the whole piece. The earlier abstract and sculpted batches' dives
  into the tower are the reference.

### 2026-11-13 - client feedback on mandalas-v3 (`2026-11-13-mandalas-v3`)

The client's words: "Be mindful about overlapping figures. While this looks good in theory, there
are physical limitations when using nails: lines intersecting with the nails/rods of other
figures will be slightly displaced and alter the curve formed by the thread. I would also like
something like zooming in close to the board, maybe a shot similar to the ones of drones going
under bridges or large structures."

Rules (these override older entries where they conflict):

- **Every piece must be buildable with real nails.** No string may run through another figure's
  nail, and no two figures may share a nail spot. Run `node reels.mjs check <batch>` and fix
  every recipe it flags before rendering. `sheets` and `batch` print the same warnings, and a
  flagged recipe is not ready. The `check` command found clashes in 19 of 20 mandalas-v3 recipes
  (all but 07 Honeycomb) and in the 19 benchmark, so the old mandala recipes are not templates
  for spacing.
- **How to compose without clashes:** figures side by side with a clear gap (rings of copies
  spaced so neighbors do not overlap, like 07 Honeycomb). Or nest a small figure inside a big one
  with the big one strung *above* it on long nails (big figure's `base` higher than the small
  one's `base + height`). Rings within rings work the same way: the outer, wider rings sit on
  taller nails. Leap matters too: under the center rule, a low leap runs strings across the
  middle of a figure, so the space inside it is not free.
- **Drone shots.** In at least a few reels per batch, the camera flies like a drone
  (`camera.fly`, see README "Drone shots"): it dives from the overview to just above the board,
  skims between figures, passes *under* a raised figure's woven canopy between its long nails,
  and climbs back out to a still of the whole piece. This needs pieces designed for it:
  - raised figures on long nails;
  - sparse nails where the path enters;
  - heavier strings for the close-up (`weave.weight` about 0.2, fill weight 1);
  - slim nails (`look.nailThickness` about 0.45);
  - boards and nails visible.

  The overview frames still follow "see the gaps".

### 2026-11-13 - feedback on the built batch (`2026-11-12-built`, picked 19)

His words, condensed: "19 is probably the best. I like the direction from nr. 11 on - the mandala
effect and the Rubik's cube style. I didn't like seeing a lot of overlaps: a structure starting
on top of another structure. The stroke weight still seems too big for the complexity - they
almost look real-life instead of letting me see the gaps formed by the thread and the complexity
of the layers. On the mandalas, they were about 3 components: one shape in the middle, n shapes
circling around and one outer shape. Explore further: hexagons, pentagons, fill in the gaps
inside, use deformation, the weave pattern, and drop the object entirely (fit something inside a
mandala only if it works). Add text again with facts about strings, and drop the music entirely.
For one reel, show how the board is painted, how the nails are hammered, how the thread goes in
and how it ends up on the wall with the day/night transition. The rest more mandala style -
mandalas-v2 looks pretty good, but with the complexity of our later iterations."

Rules (these override older entries where they conflict):

- **Mandalas, not objects.** The batch is mandalas built on mandalas-v2, with the depth, bands,
  borders and Rubik's turns of the later batches. Objects are optional and only inside a mandala.
- **More than three components.** Not "center + one ring + outer ring": many interlocking rings
  of different polygons (hexagons, pentagons, stars, petals) at different radii and counts,
  filling the gaps between rings, with leaps and weave patterns that differ ring to ring.
- **No stacking on top of each other.** Shapes interlock side by side or nest inside one another
  at the same level; a shape whose stack starts on top of another shape's stack is out. Height
  differences between rings are fine; towers built on towers are not.
- **See the gaps.** Strings must stay readable as threads with gaps between them: fewer, thinner
  strings (`weave.weight` about 0.06-0.08, fill `weight` about 0.5, fewer nails or layers per
  shape where it gets solid). Borders stay but thinner (about 2). If a shape looks like a solid
  surface, it is too dense.
- **Text is back: string facts.** `edit.captions` carry one or two short, true facts about string
  art or thread (history, how many meters of thread, how many nails, how a curve emerges from
  straight lines). Only state facts you can stand behind - no invented numbers; facts about the
  piece itself (its nail count, layers) are always safe.
- **No music.** `edit.audio: false` on every reel.
- **Reel 19 (clock dial) is the benchmark** - picked and finished unchanged, "probably the best".
  It is a recognizable thing built as concentric woven rings on a near-black ground, in a
  restrained cool palette, with a mechanical payoff after the weave completes (the ring turns,
  the hands sweep, the dial clicks back). All 9 non-mandala objects in that batch were passed over.
- **One making-of per batch.** Board painted (`board.color` track), nails hammered
  (`nailMode: "hammer"`, nails visible), strung, lifted onto the wall (`mount` track), room
  brought up (`room.brightness`), day to night. See README "Lighting, wall and room".

### 2026-11-12 - feedback on the wall-objects batch (`2026-11-12-wall-objects`), applied in `2026-11-12-built`

His words, condensed: "The stroke weight looks slightly better, but it lost a bit of quality.
Focus more on how it's created - don't give just the final component, make each component appear
on screen. Focus less on the lighting and the table lamps; maybe add that only in the last second
or two. The face and the guitar look very good. I don't like the bike - really slim components.
Combine thicker strings that mark the edges, like borders, with softer strings in the middle to
create a 3D texture. Really use the height, many layers. 20 more. Cycle back to the mandala,
especially mandalas v2 - combine objects with that mandala-style structure, and use the Rubik's
cube movement for dynamism. Make a lollipop as one shape, and one shape with the BMW mark."

Rules (these override older entries where they conflict):

- **The making is the show.** Every component is strung on screen, one after another, in its own
  `window` - the camera follows where the strings are going on. The finished piece is the payoff
  for the last part of the clip, not the whole clip.
- **Borders and soft fill.** Main shapes get `border` (thick strings round the outline at each
  color band, `weight` about 2.5-3) over a fine fill (shape `weight` about 0.5-0.7, with
  `weave.weight` about 0.1). That contrast is the 3D texture and the "quality" he missed.
- **Lighting is a finale, not the subject.** Most of the clip is on the dark background with
  steady, gentle `lighting` (ambient ~0.5 plus a soft key light, for shading). A lamp/room/light
  change only in the last 1-2 seconds, if at all. A room can appear at the end by bringing its
  lights up from zero (a black wall in darkness is invisible).
- **Chunky components.** No thin, wiry parts (the bicycle failed for that). Every component is a
  solid, deep woven volume - 40-50 layers, real height.
- **Mandala x object.** Mandalas v2 (`batches/2026-11-12-mandalas-v2/`) is the structure to build
  on: objects arranged with radial `repeat` rings, interlocking, with Rubik's-cube turns of the
  rings (easeOutExpo turn, hold, easeInOutExpo back).
- The face and the guitar are still the favorites; the bicycle is out.

### 2026-11-12 - feedback on the sculpted batch (`2026-11-12-sculpted`), applied in `2026-11-12-wall-objects`

His words, condensed: "They look very good. The only issue: the stroke weight is too big, it
doesn't look very qualitative. Loved the face and the guitar. Use a smaller stroke weight, add
more details, but calibrate the stroke weight with the complexity of the scheme. Place it on the
wall and use the lighting - I adored that effect. Add other light sources, like a lamp on a table
nearby, and play more with the shadows, they look outstanding. 20 more, explore more objects."

Rules (these override older entries where they conflict):

- **Finer strings, calibrated.** The sculpted batch used `weight` 0.18-0.2 - too heavy. Go about
  0.06-0.12: the denser and more detailed the piece (more shapes, layers, nails), the thinner.
  0.09 on the guitar looked right. Fine strings must still read at the 540 preview.
- **More detail.** Recognisable objects built from more, smaller shapes (sound hole, frets,
  bridge on the guitar; eyes, lids, brows, lips on the face), each its own height.
- **Always on the wall, always lit.** Every reel is `room` + `lighting`, day to night or other
  light changes. The face (04) and guitar (06) are the references.
- **Other light sources in the room.** Use `room.lamps` (a table lamp beside the piece that
  switches on), alone or with the sun; show the lamp in frame at least once per reel.
- **Shadows are a star.** Move lights (sun sinking, a lamp switching on, a light sweeping past)
  so the strings' shadows swing, stretch and double up on the wall; frame shots that include them.

### 2026-11-12 - feedback on the abstract batch (`2026-11-12-abstract`), applied in `2026-11-12-sculpted`

His words, condensed: "Loved the first shape [01, the amphitheater], the way it moved the ovals
around, and the face [03] looks really good. Go even more complex, use the height. Don't show the
nails at all. As many layers as possible: if you choose four colors from Color Hunt, maybe 40 or
50 layers - the first ten in the first color, and so on. Make use of the height, especially when
you recreate a face or other regular things - maybe a car. Once the complex shape is built, dive
in: look up, look vertical and horizontal, smooth, from different angles - rotate, zoom, pan.
Some with lighting orbiting around. Maybe put it on a wall in a room and turn the light on and
off, day and night, and see how the colors change."

Rules (these override older entries where they conflict):

- **No nails.** `weave.nailsVisible: false` on every recipe. Still no board on a dark background
  and no words on screen; a lit room (below) is the one place a surface appears - the wall.
- **Deep banded stacks.** Main shapes use one whole Color Hunt palette with `colorMode: "bands"`
  and 40-50 layers, so each color is a solid tier of 10-12 layers (bottom band = first palette
  color). Small accents may stay thin.
- **Height is now the point, not a limit.** He asked for it outright, so the old "about 15% of the
  radius" cap is lifted for these: stacks should read as sculpture from the side - towering parts
  next to low ones, tiers climbing in steps. Keep each band thick enough to read as its own color.
- **Recognisable subjects built from shapes.** The face is a keeper (develop it: relief, with
  height shaping nose, brows, lips). Try other things he would recognise - a car is his example
  (body, cabin, wheels at different heights) - and other everyday objects.
- **The camera dives in after the build.** Build, then explore: orbit, push in close, drop below
  the top layers and look up through the stack (low or negative `elevation`, `tilt`), go
  overhead, go side-on, pan across with `targetX`/`targetZ`. Smooth eases, never jerky.
- **Light as the event.** Use `lighting` (README: "Lighting, wall and room"): a light orbiting the
  piece in the dark so the threads shimmer, and the piece hung in a `room` on a wall going from
  day to night - daylight fades, a warm lamp switches on, and the colors change with it.

### 2026-11-12 - feedback on mandalas v2 (`2026-11-12-mandalas-v2`), applied in `2026-11-12-abstract`

His words, condensed: "Love the direction, the mandalas are going great. From the first version I
like number six a lot, where it rotates like the Rubik's cube - implement that as well. In
version two all the shapes are pretty much flowers. I want something different: not these
symmetrical shapes... an oval, an infinity sign... more abstract shapes that aren't as symmetrical,
but keep the spacing you did in v2 - I like it very much. Maybe try a face. Play with the height
as well... it can even create something like an amphitheater. For the next iteration of ten, do
not show the names nor the board."

Rules (these override older entries where they conflict):

- **No board, no words on screen.** Every recipe uses `"board": false`, so the picture holds only
  strings and nails on the dark background. `edit.captions` is `[]` and there is no
  `edit.handle`. `meta.title` and `post` are still written, since only the review page and the
  posting use them. Until he says otherwise, this replaces "Words on screen" above and the
  caption advice in older entries.
- **Asymmetric and abstract, not radial.** No flowers, mandalas or rosettes for now. Build from
  custom `anchors` outlines (lemniscate, kidney, crescent, teardrop, S-wave ribbon, irregular
  blob) and from ovals with odd ratios, rotated, offset and overlapping. A face can work if it is
  calm and stylised (long oval head, almond eyes, one thin lens for a nose). A smiley with a
  crescent mouth looks silly.
- **Keep v2's density and spacing.** Main shapes are woven 7-14 layers deep and overlap or
  interlock, with a few deliberate open areas. Shapes floating apart on empty space read as
  ornaments.
- **Height is a design tool.** Use per-shape `base`/`height` to pair low, few-layer shapes
  (3-4 layers, about 30 high) with taller, many-layer ones (12-14 layers, up to about 400), or to
  step terraces into an amphitheater or dunes. The tallest point stays at about 15% of the
  composition's radius at most.
- **The Rubik's-cube turn is a signature move.** Tiers, rings or whole shapes turn against each
  other with `easeOutExpo`, hold, then snap back with `easeInOutExpo` (mandalas 06). It works on
  asymmetric compositions, where each shape turns about its own center, and on the grid via
  `twist`. Use it in a few reels per batch. Mandalas 06 was picked and finished unchanged: thin
  tiers turning one after another in alternating directions, seen from overhead, about 0.012 of
  the clip between tiers and about 0.05 per turn - keep that staggered timing.
- **Post text is posted as written.** No production notes (sound ideas, heights in world units)
  in `post.caption` - put a sound suggestion in `meta.soundIdea` instead.
- **Grid scene as abstract terrain.** Use `variety` (`fill` about 0.55-0.75, different leaps,
  layer counts and heights per cell) on small lattices (size 7-11), so the board is not one
  repeated tile.
- **Framing without a board.** A vertical frame shows about 0.26 x distance x `unit` on each
  side. An Arrange piece about 2600 wide needs a final `distance` of about 3.8-4.1, and a grid
  needs about 4.5. Prefer portrait-shaped compositions, and use `targetX`/`targetZ` (in units of
  `unit`, where +Z is +y on the board, toward the bottom of the screen at azimuth 90) to centre
  the opening shot on the first shape built.

### 2026-11-12 - mandalas batch (`2026-11-12-mandalas`, feedback on 01-05)

His words: "the first 5 look like christmas decorations. maybe don't leave as much space. feel free
to combine shapes, use multiple layers -> see /shapes page. make it look outstanding and complex
while leaving some breathable space."

Rules (these override the 2026-11-12 "let it breathe" note below where they conflict):

- **No scattered ornaments.** Small separate shapes (dots, little stars, diamonds, tiny circles)
  floating apart on empty board read as Christmas decorations. Fewer, larger, richer elements.
- **Interlock and overlap.** Petals overlapping each other and the center, a star laid over a
  circle, polygons rotated against each other (rose window, Islamic rosette). Rings touch or
  overlap so the piece reads as one connected thing.
- **Deep weaves, as on the Shapes page.** Main shapes get many color layers (about 8-20, at most
  nails/2) as a gradient from one palette, with the center rule and `leap <= 1 - layers` so every
  layer is a distinct nested chord. A more negative leap leaves an open eye in the middle.
- **Breathing room comes from contrast,** not emptiness: most of the composition woven, with a
  few deliberate open areas (an eye in a center, one gap between rings). Lines still readable.
- **Palettes:** sophisticated and harmonious; avoid Christmas-y red/green/gold on dark.
- Still: buildable heights (about 15% of radius), thin distinct tiers between overlapping
  shapes, center-out build, overhead / low pass / overhead camera. (The board is now hidden, and
  the radial mandala look is paused in favour of asymmetric shapes; see the newer entry above.)

### 2026-11-12 - 3D shapes batch (`2026-11-12-3d-shapes`, 6 candidates, picked 01-04)

Picked: the mandala build (`arrange`), the heart reveal (`arrange`), the polygon tower turn
(`arrange`) and the honeycomb ripple (`grid`). Passed over: the grid twist and the nail-field
dome (both `grid`). Leaning toward the Arrange compositions; too few to call more than that. Both
passed-over reels were praised for something ("great"), so their ideas are not ruled out.

Rules from his notes:

- **It must be buildable.** He makes these for real, so string stacks and nails stay low: the
  tallest point no more than about 10-15% of the composition's radius (for an Arrange piece of
  radius 3000, under ~450 in `height` + `base`; for a grid, `base` + `amplitude` under ~15% of
  half the lattice width). No towers, no shapes floating on very long nails, no stacking one
  shape high above another. Get depth from tiers that step up a little each, not from towers.
  (He now wants height used deliberately within that limit, e.g. low few-layer shapes next to
  taller many-layer ones, or amphitheater terraces. See the newest entry.)
- **Let it breathe.** (Softened by the mandalas entry above: breathing room comes from contrast
  and a few open areas, not from thin outlines spread over empty board.) Do not clog the whole
  board solid with string; keep some open board and readable lines. In the Arrange/Grid scenes the
  `"center"` rule with `leap` 0 sends every chord nearly through the middle, which fills a shape
  solid; a negative `leap` (step = nails/2 + leap of roughly 10-20% of the nails) weaves only a
  band round the edge and leaves the middle open - that is what fixed the mandala's halo and the
  heart. A piece that reads as "clogged and charged" (06) gets passed over.
- **Shapes must read cleanly and not suggest anything else.** The preset heart's full round
  lobes, and two hearts stacked, looked "like an arse". Use a slimmer, pointed heart (custom
  anchors, as in this batch's 02) woven as an open band.
- **More tiers, more color steps, one harmonious palette.** The Rubik's-cube turn of stacked
  tiers (build bottom-up, each tier turns its own way, snap back) is impressive - he loved those
  transitions. Use many thin tiers (10 rather than 6) with a smooth gradient across them from a
  single Color Hunt palette of neighbouring colors, not a neon run.
- **More layers and more professional colors** on the grid twist (05): it was great, but 3
  layers in a rainbow pastel looked thin and toy-like. Use a calmer Color Hunt palette.
- **Keep in mind: he loved the moving wave impression** of the honeycomb ripple (04), but wanted
  that reel static (fixed ripple surface, camera still moves). A travelling ripple is worth
  trying again in a future reel - kept low and buildable.

For next time (his words): "create 10 more, first mandala is the best one in my opinion, make 5
of those in the same style." So: the next batch has 10 reels, 5 of them mandalas in the style of
01 (center circle, ring of petals, outer ring of smaller petals, halo; warm palette; overhead
build with a mid-clip dip to a low angle) - with this batch's breathing room and low height.

### 2026-11-12 - notes on the second batch (`2026-11-11b`)

- **The explaining reels work** - the hour counter on the slow-to-fast build was liked. Do more
  that explain something as they go (what rule the strings follow, how long it takes, what
  changes when a number changes). The `explainer` archetype came out of this.
- **No hand.** The modelled hand looked awful and has been removed from the pipeline. Do not try
  to suggest a person with props; the hammer and spray can are fine.
- **The making-of was too tight** - he could not see where the threads started. The first
  strings now go on seen from above with the whole board in frame, drawn very bold, under a
  "Now the thread" caption. General rule: wide and bold at the moment the idea happens.
- **The dive must turn a full quarter-turn**: straight down the axis, then turn the camera 90
  degrees to look out level (not 45), look round, and leave through the side.
- **Camera movement was predictable.** He wants it dynamic: in, out, zoom, flip, stop to
  explain. This is now the "Camera" section above and applies to every reel.

### 2026-11-11 - first batch (`example`, 6 candidates, picked 01, 02, 05)

Picked: the string-by-string build-up on a real board with nails (`weave-reveal`), the top-down
times-table morph (`times-table`), and the dive (`dive`). Passed over: `flat-to-3d`,
`tower-twist`, `bloom`. Three picks is too few to call a pattern; the only thing the passed-over
ones share is being dense many-layer stacks seen from outside, with nothing being made or changed
that is easy to name. Andrei said the rest "look great", so they are not ruled out.

Rules from his notes:

- **Clean and harmonious beats busy.** The dive was picked but sent back as too messy (his wife's
  request: "more clean, more harmonious"). What fixed it: about a dozen layers instead of twenty,
  each turned by a single nail (`leap: 1`), fine strings (`weight` about 0.3), a soft palette of
  neighbouring colors rather than neon opposites, one slow symmetric camera move that ends where
  it began, and two short captions. When in doubt, take things out.
- **Colors come from Color Hunt.** Drafts are colored from `palettes/colorhunt.json`
  (`reels.mjs colorhunt` re-fetches it). Use those palettes as given rather than inventing colors.
- **Explore many layers - as many layers as nails.** 36/36, 48/48, 60/60 with `leap: 1` (the
  `full-turn` archetype) and variations on it. (Cardioid scene only; on Arrange/Grid pieces the
  2026-11-12 "let it breathe" rule wins: few layers per shape.)
- **He wants the "patient" build-up:** strings going on one at a time, slowly enough to follow at
  first, then faster and faster up to about 40 layers, with captions saying how many hours this
  takes by hand (the `hours` archetype). Keep the hours honest: string count times a realistic
  time per string, stated as what it takes by hand.
- **He wants a making-of:** bare board, spray paint, nails hammered in, then thread, with a hand
  coming in (the `making-of` archetype). These may run well past 12 seconds.
- **The synthesized sound is too basic for him.** He wants real Instagram/TikTok songs. Those can
  only be attached in the app when posting, so: keep the built-in track calm and unobtrusive, do
  not spend effort varying it, and say in each reel's post text what kind of track would suit it.

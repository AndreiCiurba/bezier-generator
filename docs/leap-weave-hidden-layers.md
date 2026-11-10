# Why some layers of a shape disappear or repeat

You draw a closed figure on `/shapes`, give it some nails and some colors, and
in the weave one layer is missing, or two layers look identical. This is not a
bug in the drawing: it is arithmetic on a loop of nails. This page explains it
from scratch.

## The picture

Take a closed figure (a circle, say) and put `N` nails evenly round its edge,
numbered `0` to `N - 1`. Going round the figure, nail `N - 1` is followed by
nail `0` again, so the nails form a loop.

A **layer** is one color. To draw a layer, take every nail and tie a string to
the nail a fixed number of places further round. That number is the layer's
**step**.

```
12 nails, step 3:   nail 0 -> nail 3,  nail 1 -> nail 4,  ...  nail 10 -> nail 1,  nail 11 -> nail 2
```

(Past nail 11 the count carries on from nail 0, because it is a loop.)

## Where each layer's step comes from

Every layer is the same idea with a different step. Layer 1 (the first color)
has the step `1 + leap`. Each following layer has one less than the layer
before it:

```
step of layer k  =  1 + leap - (k - 1)          k = 1, 2, 3, ...
```

So `leap` is the dial that moves all the steps up or down together. With
`leap = 5` the steps are 6, 5, 4, 3, ... With `leap = 0` they are 1, 0, -1,
-2, ... (This is `closedWeaveSegmentsForCurve` in
`src/core/closedWeaveMath.js`; the shapes use `n = 0` inner nails, so every
point is a nail and one "edge" is one nail.)

## Problem 1: a step of 0 (or a whole lap) draws nothing

If the step is `0`, or exactly `N` (one full lap), every string would go from a
nail to **itself**. A string that starts and ends at the same point has no
length, so you see nothing. The layer is there; it just has nothing to draw.

```
20 nails, leap 0:   steps 1, 0, -1, -2 ...      <- the second layer has step 0: invisible
```

## Problem 2: a step and its mirror draw the same strings

Step `3` on 12 nails ties nail 0 to nail 3, nail 1 to nail 4, and so on. Step
`9` (that is `12 - 3`, or `-3`) ties nail 0 to nail 9, nail 1 to nail 10...
Look at the string 3 -> 0 from the second one: it is the first one's string 0
-> 3, just counted from the other end. Every string a step of `s` draws is also
drawn by a step of `N - s`. They produce **exactly the same picture**, one
sitting on top of the other.

```
20 nails:  step 1  == step 19 (-1)
           step 2  == step 18 (-2)
           ...
           step 10 is its own mirror (the straight line through the middle)
```

That is why the layers around the missing one come in mirrored pairs: if step 0
is layer 2, then step 1 (layer 1) and step -1 (layer 3) match, step 2 and step
-2 match, and so on.

## The counting rule

Steps that give different pictures run from `1` up to `N / 2`. That is all
there is, so:

> **N nails can show at most `floor(N / 2)` genuinely different layers.**

12 nails: 6 layers. 20 nails: 10 layers. 21 nails: still only 10.

If you ask for more colors than that, some layers *must* repeat or vanish, no
matter what leap you choose. This is what happened with 12 nails and 10 or 11
colors.

## Making every layer show

Two conditions, both needed:

1. **Enough nails:** `nails >= 2 x colors`.
2. **Every step on the same side of zero, and no bigger than `N / 2`.** The
   steps run `1 + leap` down to `2 + leap - colors`. They must all be positive
   (or all negative) and stay within `N / 2` of zero. In numbers: either
   `colors - 1 <= leap <= N / 2 - 1`, or the mirrored negative range.

Worked example, **20 nails, 10 colors**:

| leap | steps                          | result                                   |
|------|--------------------------------|------------------------------------------|
| 0    | 1, 0, -1, -2 ... -8            | layer 2 empty, layer 3 copies layer 1 ...|
| 9    | 10, 9, 8 ... 1                 | works - widest layer first               |
| -2   | -1, -2, -3 ... -10             | works - thinnest layer first             |
| 10   | 11, 10, 9 ... 2                | step 11 mirrors 9: repeats a later layer |

Only `9` and `-2` work here, because 10 colors on 20 nails use up every
different layer. With more nails (30, say) there is room to spare: leaps from 9
to 14 work.

Positive and negative leaps draw the same set of strings; they only reverse the
order, i.e. which end of the stack gets the thinnest layer.

## What the app does about it

On `/shapes`, under the Leap field, the app checks nails, leap and colors with
`src/core/leapCheck.js`:

- it warns in red which colors will draw nothing or repeat another color;
- **Fix leap automatically** moves the leap to the closest value where every
  layer shows (leaving it alone if it already works);
- if the nails can't fit the colors at all, it says so and gives the minimum
  nail count instead, because no leap can help.

Layers you have switched off are ignored by the check.

## Quick rules of thumb

- Want N colors? Use at least `2 x N` nails.
- Leap `0` is almost never what you want with many colors: it puts a step of 0
  second in the stack.
- When in doubt, press **Fix leap automatically**.

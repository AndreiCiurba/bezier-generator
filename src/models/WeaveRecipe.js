/**
 * A named, reusable Weave-feature recipe: how many sides its cell was
 * designed for, how many inner nails per edge (N), its base leap, and how
 * many color layers it uses - exactly the settings the standalone
 * playground (`tools/leap-weave-playground.html`) lets you play with,
 * saved/exported from there and imported into the real app's Weave menu.
 *
 * `colors` is optional - the playground always saves the actual hex values
 * it previewed with, but a hand-edited or older recipe file might specify
 * only `colorCount`. Importing either kind resizes the app's palette to
 * `colorCount`; when `colors` is present too, those exact hex values are
 * applied on top - otherwise the newly-sized slots keep the palette's own
 * default fill colors (see `WeaveUI#applyRecipeColors`).
 *
 * `sides` is purely informational once imported - it's never used to
 * override how many nails a cell actually has (that's always the *current*
 * grid's own layout, via `sidesForGridLayout`), only to warn if a design was
 * tuned for a different shape than the board currently is (see
 * `WeaveUI`'s import flow).
 */
export class WeaveRecipe {
  /**
   * @param {{id: string, name: string, sides: number, n: number, leap: number, colorCount: number, colors?: string[]|null}} config
   */
  constructor({ id, name, sides, n, leap, colorCount, colors = null }) {
    this.id = id;
    this.name = name;
    this.sides = sides;
    this.n = n;
    this.leap = leap;
    this.colorCount = colorCount;
    this.colors = colors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      sides: this.sides,
      n: this.n,
      leap: this.leap,
      colorCount: this.colorCount,
      colors: this.colors,
    };
  }
}

import { describe, it, expect } from 'vitest';
import { WeaveRecipe } from './WeaveRecipe.js';

describe('WeaveRecipe#toJSON', () => {
  it('round-trips id/name/sides/n/leap/colorCount with no explicit colors', () => {
    const recipe = new WeaveRecipe({ id: 'w1', name: 'Spiky hex', sides: 6, n: 13, leap: 5, colorCount: 6 });
    expect(recipe.toJSON()).toEqual({
      id: 'w1',
      name: 'Spiky hex',
      sides: 6,
      n: 13,
      leap: 5,
      colorCount: 6,
      colors: null,
    });
  });

  it('round-trips explicit colors when given', () => {
    const colors = ['#B0413A', '#1E6E6E'];
    const recipe = new WeaveRecipe({ id: 'w2', name: 'Two-tone', sides: 3, n: 8, leap: 2, colorCount: 2, colors });
    expect(recipe.toJSON().colors).toEqual(colors);
  });
});

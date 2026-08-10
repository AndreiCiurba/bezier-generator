import { describe, it, expect, vi } from 'vitest';
import { PanelGroup } from './PanelGroup.js';

function fakePanel() {
  return { open: vi.fn(), close: vi.fn() };
}

describe('PanelGroup', () => {
  it('openOnly closes every other registered panel and opens the target', () => {
    const group = new PanelGroup();
    const a = group.register(fakePanel());
    const b = group.register(fakePanel());
    const c = group.register(fakePanel());

    group.openOnly(b);

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(c.close).toHaveBeenCalledTimes(1);
    expect(b.close).not.toHaveBeenCalled();
    expect(b.open).toHaveBeenCalledTimes(1);
  });

  it('an unregistered panel is unaffected', () => {
    const group = new PanelGroup();
    const a = group.register(fakePanel());
    const outsider = fakePanel();

    group.openOnly(a);

    expect(outsider.close).not.toHaveBeenCalled();
  });
});

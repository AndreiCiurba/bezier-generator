import { describe, it, expect, vi } from 'vitest';
import { PanelGroup } from './PanelGroup.js';

function fakePanel() {
  return { open: vi.fn(), close: vi.fn() };
}

/** Same as `fakePanel`, but `open`/`close` actually flip a real `isOpen` - needed for `toggleOpen`, which branches on it. */
function statefulFakePanel() {
  const panel = {
    open: vi.fn(() => {
      panel.isOpen = true;
    }),
    close: vi.fn(() => {
      panel.isOpen = false;
    }),
    isOpen: false,
  };
  return panel;
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

  it('toggleOpen opens a closed panel exclusively, same as openOnly', () => {
    const group = new PanelGroup();
    const a = group.register(statefulFakePanel());
    const b = group.register(statefulFakePanel());

    group.toggleOpen(b);

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.open).toHaveBeenCalledTimes(1);
    expect(b.isOpen).toBe(true);
  });

  it('toggleOpen closes a panel that is already open, instead of doing nothing', () => {
    const group = new PanelGroup();
    const a = group.register(statefulFakePanel());
    group.toggleOpen(a);
    expect(a.isOpen).toBe(true);

    group.toggleOpen(a);

    expect(a.isOpen).toBe(false);
    expect(a.close).toHaveBeenCalledTimes(1);
  });
});

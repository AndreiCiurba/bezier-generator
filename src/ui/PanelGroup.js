/**
 * Keeps a set of Panels mutually exclusive: opening one closes the rest.
 *
 * The Colors and Patterns submenus are both anchored at the same spot next
 * to the main menu, so having both open at once means one sits invisibly
 * behind the other. Registering both with one group is what prevents that.
 */
export class PanelGroup {
  #panels = [];

  register(panel) {
    this.#panels.push(panel);
    return panel;
  }

  /** Closes every other registered panel, then opens `panel`. */
  openOnly(panel) {
    for (const p of this.#panels) {
      if (p !== panel) p.close();
    }
    panel.open();
  }

  /**
   * For a trigger button that opens `panel`: if it's already the open one,
   * closes it (a second click on the same trigger collapses it, instead of
   * `openOnly` re-opening it and doing nothing visible); otherwise opens it
   * exclusively via `openOnly`.
   */
  toggleOpen(panel) {
    if (panel.isOpen) {
      panel.close();
    } else {
      this.openOnly(panel);
    }
  }
}

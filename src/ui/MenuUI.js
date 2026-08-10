import { Panel } from './Panel.js';

/**
 * The burger icon and the main slide-out menu it reveals - each hides the
 * other, so opening/closing one is really a swap between two panels.
 */
export class MenuUI {
  constructor(burgerEl, menuEl, closeBtn) {
    this.burger = new Panel(burgerEl);
    this.menu = new Panel(menuEl);
    this.closeBtn = closeBtn;
  }

  init() {
    this.burger.element.addEventListener('click', () => {
      this.menu.open();
      this.burger.close();
    });

    this.closeBtn.addEventListener('click', () => {
      this.menu.close();
      this.burger.open();
    });
  }
}

/**
 * A show/hide-able DOM panel (the main menu, and the color/pattern submenus),
 * toggled via the shared `.hidden` CSS class.
 */
export class Panel {
  constructor(element) {
    this.element = element;
  }

  get isOpen() {
    return !this.element.classList.contains('hidden');
  }

  open() {
    this.element.classList.remove('hidden');
  }

  close() {
    this.element.classList.add('hidden');
  }

  toggle() {
    this.element.classList.toggle('hidden');
  }
}

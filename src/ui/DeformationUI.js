import { Panel } from './Panel.js';
import { parsePinRadius, parsePinFalloff } from '../core/deformation/pinParams.js';

/**
 * Wires the "Deformation" submenu: entering/exiting Deformation Mode, the
 * default radius/falloff new pins get, the selected pin's own radius/falloff
 * (editable after creation - AC6), removing the selected pin, and resetting
 * every pin at once. `App.js` owns the actual `DeformableGrid`/pin mutations
 * (mirroring `CanvasSizeUI`/`ColorCountUI`'s callback style, not owning state
 * directly) and calls back into this class to reflect the result (selection,
 * pin count).
 *
 * `isActive` (Deformation Mode) is a real, independent flag - not derived
 * from the panel's open/closed state. That matches how an armed pattern
 * (`PatternStore#isInUse`) already survives the Patterns submenu being
 * closed elsewhere in this app; deformation mode surviving the Deformation
 * submenu being closed (e.g. by opening Colors, or by closing the whole
 * burger menu) is the same, already-accepted behavior, not a new risk.
 */
export class DeformationUI {
  #active = false;
  #selectedPin = null;

  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   defaultRadiusInput: HTMLInputElement, defaultFalloffInput: HTMLInputElement, applyDefaultsBtn: HTMLElement,
   *   selectedRadiusInput: HTMLInputElement, selectedFalloffInput: HTMLInputElement, applySelectedBtn: HTMLElement,
   *   removePinBtn: HTMLElement, resetBtn: HTMLElement, pinCountEl: HTMLElement,
   * }} elements
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup
   * @param {{radius: number, falloff: number}} initialDefaults
   * @param {(pin: import('../models/Pin.js').Pin) => void} onRemovePin
   * @param {() => void} onReset
   * @param {() => void} onSelectedPinChanged called after the selected pin's
   *   radius/falloff are edited directly (bypassing `DeformableGrid`'s own
   *   mutators) - the caller should invalidate the deformed-grid cache
   *   (`DeformableGrid#invalidate`) in response.
   */
  constructor(elements, submenuGroup, initialDefaults, onRemovePin, onReset, onSelectedPinChanged) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.submenuGroup = submenuGroup;
    this.onRemovePin = onRemovePin;
    this.onReset = onReset;
    this.onSelectedPinChanged = onSelectedPinChanged;
    this.defaultRadius = initialDefaults.radius;
    this.defaultFalloff = initialDefaults.falloff;
  }

  get isActive() {
    return this.#active;
  }

  get selectedPin() {
    return this.#selectedPin;
  }

  init() {
    const {
      openBtn,
      closeBtn,
      defaultRadiusInput,
      defaultFalloffInput,
      applyDefaultsBtn,
      selectedRadiusInput,
      selectedFalloffInput,
      applySelectedBtn,
      removePinBtn,
      resetBtn,
    } = this.el;

    openBtn.addEventListener('click', () => {
      if (this.panel.isOpen) {
        this.#active = false;
        this.panel.close();
      } else {
        this.#active = true;
        this.submenuGroup.openOnly(this.panel);
      }
    });
    closeBtn.addEventListener('click', () => {
      this.#active = false;
      this.panel.close();
    });

    defaultRadiusInput.value = String(this.defaultRadius);
    defaultFalloffInput.value = String(this.defaultFalloff);
    applyDefaultsBtn.addEventListener('click', () => this.#applyDefaults());

    applySelectedBtn.addEventListener('click', () => this.#applySelected());
    removePinBtn.addEventListener('click', () => this.#removeSelected());
    resetBtn.addEventListener('click', () => {
      this.setSelectedPin(null);
      this.onReset();
    });

    this.refreshPinCount(0);
  }

  /**
   * Marks `pin` (or `null`) as selected - populates the selected-pin fields
   * with its current values so "Apply"/"Remove" act on it. Called by App.js
   * whenever a pin is created, dragged, or plain-clicked.
   * @param {import('../models/Pin.js').Pin|null} pin
   */
  setSelectedPin(pin) {
    this.#selectedPin = pin;
    this.el.selectedRadiusInput.value = pin ? String(pin.radius) : '';
    this.el.selectedFalloffInput.value = pin ? String(pin.falloff) : '';
  }

  /** Reflects the current pin count - call after any add/remove/reset. */
  refreshPinCount(count) {
    this.el.pinCountEl.textContent = `${count} pin${count === 1 ? '' : 's'}`;
  }

  #applyDefaults() {
    const radius = parsePinRadius(this.el.defaultRadiusInput.value);
    const falloff = parsePinFalloff(this.el.defaultFalloffInput.value);
    if (radius === null || falloff === null) {
      alert('Enter a valid radius and falloff.');
      return;
    }
    this.defaultRadius = radius;
    this.defaultFalloff = falloff;
  }

  #applySelected() {
    if (!this.#selectedPin) {
      alert('No pin selected - click a pin first.');
      return;
    }
    const radius = parsePinRadius(this.el.selectedRadiusInput.value);
    const falloff = parsePinFalloff(this.el.selectedFalloffInput.value);
    if (radius === null || falloff === null) {
      alert('Enter a valid radius and falloff.');
      return;
    }
    this.#selectedPin.radius = radius;
    this.#selectedPin.falloff = falloff;
    this.onSelectedPinChanged();
  }

  #removeSelected() {
    if (!this.#selectedPin) {
      alert('No pin selected - click a pin first.');
      return;
    }
    this.onRemovePin(this.#selectedPin);
    this.setSelectedPin(null);
  }
}

/**
 * Restyles every plain checkbox in the menu as the 3D page's toggle switch
 * (`.switch` / `.switch-track` in pro-theme.css), without rewriting each page's
 * markup. The input itself is kept (same id, same `change` events), just moved
 * into a switch wrapper at the end of its label, so the existing code that
 * reads `.checked` is unaffected.
 */
export function upgradeCheckboxesToSwitches(root = document) {
  root.querySelectorAll('#ui input[type="checkbox"]').forEach((input) => {
    if (input.closest('.switch')) return; // already a switch (e.g. markup copied from the 3D page)
    const label = input.closest('label');
    if (!label) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'switch';
    const track = document.createElement('span');
    track.className = 'switch-track';
    wrapper.append(input, track);
    label.appendChild(wrapper);
    label.classList.add('switch-row');
  });
}

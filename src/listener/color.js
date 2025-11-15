import { getCurrentStrokes, setCurrentColor } from './../../colors.js'

document
  .querySelectorAll('#colorPickerContainer input[type="color"]')
  .forEach((picker, index) => {

    picker.addEventListener("click", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      getCurrentStrokes()[index].enabled =
        !getCurrentStrokes()[index].enabled;

      updatePickerVisual(picker, getCurrentStrokes()[index].enabled);
    });

    picker.addEventListener("input", () => {
      setCurrentColor(index, picker.value);
    });
  });

function updatePickerVisual(picker, enabled) {
  if (enabled) {
    picker.style.opacity = "1";
    picker.style.border = "2px solid transparent";
  } else {
    picker.style.opacity = "0.1";
    picker.style.border = "2px solid white";
  }
}